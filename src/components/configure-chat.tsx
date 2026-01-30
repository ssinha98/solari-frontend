"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  File,
  Trash2,
  X,
  Upload,
  Check,
  RefreshCw,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  getAgentSources,
  addAgentSource,
  deleteSource,
  updateSourceNickname,
  updateSourceDescription,
  uploadSourceFile,
  deleteTableSource,
  convertToCSV,
  Source,
} from "@/tools/agent_tools";
import {
  analyzeTable,
  uploadWebsiteToPinecone,
  startSlackBatchSync,
  getSlackBatchSyncStatus,
  tickSlackBatchSync,
  listAgentMembers,
  listTeamMembers,
  addAgentMembers,
  removeAgentMember,
} from "@/tools/api";
import { auth, db } from "@/tools/firebase";
import { getBackendUrl } from "@/tools/backend-config";
import {
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  collection,
  getDocs,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { IoIosDocument } from "react-icons/io";
import { CiGlobe, CiViewTable, CiCircleAlert } from "react-icons/ci";
import { CgMaximize } from "react-icons/cg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SlackSyncWidget } from "@/components/ui/SlackBatchSyncViewer";
import { useSlackSyncWidgetData } from "@/components/ui/useSlackSyncWidgetData";
import SlackTranscriptViewer from "@/components/ui/SlackTranscriptViewer";
import { computeRatingAnalytics, type RatingDoc } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
// import { AnalyticsHBarChart } from "@/components/analytics_hbarchart";

// Helper function to get file type icon based on type or file extension
function getFileTypeIcon(source: { type?: string; name?: string }) {
  const type = source.type?.toLowerCase();

  // Check for specific types first
  switch (type) {
    case "document":
      return <IoIosDocument className="h-4 w-4" />;
    case "website":
      return <CiGlobe className="h-4 w-4" />;
    case "table":
      return <CiViewTable className="h-4 w-4" />;
    case "jira":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000"
          alt="Jira"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "confluence":
    case "confluence_page":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
          alt="Confluence"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "slack_channel":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
          alt="Slack"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "google drive":
    case "googledrive":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=13630&format=png&color=000000"
          alt="Google Drive"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "notion":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=nvtEH6DpqruC&format=png&color=000000"
          alt="Notion"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "gong":
      return (
        <Image
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiRxcqf6E93pRSDFSa2o8vuXjzc6IdaafuWA&s"
          alt="Gong"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
  }

  // Fallback to file extension if type is not specified
  if (source.name) {
    const extension = source.name.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "md":
      case "txt":
        return <File className="h-4 w-4" />;
      case "docx":
      case "doc":
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  }

  return <File className="h-4 w-4" />;
}

// Helper function to get source type icon for tiles (larger size)
function getSourceTypeIcon(type: string) {
  const typeLower = type.toLowerCase();

  switch (typeLower) {
    case "document":
      return <IoIosDocument className="h-8 w-8" />;
    case "website":
      return <CiGlobe className="h-8 w-8" />;
    case "table":
      return <CiViewTable className="h-8 w-8" />;
    case "jira":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=oROcPah5ues6&format=png&color=000000"
          alt="Jira"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    case "confluence":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
          alt="Confluence"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    case "slack":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
          alt="Slack"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    case "google drive":
    case "googledrive":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=13630&format=png&color=000000"
          alt="Google Drive"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    case "notion":
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=nvtEH6DpqruC&format=png&color=000000"
          alt="Notion"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    case "gong":
      return (
        <Image
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQiRxcqf6E93pRSDFSa2o8vuXjzc6IdaafuWA&s"
          alt="Gong"
          width={32}
          height={32}
          className="h-8 w-8"
        />
      );
    default:
      return <File className="h-8 w-8" />;
  }
}

type UploadJob = {
  id: string;
  status?: string;
  connector?: string;
  title?: string;
  url?: string;
  excerpt?: string;
};

export function ConfigureChat({ agentId }: { agentId: string | null }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isAddSourcePreparing, setIsAddSourcePreparing] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [originalNicknames, setOriginalNicknames] = useState<
    Record<string, string>
  >({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<{
    id: string;
    nickname?: string;
    name?: string;
  } | null>(null);
  const [deleteTicketDialogOpen, setDeleteTicketDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<any | null>(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

  // State for description edit dialog
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [editingDescriptionSource, setEditingDescriptionSource] = useState<{
    id: string;
    nickname: string;
    type: string;
    currentDescription: string;
  } | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");

  const [agentMembers, setAgentMembers] = useState<
    Array<{
      id: string;
      displayName?: string;
      email?: string;
      role?: string;
      permission?: string;
    }>
  >([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // State for "Add member" dialog - view only
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      displayName?: string;
      email?: string;
      photoURL?: string;
    }>
  >([]);
  const [agentMemberIds, setAgentMemberIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMemberRoles, setSelectedMemberRoles] = useState<
    Record<string, "view" | "edit" | "admin" | "">
  >({});
  const [isLoadingMemberTiles, setIsLoadingMemberTiles] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [isInvitingMembers, setIsInvitingMembers] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    email?: string;
  } | null>(null);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // State for maximize dialog
  const [maximizeDialog, setMaximizeDialog] = useState<
    "currentSources" | "addNewSources" | null
  >(null);
  const [ratingStats, setRatingStats] = useState<ReturnType<
    typeof computeRatingAnalytics
  > | null>(null);
  const [ratingStatsLoading, setRatingStatsLoading] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");
  const [slackTranscriptSource, setSlackTranscriptSource] =
    useState<Source | null>(null);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [isUploadJobsDrawerOpen, setIsUploadJobsDrawerOpen] = useState(false);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const fetchTeamId = async () => {
      const user = auth.currentUser;
      if (!user) {
        setTeamId(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        setTeamId(nextTeamId ?? null);
      } catch (error) {
        console.error("Failed to load team ID:", error);
        setTeamId(null);
      }
    };

    fetchTeamId();
  }, []);

  useEffect(() => {
    const fetchTeamName = async () => {
      if (!teamId) {
        setTeamName("");
        return;
      }

      try {
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        const nextTeamName = teamSnap.data()?.team_name;
        setTeamName(typeof nextTeamName === "string" ? nextTeamName : "");
      } catch (error) {
        console.error("Failed to load team name:", error);
        setTeamName("");
      }
    };

    fetchTeamName();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) {
      setUploadJobs([]);
      setIsUploadJobsDrawerOpen(false);
      return;
    }

    const jobsQuery = query(
      collection(db, "teams", teamId, "upload_jobs"),
      orderBy("created_at", "desc"),
      limit(25),
    );

    const activeStatuses = new Set(["queued", "processing", "error"]);
    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        const allJobs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<UploadJob, "id">),
        }));
        const activeJobs = allJobs.filter((job) =>
          activeStatuses.has(job.status ?? ""),
        );
        setUploadJobs(activeJobs);
        if (activeJobs.length === 0) {
          setIsUploadJobsDrawerOpen(false);
        }
      },
      (error) => {
        console.error("Error listening to upload jobs:", error);
        setUploadJobs([]);
        setIsUploadJobsDrawerOpen(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [teamId]);

  const getAgentEventProps = () => {
    const eventProps: Record<string, string> = {};
    const userId = auth.currentUser?.uid;
    if (userId) {
      eventProps.user_id = userId;
    }
    if (teamId) {
      eventProps.team_id = teamId;
    }
    if (teamName) {
      eventProps.team_name = teamName;
    }
    if (agentId) {
      eventProps.agent_id = agentId;
      eventProps.agent_name = agentName || "agent";
    }
    return eventProps;
  };

  useEffect(() => {
    if (!addMemberDialogOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddMemberDialogOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [addMemberDialogOpen]);

  useEffect(() => {
    const fetchAgentName = async () => {
      if (!teamId || !agentId) {
        setAgentName("");
        return;
      }

      try {
        const agentSnap = await getDoc(
          doc(db, "teams", teamId, "agents", agentId),
        );
        if (agentSnap.exists()) {
          const data = agentSnap.data();
          setAgentName(typeof data.name === "string" ? data.name : "");
        } else {
          setAgentName("");
        }
      } catch (error) {
        console.error("Failed to load agent name:", error);
        setAgentName("");
      }
    };

    fetchAgentName();
  }, [teamId, agentId]);

  const refreshAgentMembers = async () => {
    if (!teamId || !agentId) {
      return;
    }
    try {
      const refreshed = await listAgentMembers(teamId, agentId);
      if (refreshed.success) {
        setAgentMembers(
          refreshed.members.map((member, index) => ({
            id: member.uid || member.id || member.email || `member-${index}`,
            displayName: member.displayName,
            email: member.email,
            role: member.role,
            permission: member.permission,
          })),
        );
        setAgentMemberIds(
          new Set(
            refreshed.members.map(
              (member, index) =>
                member.uid || member.id || member.email || `member-${index}`,
            ),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to refresh agent members:", error);
    }
  };

  useEffect(() => {
    const fetchAgentMembers = async () => {
      if (!teamId || !agentId) {
        setAgentMembers([]);
        return;
      }

      try {
        setIsLoadingMembers(true);
        const response = await listAgentMembers(teamId, agentId);
        if (!response.success) {
          setAgentMembers([]);
          return;
        }
        setAgentMembers(
          response.members.map((member, index) => ({
            id: member.uid || member.id || member.email || `member-${index}`,
            displayName: member.displayName,
            email: member.email,
            role: member.role,
            permission: member.permission,
          })),
        );
      } catch (error) {
        console.error("Failed to load agent members:", error);
        setAgentMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchAgentMembers();
  }, [teamId, agentId]);

  useEffect(() => {
    const fetchMembersForInvite = async () => {
      if (!addMemberDialogOpen || !teamId || !agentId) {
        return;
      }

      try {
        setIsLoadingMemberTiles(true);
        const [teamMembersResponse, agentMembersResponse] = await Promise.all([
          listTeamMembers(teamId, auth.currentUser?.uid || ""),
          listAgentMembers(teamId, agentId),
        ]);

        const nextTeamMembers = teamMembersResponse.members.map(
          (member, index) => ({
            id: member.uid || `member-${index}`,
            displayName: member.displayName,
            email: member.email,
            photoURL: member.photoURL,
          }),
        );

        const nextAgentMembers = agentMembersResponse.members.map(
          (member, index) => ({
            id: member.uid || member.id || member.email || `member-${index}`,
            displayName: member.displayName,
            email: member.email,
            role: member.role,
            permission: member.permission,
          }),
        );

        const nextAgentMemberIds = new Set(
          nextAgentMembers.map((member) => member.id),
        );

        setTeamMembers(nextTeamMembers);
        setAgentMembers(nextAgentMembers);
        setAgentMemberIds(nextAgentMemberIds);
        setSelectedMemberIds(new Set());
        setSelectedMemberRoles({});
        setMemberSearch("");
      } catch (error) {
        console.error("Failed to load members for invite:", error);
        setTeamMembers([]);
        setAgentMemberIds(new Set());
        setSelectedMemberIds(new Set());
        setSelectedMemberRoles({});
      } finally {
        setIsLoadingMemberTiles(false);
      }
    };

    fetchMembersForInvite();
  }, [addMemberDialogOpen, teamId, agentId]);

  // State for "Add new source" dialog
  const [addNewSourceDialogOpen, setAddNewSourceDialogOpen] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState<{
    name: string;
    type: string;
  } | null>(null);

  // State for website source form
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteNickname, setWebsiteNickname] = useState("");

  // State for document source form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentNickname, setDocumentNickname] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // State for table source form
  const [selectedTableFile, setSelectedTableFile] = useState<File | null>(null);
  const [tableNickname, setTableNickname] = useState("");
  const [isDraggingTable, setIsDraggingTable] = useState(false);

  // State for table analysis response
  const [tableAnalysisResponse, setTableAnalysisResponse] = useState<{
    column_count: number;
    columns: Record<
      string,
      { pandas_dtype: string; type: string; example_values: any[] }
    >;
    document_id: string;
    file_path: string;
    message: string;
    row_count: number;
    status: string;
  } | null>(null);

  // State for table source that needs review (warning or error)
  const [tableSourcePendingReview, setTableSourcePendingReview] = useState<{
    agentSourceId: string;
    nickname: string;
    filePath: string;
    rowCount: number;
  } | null>(null);

  // State for Jira access token check
  const [hasJiraAccessToken, setHasJiraAccessToken] = useState<boolean | null>(
    null,
  );

  // State for checking if Jira source already exists
  const [hasJiraSource, setHasJiraSource] = useState<boolean>(false);

  // State for Jira search
  const [jiraSearchInput, setJiraSearchInput] = useState("");
  const [jiraSearchResults, setJiraSearchResults] = useState<any[]>([]);
  const [isSearchingJira, setIsSearchingJira] = useState(false);
  const [selectedJiraTickets, setSelectedJiraTickets] = useState<Set<string>>(
    new Set(),
  );

  // State for Confluence access token check
  const [hasConfluenceAccessToken, setHasConfluenceAccessToken] = useState<
    boolean | null
  >(null);

  // State for checking if Confluence source already exists
  const [hasConfluenceSource, setHasConfluenceSource] =
    useState<boolean>(false);

  // State for Jira site URL (used for Confluence URLs)
  const [jiraSiteUrl, setJiraSiteUrl] = useState<string | null>(null);

  // State for Confluence search
  const [confluenceSearchInput, setConfluenceSearchInput] = useState("");
  const [confluenceCQLInput, setConfluenceCQLInput] = useState("");
  const [confluenceSearchTab, setConfluenceSearchTab] = useState<
    "query" | "cql" | "spaces"
  >("query");
  const [confluenceSearchResults, setConfluenceSearchResults] = useState<any[]>(
    [],
  );
  const [isSearchingConfluence, setIsSearchingConfluence] = useState(false);
  const [selectedConfluencePages, setSelectedConfluencePages] = useState<
    Set<string>
  >(new Set());
  const [confluenceSpaces, setConfluenceSpaces] = useState<
    Array<{ id: string; name: string; pages: any[] }>
  >([]);
  const [isLoadingConfluenceSpaces, setIsLoadingConfluenceSpaces] =
    useState(false);
  const [loadingConfluencePagesBySpace, setLoadingConfluencePagesBySpace] =
    useState<Record<string, boolean>>({});
  const [openConfluenceSpaceId, setOpenConfluenceSpaceId] = useState<
    string | null
  >(null);
  const [confluenceSpaceSearches, setConfluenceSpaceSearches] = useState<
    Record<string, string>
  >({});

  // State for column types confirmation dialog
  const [columnTypesDialogOpen, setColumnTypesDialogOpen] = useState(false);
  const [columnTypes, setColumnTypes] = useState<
    Record<
      string,
      {
        pandas_dtype: string;
        type: string;
        canon_dtype: string;
        example_values: any[];
      }
    >
  >({});
  const [columnTypesAgentSourceId, setColumnTypesAgentSourceId] = useState<
    string | null
  >(null);

  // State for Slack installation check
  const [hasSlackInstallation, setHasSlackInstallation] = useState<
    boolean | null
  >(null);

  // State for checking if Slack source already exists
  const [hasSlackSource, setHasSlackSource] = useState<boolean>(false);

  // State for Slack channel search
  const [slackSearchInput, setSlackSearchInput] = useState("");
  const [allSlackChannels, setAllSlackChannels] = useState<any[]>([]);
  const [isLoadingSlackChannels, setIsLoadingSlackChannels] = useState(false);
  const [selectedSlackChannels, setSelectedSlackChannels] = useState<
    Set<string>
  >(new Set());
  const [slackTeamId, setSlackTeamId] = useState<string | null>(null);
  const [syncingChannels, setSyncingChannels] = useState<Set<string>>(
    new Set(),
  );

  // State for batch upload
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [batchQueueItems, setBatchQueueItems] = useState<
    Array<{
      channel_id: string;
      channel_name: string;
      status: string;
      error?: string | null;
      finished_at?: any;
      result?: any;
      started_at?: any;
      team_id: string;
      batch_id?: string;
    }>
  >([]);

  // All available source types
  const newSourceTypes = [
    { id: "1", name: "Document", type: "document" },
    { id: "2", name: "Website", type: "website" },
    { id: "3", name: "Table", type: "table" },
    { id: "4", name: "Jira", type: "jira" },
    { id: "5", name: "Confluence", type: "confluence" },
    { id: "6", name: "Slack", type: "slack" },
    { id: "7", name: "Google Drive", type: "google drive" },
    { id: "8", name: "Notion", type: "notion" },
    { id: "9", name: "Gong", type: "gong" },
  ];
  const comingSoonSourceTypes = new Set(["google drive", "notion", "gong"]);

  // Map backend type to UI type
  const mapBackendTypeTocanon_dtype = (
    backendType: string,
    pandasDtype: string,
  ): string => {
    // Map common backend types to UI types
    if (
      backendType === "integer" ||
      backendType === "float" ||
      pandasDtype.includes("int") ||
      pandasDtype.includes("float")
    ) {
      return "number";
    }
    if (backendType === "datetime" || pandasDtype.includes("datetime")) {
      return "date";
    }
    if (backendType === "bool" || pandasDtype.includes("bool")) {
      return "boolean";
    }
    if (pandasDtype === "object" || backendType === "string") {
      return "text";
    }
    // Default to text
    return "text";
  };

  const handleNicknameChange = (id: string, newNickname: string) => {
    // Mark as editing when user starts typing and store original value
    if (!editingSourceId) {
      setEditingSourceId(id);
      const source = currentSources.find((s) => s.id === id);
      if (source) {
        setOriginalNicknames((prev) => ({
          ...prev,
          [id]: source.nickname || "",
        }));
      }
    }
    // Update local state immediately for responsive UI
    setCurrentSources((prev) =>
      prev.map((source) =>
        source.id === id ? { ...source, nickname: newNickname } : source,
      ),
    );
  };

  const handleNicknameSave = async (sourceId: string) => {
    if (!agentId || !teamId) return;

    const source = currentSources.find((s) => s.id === sourceId);
    if (!source) return;

    // Get the original nickname from Firestore to compare
    const originalSources = await getAgentSources(teamId, agentId);
    const originalSource = originalSources.find((s) => s.id === sourceId);
    const oldNickname = originalSource?.nickname || "";
    const newNickname = source.nickname || "";

    // Only update if nickname actually changed
    if (newNickname.trim() === oldNickname.trim()) {
      setEditingSourceId(null);
      return;
    }

    try {
      await updateSourceNickname(
        teamId,
        agentId,
        sourceId,
        newNickname.trim(),
        oldNickname,
        source.type || "",
      );
      // Sources will be updated automatically via Firestore listener
      setEditingSourceId(null);
      setOriginalNicknames((prev) => {
        const newState = { ...prev };
        delete newState[sourceId];
        return newState;
      });
      toast.success("Nickname updated successfully");
    } catch (error) {
      console.error("Failed to update source nickname:", error);
      toast.error("Failed to update source nickname");
      // Revert to original on error
      const originalNickname = originalNicknames[sourceId] || "";
      setCurrentSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, nickname: originalNickname } : s,
        ),
      );
      setEditingSourceId(null);
      setOriginalNicknames((prev) => {
        const newState = { ...prev };
        delete newState[sourceId];
        return newState;
      });
    }
  };

  const openSlackTranscript = (source: Source) => {
    const user = auth.currentUser;
    if (!user || !agentId) {
      toast.error("User and agent required to view transcript");
      return;
    }
    setSlackTranscriptSource(source);
  };

  const closeSlackTranscript = () => {
    setSlackTranscriptSource(null);
  };

  const handleDeleteClick = (sourceId: string) => {
    const source = currentSources.find((s) => s.id === sourceId);
    if (!source) return;

    setSourceToDelete({
      id: sourceId,
      nickname: source.nickname,
      name: source.name,
    });
    setDeleteDialogOpen(true);
  };

  const handleDescriptionClick = (sourceId: string) => {
    const source = currentSources.find((s) => s.id === sourceId);
    if (!source) return;

    setEditingDescriptionSource({
      id: sourceId,
      nickname: source.nickname || "",
      type: source.type || "",
      currentDescription: source.description || "",
    });
    setDescriptionInput(source.description || "");
    setDescriptionDialogOpen(true);
  };

  const handleDescriptionSave = async () => {
    if (!editingDescriptionSource || !agentId || !teamId) return;

    const newDescription = descriptionInput.trim();
    const oldDescription = editingDescriptionSource.currentDescription;

    // Only update if description actually changed
    if (newDescription === oldDescription) {
      setDescriptionDialogOpen(false);
      setEditingDescriptionSource(null);
      setDescriptionInput("");
      return;
    }

    try {
      await updateSourceDescription(
        teamId,
        agentId,
        editingDescriptionSource.id,
        newDescription,
        editingDescriptionSource.nickname,
        editingDescriptionSource.type,
      );
      // Sources will be updated automatically via Firestore listener
      setDescriptionDialogOpen(false);
      setEditingDescriptionSource(null);
      setDescriptionInput("");
      toast.success("Description updated successfully");
    } catch (error) {
      console.error("Failed to update source description:", error);
      toast.error("Failed to update source description");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete || !agentId || !teamId) return;

    const source = currentSources.find((s) => s.id === sourceToDelete.id);
    if (!source) return;

    try {
      if (source.type === "confluence_page") {
        const user = auth.currentUser;
        if (!user) {
          toast.error("User must be authenticated");
          return;
        }
        const pageId = source.page_id || source.confluence_page_id || source.id;
        const nickname = source.nickname || source.title || source.name || "";

        if (!pageId || !nickname) {
          toast.error("Missing Confluence page details");
          return;
        }

        const response = await fetch("/api/confluence/delete_page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.uid,
            agent_id: agentId,
            page_id: pageId,
            nickname,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete Confluence page: ${errorText}`);
        }
        const data = await response.json();
        if (data.status !== "success") {
          throw new Error(data.error || "Failed to delete Confluence page");
        }
      } else {
        await deleteSource(
          teamId,
          agentId,
          sourceToDelete.id,
          source.nickname || "",
          source.type || "",
        );
      }

      posthog?.capture("agent:source_deleted", {
        ...getAgentEventProps(),
        source_type: source.type || "",
        source_nickname: source.nickname || source.title || source.name || "",
      });

      // Sources will be updated automatically via Firestore listener
      toast.success("Source deleted successfully");
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    } catch (error) {
      console.error("Failed to delete source:", error);
      toast.error("Failed to delete source");
    }
  };

  const openMaximizeDialog = (box: "currentSources" | "addNewSources") => {
    setMaximizeDialog(box);
  };

  const toggleMemberSelection = (memberId: string) => {
    if (agentMemberIds.has(memberId)) {
      return;
    }
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
        setSelectedMemberRoles((roles) => {
          const nextRoles = { ...roles };
          delete nextRoles[memberId];
          return nextRoles;
        });
      } else {
        next.add(memberId);
        setSelectedMemberRoles((roles) => ({
          ...roles,
          [memberId]: "view",
        }));
      }
      return next;
    });
  };

  const handleInviteSelectedMembers = async () => {
    if (!teamId || !agentId) {
      return;
    }
    const selectedMembers = teamMembers.filter((member) =>
      selectedMemberIds.has(member.id),
    );
    const selectedPayload = selectedMembers
      .map((member) => ({
        email: member.email,
        permission: selectedMemberRoles[member.id] || "view",
      }))
      .filter((member) => Boolean(member.email)) as Array<{
      email: string;
      permission: string;
    }>;

    const membersPayload = selectedPayload;

    if (membersPayload.length === 0) {
      toast.error("Select at least one member to invite.");
      return;
    }

    try {
      setIsInvitingMembers(true);
      console.log("Agent members payload:", {
        teamId,
        agentId,
        agentName: agentName || "agent",
        members: membersPayload,
      });
      const response = await addAgentMembers(
        teamId,
        agentId,
        agentName || "agent",
        membersPayload,
      );
      console.log("Agent members response:", response);
      const failures = response.failures ?? [];
      if (failures.length === 0) {
        toast.success(`Added ${membersPayload.length} members!`);
      } else {
        const addedNo = Math.max(0, membersPayload.length - failures.length);
        toast.success(`Added ${addedNo} to agent.`);
        failures.forEach((failure) => {
          if (failure.email) {
            toast.error(`failed to add ${failure.email}`);
          }
        });
      }

      if (response.success) {
        const failureEmails = new Set(
          (response.failures ?? [])
            .map((failure) => failure.email)
            .filter(Boolean) as string[],
        );
        const memberByEmail = new Map(
          selectedMembers
            .filter((member) => member.email)
            .map((member) => [member.email as string, member]),
        );
        membersPayload
          .filter((member) => member.email && !failureEmails.has(member.email))
          .forEach((member) => {
            const memberInfo = memberByEmail.get(member.email);
            posthog?.capture("agent: updated_member_permission", {
              ...getAgentEventProps(),
              member_email: member.email,
              member_name: memberInfo?.displayName || "",
              member_role: member.permission,
            });
          });
        try {
          const refreshed = await listAgentMembers(teamId, agentId);
          if (refreshed.success) {
            setAgentMembers(
              refreshed.members.map((member, index) => ({
                id:
                  member.uid || member.id || member.email || `member-${index}`,
                displayName: member.displayName,
                email: member.email,
                role: member.role,
                permission: member.permission,
              })),
            );
            setAgentMemberIds(
              new Set(
                refreshed.members.map(
                  (member, index) =>
                    member.uid ||
                    member.id ||
                    member.email ||
                    `member-${index}`,
                ),
              ),
            );
          }
        } catch (error) {
          console.error("Failed to refresh agent members:", error);
        }
        setSelectedMemberIds(new Set());
        setAddMemberDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to invite members:", error);
      toast.error("Failed to invite members.");
    } finally {
      setIsInvitingMembers(false);
    }
  };

  const handleAgentRoleChange = async (
    memberId: string,
    email: string | undefined,
    permission: "view" | "edit" | "admin",
  ) => {
    if (!teamId || !agentId || !email) {
      return;
    }

    try {
      const response = await addAgentMembers(
        teamId,
        agentId,
        agentName || "agent",
        [{ email, permission }],
      );

      if (
        response.success &&
        (!response.failures || response.failures.length === 0)
      ) {
        setAgentMembers((prev) =>
          prev.map((member) =>
            member.id === memberId
              ? { ...member, permission, role: permission }
              : member,
          ),
        );
        const memberInfo = agentMembers.find((member) => member.id === memberId);
        posthog?.capture("agent: updated_member_permission", {
          ...getAgentEventProps(),
          member_email: email,
          member_name: memberInfo?.displayName || "",
          member_role: permission,
        });
        return;
      }

      if (response.failures?.length) {
        response.failures.forEach((failure) => {
          if (failure.email) {
            toast.error(`failed to add ${failure.email}`);
          }
        });
      }
    } catch (error) {
      console.error("Failed to update agent member role:", error);
      toast.error("Failed to update member role.");
    }
  };

  const closeMaximizeDialog = () => {
    setMaximizeDialog(null);
  };

  const handleSourceTypeClick = (sourceType: {
    name: string;
    type: string;
  }) => {
    setSelectedSourceType(sourceType);
    setAddNewSourceDialogOpen(true);
    // Reset form fields when opening dialog
    setWebsiteUrl("");
    setWebsiteNickname("");
    setSelectedFile(null);
    setDocumentNickname("");
    setDocumentDescription("");
    setIsDragging(false);
    setSelectedTableFile(null);
    setTableNickname("");
    setIsDraggingTable(false);
    // Reset Jira search state
    setJiraSearchInput("");
    setJiraSearchResults([]);
    setIsSearchingJira(false);
    setSelectedJiraTickets(new Set());
    // Reset Confluence search state
    setConfluenceSearchInput("");
    setConfluenceCQLInput("");
    setConfluenceSearchTab("query");
    setConfluenceSearchResults([]);
    setIsSearchingConfluence(false);
    setSelectedConfluencePages(new Set());
    // Reset Slack search state
    setSlackSearchInput("");
    setAllSlackChannels([]);
    setIsLoadingSlackChannels(false);
    setSelectedSlackChannels(new Set());
    setSlackTeamId(null);
    setSyncingChannels(new Set());
  };

  const closeAddNewSourceDialog = () => {
    setAddNewSourceDialogOpen(false);
    setSelectedSourceType(null);
    // Reset form fields when closing
    setWebsiteUrl("");
    setWebsiteNickname("");
    setSelectedFile(null);
    setDocumentNickname("");
    setDocumentDescription("");
    setIsDragging(false);
    setSelectedTableFile(null);
    setTableNickname("");
    setIsDraggingTable(false);
    // Reset table analysis state
    setTableAnalysisResponse(null);
    setTableSourcePendingReview(null);
    // Reset column types state
    setColumnTypes({});
    setColumnTypesAgentSourceId(null);
    setColumnTypesDialogOpen(false);
    // Reset Jira search state
    setJiraSearchInput("");
    setJiraSearchResults([]);
    setIsSearchingJira(false);
    setSelectedJiraTickets(new Set());
    setHasJiraSource(false);
    // Reset Confluence search state
    setConfluenceSearchInput("");
    setConfluenceCQLInput("");
    setConfluenceSearchTab("query");
    setConfluenceSearchResults([]);
    setIsSearchingConfluence(false);
    setSelectedConfluencePages(new Set());
    setHasConfluenceSource(false);
    // Reset Slack search state
    setSlackSearchInput("");
    setAllSlackChannels([]);
    setIsLoadingSlackChannels(false);
    setSelectedSlackChannels(new Set());
    setHasSlackSource(false);
    setSlackTeamId(null);
    setSyncingChannels(new Set());
    // setBatchId(null);
    setBatchQueueItems([]);
  };

  const handleAddWebsiteSource = async () => {
    if (!websiteUrl.trim() || !websiteNickname.trim() || !agentId || !teamId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    try {
      await addAgentSource(
        teamId,
        agentId,
        websiteNickname.trim(),
        "website",
        websiteUrl.trim(),
      );
      posthog?.capture("agent:add_source_website", getAgentEventProps());

      // Sources will be updated automatically via Firestore listener
      // Close the dialog and reset form
      closeAddNewSourceDialog();

      // Upload website URLs (non-blocking)
      const user = auth.currentUser;
      if (user && agentId) {
        uploadWebsiteToPinecone(user.uid, agentId, [
          {
            url: websiteUrl.trim(),
            nickname: websiteNickname.trim(),
          },
        ]).catch((error) => {
          console.error(
            "Failed to upload website URLs (non-blocking):",
            error,
          );
        });
      }
    } catch (error) {
      console.error("Failed to add website source:", error);
      toast.error("Failed to add website source");
    } finally {
      setIsAddSourcePreparing(false);
    }
  };

  const handleDeleteJiraTicketConfirm = async () => {
    if (!ticketToDelete || !agentId || !teamId) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    setIsDeletingTicket(true);

    try {
      const teamSnap = await getDoc(doc(db, "teams", teamId));
      if (!teamSnap.exists()) {
        throw new Error("Team not found");
      }

      const teamData = teamSnap.data();
      const namespace = teamData.pinecone_namespace as string | undefined;
      if (!namespace) {
        throw new Error("pinecone_namespace not found");
      }

      if (!ticketToDelete.id) {
        throw new Error("Jira ticket ID is required");
      }

      const response = await fetch("/api/jira/delete_ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          jira_id: ticketToDelete.id,
          namespace,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete Jira ticket: ${errorText}`);
      }

      const data = await response.json();
      if (data.status !== "success") {
        throw new Error(data.error || "Failed to delete Jira ticket");
      }

      toast.success("Jira ticket deleted successfully");
      setDeleteTicketDialogOpen(false);
      setTicketToDelete(null);
    } catch (error) {
      console.error("Failed to delete Jira ticket:", error);
      toast.error("Failed to delete Jira ticket");
    } finally {
      setIsDeletingTicket(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    // Auto-populate nickname with filename (without extension) if nickname is empty
    if (!documentNickname.trim()) {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setDocumentNickname(fileNameWithoutExt);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleAddDocumentSource = async () => {
    if (!documentNickname.trim() || !agentId || !teamId) {
      toast.error("Please enter a nickname");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    try {
      // Upload file to Firebase Storage
      const filePath = await uploadSourceFile(
        selectedFile,
        documentNickname.trim(),
        undefined,
        agentId,
      );

      // Add source with file path
      const fileName = selectedFile.name;
      await addAgentSource(
        teamId,
        agentId,
        documentNickname.trim(),
        "document",
        fileName,
        filePath,
        documentDescription.trim() || undefined,
      );
      posthog?.capture("agent:add_source_document", getAgentEventProps());

      // Sources will be updated automatically via Firestore listener
      // Close the dialog and reset form
      closeAddNewSourceDialog();
    } catch (error) {
      console.error("Failed to add document source:", error);
      toast.error("Failed to add document source");
    } finally {
      setIsAddSourcePreparing(false);
    }
  };

  // Helper function to validate table file type
  const isValidTableFile = (file: File): boolean => {
    const validExtensions = [".csv", ".xlsx", ".tsv"];
    const fileName = file.name.toLowerCase();
    return validExtensions.some((ext) => fileName.endsWith(ext));
  };

  const handleTableFileSelect = (file: File) => {
    if (!isValidTableFile(file)) {
      toast.error(
        "Wrong file type. Please upload a .csv, .xlsx, or .tsv file.",
      );
      return;
    }
    setSelectedTableFile(file);
    // Auto-populate nickname with filename (without extension) if nickname is empty
    if (!tableNickname.trim()) {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTableNickname(fileNameWithoutExt);
    }
  };

  const handleTableFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleTableFileSelect(file);
    }
  };

  const handleTableDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTable(true);
  };

  const handleTableDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTable(false);
  };

  const handleTableDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTable(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleTableFileSelect(file);
    }
  };

  const handleAddTableSource = async () => {
    if (!tableNickname.trim() || !agentId || !teamId) {
      toast.error("Please enter a nickname");
      return;
    }

    if (!selectedTableFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    try {
      // Convert to CSV if needed (xlsx, tsv -> csv)
      const csvFile = await convertToCSV(selectedTableFile);

      // Upload file to Firebase Storage (now as CSV)
      const filePath = await uploadSourceFile(
        csvFile,
        tableNickname.trim(),
        "table",
        agentId,
      );

      // Add source with file path - capture the document ID
      // Use original filename for display, but filePath points to CSV
      const fileName = selectedTableFile.name;
      const agentSourceId = await addAgentSource(
        teamId,
        agentId,
        tableNickname.trim(),
        "table",
        fileName,
        filePath,
      );
      posthog?.capture("agent:add_source_table", getAgentEventProps());

      // Get user ID for API call
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated");
      }

      // Call backend to analyze the table (ONLY for table sources)
      try {
        const analysisResponse = await analyzeTable(
          user.uid,
          teamId,
          agentId,
          agentSourceId,
        );
        setTableAnalysisResponse(analysisResponse);
        console.log("=== Table Analysis Response ===");
        console.log(JSON.stringify(analysisResponse, null, 2));
        console.log("===============================");

        // Check row count and handle warnings/errors
        if (analysisResponse.row_count > 1000000) {
          // File is too big - set up for deletion
          setTableSourcePendingReview({
            agentSourceId,
            nickname: tableNickname.trim(),
            filePath,
            rowCount: analysisResponse.row_count,
          });
          // Don't close dialog - show error UI
          return;
        } else if (analysisResponse.row_count > 200000) {
          // Warning - file may take longer
          setTableSourcePendingReview({
            agentSourceId,
            nickname: tableNickname.trim(),
            filePath,
            rowCount: analysisResponse.row_count,
          });
          // Don't close dialog - show warning UI
          return;
        }

        // Row count is acceptable - prepare column types for confirmation
        const mappedColumns: Record<
          string,
          {
            pandas_dtype: string;
            type: string;
            canon_dtype: string;
            example_values: any[];
          }
        > = {};
        Object.entries(analysisResponse.columns).forEach(
          ([columnName, columnData]) => {
            mappedColumns[columnName] = {
              ...columnData,
              canon_dtype: mapBackendTypeTocanon_dtype(
                columnData.type,
                columnData.pandas_dtype,
              ),
            };
          },
        );
        setColumnTypes(mappedColumns);
        setColumnTypesAgentSourceId(agentSourceId);
        setColumnTypesDialogOpen(true);
        // Don't close the add source dialog yet - wait for column confirmation
        return;
      } catch (error) {
        console.error("Failed to analyze table:", error);
        // Don't block the flow if analysis fails
        toast.error("Table uploaded but analysis failed");
      }

      // If we get here, row count is acceptable - proceed normally
      // Sources will be updated automatically via Firestore listener
      // Close the dialog and reset form
      closeAddNewSourceDialog();
    } catch (error) {
      console.error("Failed to add table source:", error);
      toast.error("Failed to add table source");
    } finally {
      setIsAddSourcePreparing(false);
    }
  };

  const handleDeleteTableSource = async () => {
    if (!tableSourcePendingReview || !agentId || !teamId) return;

    try {
      await deleteTableSource(
        teamId,
        agentId,
        tableSourcePendingReview.agentSourceId,
        tableSourcePendingReview.nickname,
        tableSourcePendingReview.filePath,
      );

      posthog?.capture("agent:source_deleted", {
        ...getAgentEventProps(),
        source_type: "table",
        source_nickname: tableSourcePendingReview.nickname,
      });

      // Reset state and close dialog
      setTableSourcePendingReview(null);
      setTableAnalysisResponse(null);
      closeAddNewSourceDialog();
      toast.success("Table source deleted");
    } catch (error) {
      console.error("Failed to delete table source:", error);
      toast.error("Failed to delete table source");
    }
  };

  const handleConfirmTableSource = async () => {
    if (!tableSourcePendingReview || !agentId || !tableAnalysisResponse) return;

    // User confirmed - prepare column types for confirmation
    const mappedColumns: Record<
      string,
      {
        pandas_dtype: string;
        type: string;
        canon_dtype: string;
        example_values: any[];
      }
    > = {};
    Object.entries(tableAnalysisResponse.columns).forEach(
      ([columnName, columnData]) => {
        mappedColumns[columnName] = {
          ...columnData,
          canon_dtype: mapBackendTypeTocanon_dtype(
            columnData.type,
            columnData.pandas_dtype,
          ),
        };
      },
    );
    setColumnTypes(mappedColumns);
    setColumnTypesAgentSourceId(tableSourcePendingReview.agentSourceId);
    setTableSourcePendingReview(null);
    setColumnTypesDialogOpen(true);
    // Don't close the add source dialog yet - wait for column confirmation
  };

  const handleColumnTypeChange = (
    columnName: string,
    newcanon_dtype: string,
  ) => {
    setColumnTypes((prev) => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        canon_dtype: newcanon_dtype,
      },
    }));
  };

  const handleSaveColumnTypes = async () => {
    if (!columnTypesAgentSourceId || !agentId || !teamId) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated");
      }

      // Prepare column metadata for storage
      const columnMetadata: Record<
        string,
        {
          pandas_dtype: string;
          type: string;
          canon_dtype: string;
          example_values: any[];
        }
      > = {};
      Object.entries(columnTypes).forEach(([columnName, columnData]) => {
        columnMetadata[columnName] = {
          pandas_dtype: columnData.pandas_dtype,
          type: columnData.type,
          canon_dtype: columnData.canon_dtype,
          example_values: columnData.example_values || [],
        };
      });

      // Update agent's source document
      const agentSourceRef = doc(
        db,
        "teams",
        teamId,
        "agents",
        agentId,
        "sources",
        columnTypesAgentSourceId,
      );
      await updateDoc(agentSourceRef, {
        columnMetadata: columnMetadata,
        updatedAt: serverTimestamp(),
      });

      // Also update user's source document
      const userSourcesRef = collection(db, "teams", teamId, "sources");
      const querySnapshot = await getDocs(
        query(userSourcesRef, where("type", "==", "table")),
      );

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const agentsArray = data.agents || [];
        if (agentsArray.includes(agentId)) {
          const userSourceRef = doc(db, "teams", teamId, "sources", docSnap.id);
          await updateDoc(userSourceRef, {
            columnMetadata: columnMetadata,
            updatedAt: serverTimestamp(),
          });
          break;
        }
      }

      // Sources will be updated automatically via Firestore listener
      setColumnTypesDialogOpen(false);
      setColumnTypes({});
      setColumnTypesAgentSourceId(null);

      // Only close the "add new source" dialog if it's open (i.e., we're adding a new source)
      if (addNewSourceDialogOpen) {
        closeAddNewSourceDialog();
      } else {
        // We're updating an existing source
        toast.success("Column metadata saved successfully");
      }
    } catch (error) {
      console.error("Failed to save column types:", error);
      toast.error("Failed to save column types");
    }
  };

  const handleOpenColumnTypesForSource = async (sourceId: string) => {
    if (!agentId || !teamId) {
      toast.error("Team ID is required");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated");
      }

      // Call analyzeTable to get column metadata
      const analysisResponse = await analyzeTable(
        user.uid,
        teamId,
        agentId,
        sourceId,
      );

      // Prepare column types for confirmation
      const mappedColumns: Record<
        string,
        {
          pandas_dtype: string;
          type: string;
          canon_dtype: string;
          example_values: any[];
        }
      > = {};
      Object.entries(analysisResponse.columns).forEach(
        ([columnName, columnData]) => {
          mappedColumns[columnName] = {
            ...columnData,
            canon_dtype: mapBackendTypeTocanon_dtype(
              columnData.type,
              columnData.pandas_dtype,
            ),
          };
        },
      );
      setColumnTypes(mappedColumns);
      setColumnTypesAgentSourceId(sourceId);
      setColumnTypesDialogOpen(true);
    } catch (error) {
      console.error("Failed to analyze table for source:", error);
      toast.error("Failed to load column metadata");
    }
  };

  const handleJiraSearch = async () => {
    if (!jiraSearchInput.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    try {
      setIsSearchingJira(true);
      const response = await fetch("/api/jira/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.uid,
          search_type: "query",
          search_input: jiraSearchInput.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to search Jira: ${errorText}`);
      }

      const data = await response.json();
      if (data.status === "success" && data.data) {
        setJiraSearchResults(data.data);
        // Clear selections when new search results come in
        setSelectedJiraTickets(new Set());
      } else {
        setJiraSearchResults([]);
        toast.error("No results found");
      }
    } catch (error) {
      console.error("Error searching Jira:", error);
      toast.error("Failed to search Jira");
      setJiraSearchResults([]);
    } finally {
      setIsSearchingJira(false);
    }
  };

  const handleToggleJiraTicket = (issueKey: string) => {
    setSelectedJiraTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(issueKey)) {
        newSet.delete(issueKey);
      } else {
        newSet.add(issueKey);
      }
      return newSet;
    });
  };

  const handleAddJiraTickets = async () => {
    if (selectedJiraTickets.size === 0 || !agentId) {
      toast.error("Please select at least one ticket");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }
    if (!teamId) {
      toast.error("Team ID is required");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    try {
      // Get the selected tickets data
      const selectedTickets = jiraSearchResults.filter((issue) =>
        selectedJiraTickets.has(issue.key),
      );

      // Create ticket objects
      const newTicketsArray = selectedTickets.map((issue) => ({
        key: issue.key,
        id: issue.id,
        summary: issue.fields.summary,
        project: {
          key: issue.fields.project.key,
          name: issue.fields.project.name,
        },
        status: issue.fields.status.name,
        issuetype: issue.fields.issuetype.name,
        assignee: issue.fields.assignee
          ? {
              displayName: issue.fields.assignee.displayName,
              accountId: issue.fields.assignee.accountId,
            }
          : null,
        created: issue.fields.created,
        self: issue.self,
      }));

      const response = await fetch("/api/jira/add_ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          tickets: newTicketsArray,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add Jira tickets: ${errorText}`);
      }

      const data = await response.json();
      if (data.status !== "success") {
        throw new Error(data.error || "Failed to add Jira tickets");
      }

      posthog?.capture("agent:add_source_jira", getAgentEventProps());

      // Sources will be updated automatically via Firestore listener
      setHasJiraSource(true);

      // Clear selections and search results
      setSelectedJiraTickets(new Set());
      setJiraSearchResults([]);
      setJiraSearchInput("");

    } catch (error) {
      console.error("Failed to add Jira tickets:", error);
      toast.error("Failed to add Jira tickets");
    } finally {
      setIsAddSourcePreparing(false);
    }
  };

  const handleConfluenceSearch = async () => {
    if (confluenceSearchTab === "spaces") {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    const searchInput =
      confluenceSearchTab === "query"
        ? confluenceSearchInput.trim()
        : confluenceCQLInput.trim();

    if (!searchInput) {
      toast.error(
        confluenceSearchTab === "query"
          ? "Please enter a search query"
          : "Please enter a CQL query",
      );
      return;
    }

    try {
      setIsSearchingConfluence(true);

      const normalizedQuery =
        confluenceSearchTab === "query"
          ? `text ~ "${searchInput.replace(/"/g, '\\"')}"`
          : searchInput;

      // Call CQL search endpoint
      const response = await fetch(
        `/api/confluence/search?user_id=${user.uid}&query=${encodeURIComponent(normalizedQuery)}&limit=10`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to search Confluence: ${errorText}`);
      }

      const data = await response.json();
      if (data.status === "success" && data.results) {
        // Map results to include id and title for consistency
        const mappedResults = data.results.map((result: any) => ({
          id: result.content?.id || result.id,
          title: result.title || result.content?.title,
          tinyui_path: result.content?._links?.tinyui || null,
          ...result, // Include all other fields
        }));
        setConfluenceSearchResults(mappedResults);
      } else {
        setConfluenceSearchResults([]);
        toast.error("No results found");
      }
    } catch (error) {
      console.error("Error searching Confluence:", error);
      toast.error("Failed to search Confluence");
      setConfluenceSearchResults([]);
    } finally {
      setIsSearchingConfluence(false);
    }
  };

  const renderConfluencePageList = (pages: any[]) => (
    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
      {pages.map((page: any) => (
        <div
          key={page.id}
          className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
            selectedConfluencePages.has(page.id)
              ? "border-primary bg-primary/5"
              : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1">
              <input
                type="checkbox"
                checked={selectedConfluencePages.has(page.id)}
                onChange={() => handleToggleConfluencePage(page.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div
                className="flex-1 cursor-pointer"
                onClick={() => handleConfluencePageClick(page)}
              >
                <p className="text-sm font-medium hover:underline">
                  {page.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const getFilteredConfluencePages = (spaceId: string, pages: any[]) => {
    const searchValue = confluenceSpaceSearches[spaceId]?.trim().toLowerCase();
    if (!searchValue) {
      return pages;
    }

    return pages.filter((page) =>
      (page.title || "").toLowerCase().includes(searchValue),
    );
  };

  const buildConfluenceUrl = (tinyuiPath: string | null): string | null => {
    if (!tinyuiPath || !jiraSiteUrl) {
      return null;
    }
    return `${jiraSiteUrl}/wiki${tinyuiPath}`;
  };

  const buildSlackChannelUrl = (
    teamId: string | null,
    channelId: string,
  ): string | null => {
    if (!teamId || !channelId) {
      return null;
    }
    return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
  };

  const handleConfluencePageClick = (page: any) => {
    const tinyuiPath = page.tinyui_path || page.content?._links?.tinyui;
    const url = buildConfluenceUrl(tinyuiPath);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggleConfluencePage = (pageId: string) => {
    setSelectedConfluencePages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleClearConfluenceSelection = () => {
    setSelectedConfluencePages(new Set());
  };

  const handleAddConfluencePages = async () => {
    if (selectedConfluencePages.size === 0 || !agentId) {
      toast.error("Please select at least one page");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    try {
      const allPages = [
        ...confluenceSearchResults,
        ...confluenceSpaces.flatMap((space) => space.pages || []),
      ];
      const pagesById = new Map<string, any>();
      for (const page of allPages) {
        if (page?.id && !pagesById.has(page.id)) {
          pagesById.set(page.id, page);
        }
      }

      const selectedPages = Array.from(selectedConfluencePages)
        .map((id) => pagesById.get(id))
        .filter(Boolean);

      const pagesPayload = selectedPages.map((page) => {
        const tinyuiPath =
          page.tinyui_path ||
          page._links?.tinyui ||
          page.content?._links?.tinyui;
        const rawUrl = page.url || page._links?.webui || page.content?._links?.webui;
        const resolvedUrl =
          typeof rawUrl === "string" && rawUrl.startsWith("http")
            ? rawUrl
            : typeof rawUrl === "string" && jiraSiteUrl
              ? `${jiraSiteUrl}/wiki${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
              : buildConfluenceUrl(tinyuiPath) || undefined;
        const excerpt = typeof page.excerpt === "string" ? page.excerpt : undefined;
        return {
          id: page.id,
          title: page.title,
          tinyui_path: tinyuiPath || undefined,
          excerpt,
          url: resolvedUrl,
        };
      });

      console.log("Confluence add_pages payload:", {
        user_id: user.uid,
        agent_id: agentId,
        pages: pagesPayload,
      });

      const response = await fetch("/api/confluence/add_pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          pages: pagesPayload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add Confluence pages: ${errorText}`);
      }

      const data = await response.json();
      if (data.status !== "success") {
        throw new Error(data.error || "Failed to add Confluence pages");
      }

      posthog?.capture("agent:add_source_confluence", getAgentEventProps());

      // Sources will be updated automatically via Firestore listener
      setHasConfluenceSource(true);

      // Clear selections and search results
      setSelectedConfluencePages(new Set());
      setConfluenceSearchResults([]);
      setConfluenceSearchInput("");
      setConfluenceCQLInput("");

    } catch (error) {
      console.error("Failed to add Confluence pages:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add Confluence pages",
      );
    } finally {
      setIsAddSourcePreparing(false);
    }
  };

  const handleDeleteConfluencePage = async (page: any) => {
    const user = auth.currentUser;
    if (!user || !agentId) {
      toast.error("User and agent required to delete a page");
      return;
    }

    const pageId = page?.id || page?.page_id || page?.sourceId;
    const nickname = page?.nickname || page?.title || page?.name;

    if (!pageId || !nickname) {
      toast.error("Missing Confluence page details");
      return;
    }

    try {
      const response = await fetch("/api/confluence/delete_page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          page_id: pageId,
          nickname,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete Confluence page: ${errorText}`);
      }

      const data = await response.json();
      if (data.status !== "success") {
        throw new Error(data.error || "Failed to delete Confluence page");
      }

      posthog?.capture("agent:source_deleted", {
        ...getAgentEventProps(),
        source_type: "confluence_page",
        source_nickname: nickname,
      });

      toast.success("Confluence page deleted successfully");
    } catch (error) {
      console.error("Failed to delete Confluence page:", error);
      toast.error("Failed to delete Confluence page");
    }
  };

  const handleToggleSlackChannel = (channelId: string) => {
    setSelectedSlackChannels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  };

  const handleSlackChannelClick = (channel: any) => {
    const url = buildSlackChannelUrl(slackTeamId, channel.id);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleSyncSlackChannel = async (
    channelId: string,
    channelName: string,
  ) => {
    if (!agentId) {
      toast.error("Agent ID is required");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    // Add channel to syncing set
    setSyncingChannels((prev) => new Set(prev).add(channelId));

    try {
      const response = await fetch("/api/slack/add_channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          agent_id: agentId,
          channels: [
            {
              channel_id: channelId,
              channel_name: channelName,
              nickname: channelName,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sync channel: ${errorText}`);
      }

      const data = await response.json();
      if (data?.ok === false) {
        throw new Error(data.error || "Sync failed");
      }
      if (data.ok || data.status === "success" || data.success) {
        // Sources will be updated automatically via Firestore listener
      } else {
        throw new Error(data?.error || "Sync failed");
      }
    } catch (error) {
      console.error("Error syncing Slack channel:", error);
      toast.error(
        `Failed to sync channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Remove channel from syncing set
      setSyncingChannels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const handleSyncChannelTranscript = async (
    channelId: string,
    channelName: string,
    batchId?: string,
  ) => {
    if (!agentId) {
      toast.error("Agent ID is required");
      return;
    }

    if (!batchId) {
      toast.error("Batch ID is required");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    // Add channel to syncing set
    setSyncingChannels((prev) => new Set(prev).add(channelId));

    try {
      const response = await fetch(`/api/slack/batch_channel_retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          agent_id: agentId,
          channel_id: channelId,
          channel_name: channelName,
          batch_id: batchId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sync channel: ${errorText}`);
      }

      const data = await response.json();
      if (data.ok) {
        // Sources will be updated automatically via Firestore listener
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      console.error("Error syncing Slack channel transcript:", error);
      toast.error(
        `Failed to sync channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Remove channel from syncing set
      setSyncingChannels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const handleClearSlackSelection = () => {
    setSelectedSlackChannels(new Set());
  };

  const handleAddSlackChannels = async () => {
    if (selectedSlackChannels.size === 0 || !agentId) {
      toast.error("Please select at least one channel");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("User must be authenticated");
      return;
    }

    setIsAddSourcePreparing(true);
    await delay(2000);

    setIsStartingBatch(true);

    try {
      // Get the selected channels data
      const selectedChannels = allSlackChannels.filter((channel) =>
        selectedSlackChannels.has(channel.id),
      );

      // Get team_id from Firebase if not already in state
      let slackTeamIdFromInstall = slackTeamId;
      if (!slackTeamIdFromInstall) {
        if (!teamId) {
          throw new Error("Team ID not found");
        }
        const slackInstallationsRef = collection(
          db,
          "teams",
          teamId,
          "users",
          user.uid,
          "slack_installations",
        );
        const slackInstallationsSnapshot = await getDocs(slackInstallationsRef);

        if (!slackInstallationsSnapshot.empty) {
          const firstDoc = slackInstallationsSnapshot.docs[0];
          const data = firstDoc.data();
          slackTeamIdFromInstall =
            data.slack_team_id ||
            data.slack_team?.id ||
            data.team_id ||
            data.team?.id ||
            null;
        }

        if (!slackTeamIdFromInstall) {
          throw new Error("Team ID not found");
        }
      }

      if (!teamId) {
        throw new Error("Team ID not found");
      }

      // Map channels to the format required by the API
      const channelsForApi = selectedChannels.map((channel) => ({
        channel_id: channel.id,
        channel_name: channel.name,
        nickname: channel.name,
      }));

      // Call the add channels endpoint
      const response = await startSlackBatchSync(
        user.uid,
        agentId,
        channelsForApi,
      );

      if (response?.batch_id) {
        // Store batch_id in state
        setBatchId(response.batch_id);

        // Optimistically add channels to batchQueueItems immediately
        // This ensures the UI updates right away, before Firestore listener picks it up
        const optimisticQueueItems = selectedChannels.map((channel) => ({
          channel_id: channel.id,
          channel_name: channel.name,
          status: "queued",
          team_id: slackTeamIdFromInstall!,
          batch_id: response.batch_id,
        }));

        setBatchQueueItems((prev) => {
          // Combine with existing items, avoiding duplicates
          const existingChannelIds = new Set(
            prev.map((item) => item.channel_id),
          );
          const newItems = optimisticQueueItems.filter(
            (item) => !existingChannelIds.has(item.channel_id),
          );
          return [...prev, ...newItems];
        });
      }

      posthog?.capture("agent:add_source_slack", getAgentEventProps());

      // Sources will be updated automatically via Firestore listener
      // Close the dialog after starting the batch sync
      closeAddNewSourceDialog();
    } catch (error) {
      console.error("Failed to add Slack channels:", error);
      toast.error("Failed to add Slack channels");
    } finally {
      setIsStartingBatch(false);
      setIsAddSourcePreparing(false);
    }
  };

  // Handle Escape key to close dialogs
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (maximizeDialog) {
          closeMaximizeDialog();
        }
        if (addNewSourceDialogOpen) {
          closeAddNewSourceDialog();
        }
      }
    };

    if (maximizeDialog || addNewSourceDialogOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [maximizeDialog, addNewSourceDialogOpen]);

  // Listen to sources from Firestore in real-time
  useEffect(() => {
    if (!agentId || !teamId) {
      setCurrentSources([]);
      setIsLoadingSources(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setCurrentSources([]);
      setIsLoadingSources(false);
      return;
    }

    try {
      setIsLoadingSources(true);
      const sourcesRef = collection(
        db,
        "teams",
        teamId,
        "agents",
        agentId,
        "sources",
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        sourcesRef,
        (snapshot) => {
          const sources: Source[] = [];
          snapshot.forEach((doc) => {
            sources.push({
              id: doc.id,
              ...doc.data(),
            } as Source);
          });
          setCurrentSources(sources);
          setIsLoadingSources(false);
        },
        (error) => {
          console.error("Error listening to sources:", error);
          setIsLoadingSources(false);
          setCurrentSources([]);
        },
      );

      // Cleanup listener on unmount or when agentId changes
      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error("Error setting up sources listener:", error);
      setIsLoadingSources(false);
      setCurrentSources([]);
    }
  }, [agentId, teamId]);

  useEffect(() => {
    const fetchRatings = async () => {
      const user = auth.currentUser;
      if (!user || !agentId || !teamId) {
        setRatingStats(null);
        setRatingStatsLoading(false);
        return;
      }

      setRatingStatsLoading(true);
      try {
        const ratingsRef = collection(
          db,
          "teams",
          teamId,
          "agents",
          agentId,
          "ratings",
        );
        const snap = await getDocs(ratingsRef);
        const ratingDocs = snap.docs.map((doc) => doc.data() as RatingDoc);
        const computedStats = computeRatingAnalytics(ratingDocs);
        setRatingStats(computedStats);
      } catch (err) {
        console.error("Failed to load rating analytics", err);
        setRatingStats(null);
      } finally {
        setRatingStatsLoading(false);
      }
    };

    fetchRatings();
  }, [agentId, teamId]);

  // Check for Jira access token and existing Jira source when Jira dialog opens
  useEffect(() => {
    const checkJiraAccessToken = async () => {
      // Only check when Jira dialog is open
      if (!addNewSourceDialogOpen || selectedSourceType?.type !== "jira") {
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) {
          setHasJiraAccessToken(false);
          setHasJiraSource(false);
          return;
        }
        if (!teamId) {
          setHasJiraAccessToken(false);
          setHasJiraSource(false);
          return;
        }

        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          setHasJiraAccessToken(!!teamData.jira_access_token);
        } else {
          setHasJiraAccessToken(false);
        }

        // Check if there's already a Jira source in the agent's sources
        if (agentId && teamId) {
          const sources = await getAgentSources(teamId, agentId);
          const hasJira = sources.some((source) => source.type === "jira");
          setHasJiraSource(hasJira);
        } else {
          setHasJiraSource(false);
        }
      } catch (error) {
        console.error("Error checking Jira access token:", error);
        setHasJiraAccessToken(false);
        setHasJiraSource(false);
      }
    };

    checkJiraAccessToken();
  }, [addNewSourceDialogOpen, selectedSourceType, agentId]);

  // Check for Confluence access token and existing Confluence source when Confluence dialog opens
  useEffect(() => {
    const checkConfluenceAccessToken = async () => {
      // Only check when Confluence dialog is open
      if (
        !addNewSourceDialogOpen ||
        selectedSourceType?.type !== "confluence"
      ) {
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) {
          setHasConfluenceAccessToken(false);
          setHasConfluenceSource(false);
          return;
        }
        if (!teamId) {
          setHasConfluenceAccessToken(false);
          setHasConfluenceSource(false);
          setJiraSiteUrl(null);
          return;
        }

        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          setHasConfluenceAccessToken(!!teamData.jira_access_token);
          setJiraSiteUrl(teamData.jira_site_url || null);
        } else {
          setHasConfluenceAccessToken(false);
          setJiraSiteUrl(null);
        }

        // Check if there's already a Confluence source in the agent's sources
        if (agentId && teamId) {
          const sources = await getAgentSources(teamId, agentId);
          const hasConfluence = sources.some(
            (source) =>
              source.type === "jira" || source.type === "confluence_page",
          );
          setHasConfluenceSource(hasConfluence);
        } else {
          setHasConfluenceSource(false);
        }
      } catch (error) {
        console.error("Error checking Confluence access token:", error);
        setHasConfluenceAccessToken(false);
        setHasConfluenceSource(false);
      }
    };

    checkConfluenceAccessToken();
  }, [addNewSourceDialogOpen, selectedSourceType, agentId]);

  useEffect(() => {
    const fetchConfluenceSpaces = async () => {
      if (
        !addNewSourceDialogOpen ||
        selectedSourceType?.type !== "confluence" ||
        confluenceSearchTab !== "spaces"
      ) {
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        return;
      }

      try {
        setIsLoadingConfluenceSpaces(true);
        const response = await fetch(
          `/api/confluence/spaces?user_id=${user.uid}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch Confluence spaces: ${errorText}`);
        }

        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.spaces)) {
          setConfluenceSpaces(
            data.spaces.map((space: any) => ({
              id: space.id || space.key,
              name: space.name,
              pages: [],
            })),
          );
        } else {
          setConfluenceSpaces([]);
        }
      } catch (error) {
        console.error("Error fetching Confluence spaces:", error);
        toast.error("Failed to load Confluence spaces");
        setConfluenceSpaces([]);
      } finally {
        setIsLoadingConfluenceSpaces(false);
      }
    };

    fetchConfluenceSpaces();
  }, [addNewSourceDialogOpen, confluenceSearchTab, selectedSourceType]);

  useEffect(() => {
    const fetchConfluencePages = async () => {
      if (
        !addNewSourceDialogOpen ||
        selectedSourceType?.type !== "confluence" ||
        confluenceSearchTab !== "spaces" ||
        !openConfluenceSpaceId
      ) {
        return;
      }

      const space = confluenceSpaces.find(
        (item) => item.id === openConfluenceSpaceId,
      );
      if (!space || space.pages.length > 0) {
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        return;
      }

      try {
        setLoadingConfluencePagesBySpace((prev) => ({
          ...prev,
          [openConfluenceSpaceId]: true,
        }));

        const response = await fetch(
          `/api/confluence/pages?user_id=${user.uid}&space_id=${openConfluenceSpaceId}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch Confluence pages: ${errorText}`);
        }

        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.pages)) {
          setConfluenceSpaces((prev) =>
            prev.map((item) =>
              item.id === openConfluenceSpaceId
                ? { ...item, pages: data.pages }
                : item,
            ),
          );
        }
      } catch (error) {
        console.error("Error fetching Confluence pages:", error);
        toast.error("Failed to load Confluence pages");
      } finally {
        setLoadingConfluencePagesBySpace((prev) => ({
          ...prev,
          [openConfluenceSpaceId]: false,
        }));
      }
    };

    fetchConfluencePages();
  }, [
    addNewSourceDialogOpen,
    confluenceSearchTab,
    selectedSourceType,
    openConfluenceSpaceId,
    confluenceSpaces,
  ]);

  // Check for Slack installation and fetch channels when Slack dialog opens
  useEffect(() => {
    const checkSlackInstallation = async () => {
      // Only check when Slack dialog is open
      if (!addNewSourceDialogOpen || selectedSourceType?.type !== "slack") {
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) {
          setHasSlackInstallation(false);
          setHasSlackSource(false);
          return;
        }
        if (!teamId) {
          setHasSlackInstallation(false);
          setHasSlackSource(false);
          return;
        }

        // Check if there's a Slack installation by querying slack_installations subcollection
        const slackInstallationsRef = collection(
          db,
          "teams",
          teamId,
          "users",
          user.uid,
          "slack_installations",
        );
        const slackInstallationsSnapshot = await getDocs(slackInstallationsRef);

        let hasBotToken = false;
        let slackTeamIdFromInstall: string | null = null;

        // Get the first document to extract team_id
        if (!slackInstallationsSnapshot.empty) {
          const firstDoc = slackInstallationsSnapshot.docs[0];
          const data = firstDoc.data();
          if (data.slack_bot_token || data.bot_token) {
            hasBotToken = true;
          }
          // Extract team_id from slack_team object or slack_team_id field
          slackTeamIdFromInstall =
            data.slack_team_id || data.slack_team?.id || null;
        }

        setHasSlackInstallation(hasBotToken);
        setSlackTeamId(slackTeamIdFromInstall);

        // Check if there's already a Slack source in the agent's sources
        if (agentId && teamId) {
          const sources = await getAgentSources(teamId, agentId);
          // Sources are already being updated via Firestore listener, no need to setCurrentSources
          const hasSlack = sources.some(
            (source) => source.type === "slack_channel",
          );
          setHasSlackSource(hasSlack);
        } else {
          setHasSlackSource(false);
        }

        // If Slack is installed, fetch channels
        if (hasBotToken) {
          setIsLoadingSlackChannels(true);
          try {
            const response = await fetch(
              `/api/slack/list_channels?uid=${encodeURIComponent(user.uid)}`,
            );

            if (!response.ok) {
              throw new Error(
                `Failed to fetch Slack channels: ${response.statusText}`,
              );
            }

            const data = await response.json();
            if (data.ok && data.channels) {
              setAllSlackChannels(data.channels);
            } else {
              setAllSlackChannels([]);
            }
          } catch (error) {
            console.error("Error fetching Slack channels:", error);
            setAllSlackChannels([]);
            toast.error("Failed to fetch Slack channels");
          } finally {
            setIsLoadingSlackChannels(false);
          }
        }
      } catch (error) {
        console.error("Error checking Slack installation:", error);
        setHasSlackInstallation(false);
        setHasSlackSource(false);
      }
    };

    checkSlackInstallation();

    // Set up listener for all batch queues
    let unsubscribe: (() => void) | null = null;
    if (
      addNewSourceDialogOpen &&
      selectedSourceType?.type === "slack" &&
      agentId &&
      teamId
    ) {
      const user = auth.currentUser;
      if (user) {
        try {
          const slackSyncBatchesRef = collection(
            db,
            "teams",
            teamId,
            "users",
            user.uid,
            "agents",
            agentId,
            "slack_pinecone_batches",
          );
          // Query all batch documents (no filter)
          const q = query(slackSyncBatchesRef);

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              console.log(
                "Batch queue snapshot:",
                snapshot.size,
                snapshot.docs.length,
              );
              // Flatten all queue arrays from all batch documents
              const allQueueItems: typeof batchQueueItems = [];
              snapshot.docs.forEach((doc) => {
                const data = doc.data();
                const queue = data.queue || [];
                const batchId = doc.id; // Use document ID as batch_id
                console.log("Batch document queue:", queue);
                // Filter queue items where status !== "done" and add batch_id
                const nonDoneItems = queue
                  .filter((item: any) => item.status !== "done")
                  .map((item: any) => ({
                    ...item,
                    batch_id: batchId,
                  }));
                allQueueItems.push(...nonDoneItems);
              });
              console.log("All non-done queue items:", allQueueItems);
              setBatchQueueItems(allQueueItems);
            },
            (error) => {
              console.error("Error listening to batch queue:", error);
              setBatchQueueItems([]);
            },
          );
        } catch (error) {
          console.error("Error setting up batch queue listener:", error);
        }
      }
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [addNewSourceDialogOpen, selectedSourceType, agentId, teamId]);

  // Ref to track the polling interval
  const batchPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Temporarily disable status/tick polling.
  useEffect(() => {
    return () => {
      if (batchPollIntervalRef.current) {
        clearInterval(batchPollIntervalRef.current);
        batchPollIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch Slack team ID at page level for the widget
  useEffect(() => {
    const fetchSlackTeamId = async () => {
      const user = auth.currentUser;
      if (!user || slackTeamId !== null || !teamId) {
        // Already set or no user, skip
        return;
      }

      try {
        const slackInstallationsRef = collection(
          db,
          "teams",
          teamId,
          "users",
          user.uid,
          "slack_installations",
        );
        const slackInstallationsSnapshot = await getDocs(slackInstallationsRef);

        if (!slackInstallationsSnapshot.empty) {
          const firstDoc = slackInstallationsSnapshot.docs[0];
          const data = firstDoc.data();
          const teamId =
            data.slack_team_id ||
            data.slack_team?.id ||
            data.team_id ||
            data.team?.id ||
            null;
          setSlackTeamId(teamId);
        }
      } catch (error) {
        console.error("Error fetching Slack team ID:", error);
      }
    };

    fetchSlackTeamId();
  }, [slackTeamId, teamId]); // Only run if slackTeamId is null

  // Use the hook to get widget data for Slack batch sync
  const user = auth.currentUser;
  const widgetData = useSlackSyncWidgetData(
    teamId,
    agentId || "",
    slackTeamId,
    user?.uid ?? null,
  );

  // Render box content functions
  const renderCurrentSourcesContent = () => (
    <>
      {isLoadingSources ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Loading sources...
        </p>
      ) : currentSources.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                type
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                nickname
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                description
              </th>
              <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {currentSources.map((source) => {
              const isAtlassianSource =
                source.type === "jira" || source.type === "confluence_page";
              const nicknameInput = (
                <Input
                  value={source.nickname || ""}
                  placeholder={
                    !source.nickname ? "give this source an @nickname" : ""
                  }
                  disabled={isAtlassianSource}
                  onChange={(e) =>
                    handleNicknameChange(source.id, e.target.value)
                  }
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      await handleNicknameSave(source.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      const originalNickname = originalNicknames[source.id];

                      if (originalNickname === undefined) {
                        setEditingSourceId(null);
                        return;
                      }

                      // Revert changes on Escape
                      setCurrentSources((prev) =>
                        prev.map((s) =>
                          s.id === source.id
                            ? { ...s, nickname: originalNickname }
                            : s,
                        ),
                      );
                      setEditingSourceId(null);
                      setOriginalNicknames((prev) => {
                        const newState = { ...prev };
                        delete newState[source.id];
                        return newState;
                      });
                    }
                  }}
                  className="h-8 text-sm"
                />
              );

              return (
                <tr key={source.id} className="border-b last:border-b-0">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {source.type === "slack_channel" ? (
                        <button
                          type="button"
                          onClick={() => openSlackTranscript(source)}
                          className="p-1 rounded hover:bg-accent transition-colors"
                          title="View Slack transcript"
                          aria-label="View Slack transcript"
                        >
                          {getFileTypeIcon(source)}
                        </button>
                      ) : (
                        getFileTypeIcon(source)
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {isAtlassianSource ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                {nicknameInput}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Atlassian artefacts are auto-assigned nicknames
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        nicknameInput
                      )}
                      {editingSourceId === source.id && (
                        <button
                          onClick={() => handleNicknameSave(source.id)}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Save nickname"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {/* Show alert icon for table sources without column metadata */}
                      {source.type === "table" && !source.columnMetadata && (
                        <button
                          onClick={() =>
                            handleOpenColumnTypesForSource(source.id)
                          }
                          className="text-destructive hover:text-destructive/80 transition-colors"
                          title="Column metadata missing - click to configure"
                        >
                          <CiCircleAlert className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      value={source.description || ""}
                      readOnly
                      onClick={() => handleDescriptionClick(source.id)}
                      placeholder="-"
                      className="h-8 text-sm cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDeleteClick(source.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No sources found
        </p>
      )}
    </>
  );

  const renderAddNewSourcesContent = () => (
    <div className="grid grid-cols-3 gap-3">
      {newSourceTypes.map((sourceType) => (
        <button
          key={sourceType.id}
          onClick={() => handleSourceTypeClick(sourceType)}
          className="relative flex flex-col items-center justify-center p-4 rounded-md bg-background border border-border cursor-pointer hover:bg-accent transition-colors aspect-square"
        >
          {comingSoonSourceTypes.has(sourceType.type) && (
            <Badge variant="secondary" className="absolute right-2 top-2">
              coming soon
            </Badge>
          )}
          <div className="flex items-center justify-center mb-2">
            {getSourceTypeIcon(sourceType.type)}
          </div>
          <span className="text-xs text-center text-muted-foreground">
            {sourceType.name}
          </span>
        </button>
      ))}
    </div>
  );

  // Render function for add new source dialog content based on type
  const renderAddNewSourceDialogContent = () => {
    if (!selectedSourceType) return null;

    const type = selectedSourceType.type.toLowerCase();

    switch (type) {
      case "document":
        return (
          <div className="flex flex-col gap-6">
            {/* File Upload Section */}
            <div className="flex flex-col gap-4">
              <Label>Upload Document</Label>

              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }
                  ${selectedFile ? "bg-muted" : ""}
                `}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-12 w-12 text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setDocumentNickname("");
                        setDocumentDescription("");
                      }}
                      className="mt-2"
                    >
                      Remove file
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop your file here, or
                    </p>
                    <label htmlFor="file-input">
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 cursor-pointer"
                        asChild
                      >
                        <span>Choose file</span>
                      </Button>
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={handleFileInputChange}
                      accept=".pdf,.doc,.docx,.txt,.md"
                    />
                  </div>
                )}
              </div>

              {/* Hidden file input for "Choose file" button */}
              {!selectedFile && (
                <input
                  id="file-input-hidden"
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.txt,.md"
                />
              )}
            </div>

            {/* Nickname Field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="document-nickname">Nickname</Label>
              <Input
                id="document-nickname"
                type="text"
                placeholder="Enter a nickname for this source"
                value={documentNickname}
                onChange={(e) => setDocumentNickname(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="document-description">Source Description</Label>
              <Input
                id="document-description"
                type="text"
                placeholder="this helps your agent determine when we should use this source"
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={closeAddNewSourceDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAddDocumentSource}
                disabled={
                  !documentNickname.trim() ||
                  !selectedFile ||
                  isAddSourcePreparing
                }
              >
                {isAddSourcePreparing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </div>
          </div>
        );
      case "website":
        return (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="website-nickname">Nickname</Label>
              <Input
                id="website-nickname"
                type="text"
                placeholder="Enter a nickname for this source"
                value={websiteNickname}
                onChange={(e) => setWebsiteNickname(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={closeAddNewSourceDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAddWebsiteSource}
                disabled={
                  !websiteUrl.trim() ||
                  !websiteNickname.trim() ||
                  isAddSourcePreparing
                }
              >
                {isAddSourcePreparing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </div>
          </div>
        );
      case "table":
        return (
          <div className="flex flex-col gap-6">
            {/* File Upload Section */}
            <div className="flex flex-col gap-4">
              <Label>Upload Table</Label>

              {/* Drag and Drop Area */}
              <div
                onDragOver={handleTableDragOver}
                onDragLeave={handleTableDragLeave}
                onDrop={handleTableDrop}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${
                    isDraggingTable
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }
                  ${selectedTableFile ? "bg-muted" : ""}
                `}
              >
                {selectedTableFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CiViewTable className="h-12 w-12 text-primary" />
                    <p className="text-sm font-medium">
                      {selectedTableFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedTableFile.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTableFile(null);
                        setTableNickname("");
                      }}
                      className="mt-2"
                    >
                      Remove file
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop your file here, or
                    </p>
                    <label htmlFor="table-file-input">
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 cursor-pointer"
                        asChild
                      >
                        <span>Choose file</span>
                      </Button>
                    </label>
                    <input
                      id="table-file-input"
                      type="file"
                      className="hidden"
                      onChange={handleTableFileInputChange}
                      accept=".csv,.xlsx,.tsv"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Nickname Field */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="table-nickname">Nickname</Label>
              <Input
                id="table-nickname"
                type="text"
                placeholder="Enter a nickname for this source"
                value={tableNickname}
                onChange={(e) => setTableNickname(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Warning/Error UI for row count */}
            {tableSourcePendingReview && (
              <div
                className={`p-4 rounded-lg border ${
                  tableSourcePendingReview.rowCount > 1000000
                    ? "bg-destructive/10 border-destructive"
                    : "bg-yellow-500/10 border-yellow-500"
                }`}
              >
                {tableSourcePendingReview.rowCount > 1000000 ? (
                  <>
                    <p className="text-sm font-medium text-destructive mb-2">
                      File Too Large
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This file has{" "}
                      {tableSourcePendingReview.rowCount.toLocaleString()} rows,
                      which exceeds the maximum of 1,000,000 rows. This file
                      cannot be uploaded.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteTableSource}
                      className="w-full"
                    >
                      Delete Source
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-2">
                      Large File Warning
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This file has{" "}
                      {tableSourcePendingReview.rowCount.toLocaleString()} rows.
                      This file may take longer to load and query. Tap confirm
                      to add it anyway.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleDeleteTableSource();
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmTableSource}
                        className="flex-1"
                      >
                        Confirm
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons - only show if no pending review */}
            {!tableSourcePendingReview && (
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={closeAddNewSourceDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTableSource}
                  disabled={
                    !tableNickname.trim() ||
                    !selectedTableFile ||
                    isAddSourcePreparing
                  }
                >
                  {isAddSourcePreparing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Done"
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      case "jira":
        return (
          <div className="flex flex-col gap-6">
            {hasJiraAccessToken === null ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : !hasJiraAccessToken ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Configure your jira connection
                </p>
                <Button
                  onClick={() => {
                    closeAddNewSourceDialog();
                    router.push("/settings");
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            ) : !hasJiraSource ? (
              // Show search UI if no Jira source exists
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="jira-search">Search Jira</Label>
                  <div className="flex gap-2">
                    <Input
                      id="jira-search"
                      type="text"
                      placeholder="Enter search query (e.g., project = TEST)"
                      value={jiraSearchInput}
                      onChange={(e) => setJiraSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSearchingJira) {
                          handleJiraSearch();
                        }
                      }}
                      className="flex-1"
                      disabled={isSearchingJira}
                    />
                    <Button
                      onClick={handleJiraSearch}
                      disabled={!jiraSearchInput.trim() || isSearchingJira}
                    >
                      {isSearchingJira ? "Searching..." : "Search"}
                    </Button>
                  </div>
                </div>

                {/* Search Results */}
                {jiraSearchResults.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-3">
                        Search Results ({jiraSearchResults.length})
                      </p>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {jiraSearchResults.map((issue: any) => (
                          <div
                            key={issue.id}
                            className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                              selectedJiraTickets.has(issue.key)
                                ? "border-primary bg-primary/5"
                                : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={selectedJiraTickets.has(issue.key)}
                                  onChange={() =>
                                    handleToggleJiraTicket(issue.key)
                                  }
                                  className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-primary">
                                      {issue.key}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {issue.fields.issuetype.name}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium mb-1">
                                    {issue.fields.summary}
                                  </p>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>
                                      Project: {issue.fields.project.name} (
                                      {issue.fields.project.key})
                                    </span>
                                    <span>
                                      Status: {issue.fields.status.name}
                                    </span>
                                    {issue.fields.assignee && (
                                      <span>
                                        Assignee:{" "}
                                        {issue.fields.assignee.displayName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={closeAddNewSourceDialog}>
                    Cancel
                  </Button>
                  {selectedJiraTickets.size > 0 && (
                    <Button
                      onClick={handleAddJiraTickets}
                      disabled={
                        selectedJiraTickets.size === 0 || isAddSourcePreparing
                      }
                    >
                      {isAddSourcePreparing ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        `Add ${selectedJiraTickets.size} Selected`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Show existing Jira source with tickets
              (() => {
                const jiraSource = currentSources.find(
                  (source) => source.type === "jira",
                );
                const existingTickets = jiraSource?.tickets || [];
                const lastSynced = jiraSource?.lastSynced;

                // Format last synced timestamp
                const formatLastSynced = (timestamp: any) => {
                  if (!timestamp) return "Never";
                  try {
                    // Handle Firestore Timestamp
                    let date: Date;
                    if (timestamp.toDate) {
                      date = timestamp.toDate();
                    } else if (timestamp.seconds) {
                      date = new Date(timestamp.seconds * 1000);
                    } else if (timestamp instanceof Date) {
                      date = timestamp;
                    } else {
                      return "Unknown";
                    }
                    return date.toLocaleString();
                  } catch (error) {
                    return "Unknown";
                  }
                };

                return (
                  <div className="flex flex-col gap-6">
                    <Accordion type="single" collapsible className="w-full">
                      {/* Show Existing Tickets Accordion */}
                      {existingTickets.length > 0 && (
                        <AccordionItem value="existing-tickets">
                          <AccordionTrigger>
                            Show {existingTickets.length} Tickets
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-x-auto pb-2">
                              <div className="flex gap-3 min-w-max">
                                {existingTickets.map(
                                  (ticket: any, index: number) => (
                                    <ContextMenu
                                      key={ticket.key || ticket.id || index}
                                    >
                                      <ContextMenuTrigger asChild>
                                        <div className="p-3 rounded-lg border bg-background min-w-[280px] max-w-[280px] flex-shrink-0">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium text-primary">
                                                {ticket.key}
                                              </span>
                                              {ticket.issuetype && (
                                                <span className="text-xs text-muted-foreground">
                                                  {ticket.issuetype}
                                                </span>
                                              )}
                                            </div>
                                            {ticket.summary && (
                                              <p className="text-sm font-medium line-clamp-2">
                                                {ticket.summary}
                                              </p>
                                            )}
                                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                              {ticket.project && (
                                                <span>
                                                  Project: {ticket.project.name}{" "}
                                                  ({ticket.project.key})
                                                </span>
                                              )}
                                              {ticket.status && (
                                                <span>
                                                  Status: {ticket.status}
                                                </span>
                                              )}
                                              {ticket.assignee && (
                                                <span>
                                                  Assignee:{" "}
                                                  {ticket.assignee.displayName}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent>
                                        <ContextMenuItem
                                          variant="destructive"
                                          onClick={() => {
                                            setTicketToDelete(ticket);
                                            setDeleteTicketDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  ),
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* Search for New Tickets Accordion */}
                      <AccordionItem value="search-tickets">
                        <AccordionTrigger>
                          Search for New Tickets
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="jira-search-existing">
                                Search Jira
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  id="jira-search-existing"
                                  type="text"
                                  placeholder="Enter search query (e.g., project = TEST)"
                                  value={jiraSearchInput}
                                  onChange={(e) =>
                                    setJiraSearchInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isSearchingJira) {
                                      handleJiraSearch();
                                    }
                                  }}
                                  className="flex-1"
                                  disabled={isSearchingJira}
                                />
                                <Button
                                  onClick={handleJiraSearch}
                                  disabled={
                                    !jiraSearchInput.trim() || isSearchingJira
                                  }
                                >
                                  {isSearchingJira ? "Searching..." : "Search"}
                                </Button>
                              </div>
                            </div>

                            {/* Search Results */}
                            {jiraSearchResults.length > 0 && (
                              <div className="flex flex-col gap-4">
                                <div className="border-t pt-4">
                                  <p className="text-sm font-medium mb-3">
                                    Search Results ({jiraSearchResults.length})
                                  </p>
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {jiraSearchResults.map((issue: any) => (
                                      <div
                                        key={issue.id}
                                        className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                                          selectedJiraTickets.has(issue.key)
                                            ? "border-primary bg-primary/5"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-3 flex-1">
                                            <input
                                              type="checkbox"
                                              checked={selectedJiraTickets.has(
                                                issue.key,
                                              )}
                                              onChange={() =>
                                                handleToggleJiraTicket(
                                                  issue.key,
                                                )
                                              }
                                              className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-primary">
                                                  {issue.key}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                  {issue.fields.issuetype.name}
                                                </span>
                                              </div>
                                              <p className="text-sm font-medium mb-1">
                                                {issue.fields.summary}
                                              </p>
                                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>
                                                  Project:{" "}
                                                  {issue.fields.project.name} (
                                                  {issue.fields.project.key})
                                                </span>
                                                <span>
                                                  Status:{" "}
                                                  {issue.fields.status.name}
                                                </span>
                                                {issue.fields.assignee && (
                                                  <span>
                                                    Assignee:{" "}
                                                    {
                                                      issue.fields.assignee
                                                        .displayName
                                                    }
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      {lastSynced && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                          <RefreshCw className="h-3 w-3" />
                          <span>
                            Last synced: {formatLastSynced(lastSynced)}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={closeAddNewSourceDialog}
                        >
                          Close
                        </Button>
                        {selectedJiraTickets.size > 0 && (
                          <Button
                            onClick={handleAddJiraTickets}
                            disabled={selectedJiraTickets.size === 0}
                          >
                            {isAddSourcePreparing ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              `Add ${selectedJiraTickets.size} Selected`
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        );
      case "confluence":
        return (
          <div className="flex flex-col gap-6">
            {hasConfluenceAccessToken === null ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : !hasConfluenceAccessToken ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Configure your confluence connection
                </p>
                <Button
                  onClick={() => {
                    closeAddNewSourceDialog();
                    router.push("/settings");
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            ) : !hasConfluenceSource ? (
              // Show search UI if no Confluence source exists
              <div className="flex flex-col gap-6">
                {/* Tabs */}
                <div className="flex gap-2 border-b">
                  <button
                    type="button"
                    onClick={() => setConfluenceSearchTab("query")}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      confluenceSearchTab === "query"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Search by Query
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfluenceSearchTab("cql")}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      confluenceSearchTab === "cql"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Search with CQL
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfluenceSearchTab("spaces")}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      confluenceSearchTab === "spaces"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Search by Spaces
                  </button>
                </div>

                {confluenceSearchTab === "spaces" ? (
                  <div className="flex flex-col gap-3">
                    <div className="border rounded-md p-3">
                      {isLoadingConfluenceSpaces ? (
                        <p className="text-sm text-muted-foreground">
                          Loading spaces...
                        </p>
                      ) : confluenceSpaces.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No spaces available yet.
                        </p>
                      ) : (
                        <div className="max-h-[240px] overflow-y-auto pr-1">
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full"
                          >
                            {confluenceSpaces.map((space) => (
                              <AccordionItem
                                key={space.id}
                                value={`space-${space.id}`}
                              >
                                <AccordionTrigger>
                                  {space.name}
                                </AccordionTrigger>
                                <AccordionContent>
                                  {space.pages?.length ? (
                                    renderConfluencePageList(space.pages)
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-2">
                                      No pages found in this space.
                                    </p>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confluence-search">
                        {confluenceSearchTab === "query"
                          ? "Search Query"
                          : "CQL Query"}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="confluence-search"
                          type="text"
                          placeholder={
                            confluenceSearchTab === "query"
                              ? "Enter search query (e.g., page title or content)"
                              : "Enter CQL query (e.g., space = TEST and type = page)"
                          }
                          value={
                            confluenceSearchTab === "query"
                              ? confluenceSearchInput
                              : confluenceCQLInput
                          }
                          onChange={(e) =>
                            confluenceSearchTab === "query"
                              ? setConfluenceSearchInput(e.target.value)
                              : setConfluenceCQLInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isSearchingConfluence) {
                              handleConfluenceSearch();
                            }
                          }}
                          className="flex-1"
                          disabled={isSearchingConfluence}
                        />
                        <Button
                          onClick={handleConfluenceSearch}
                          disabled={
                            (confluenceSearchTab === "query"
                              ? !confluenceSearchInput.trim()
                              : !confluenceCQLInput.trim()) ||
                            isSearchingConfluence
                          }
                        >
                          {isSearchingConfluence ? "Searching..." : "Search"}
                        </Button>
                      </div>
                    </div>

                    {/* Search Results */}
                    {confluenceSearchResults.length > 0 && (
                      <div className="flex flex-col gap-4">
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium mb-3">
                            Search Results ({confluenceSearchResults.length})
                          </p>
                          <div className="space-y-2 h-[200px] overflow-y-auto">
                            {confluenceSearchResults.map((page: any) => (
                              <div
                                key={page.id}
                                className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                                  selectedConfluencePages.has(page.id)
                                    ? "border-primary bg-primary/5"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedConfluencePages.has(
                                        page.id,
                                      )}
                                      onChange={() =>
                                        handleToggleConfluencePage(page.id)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <div
                                      className="flex-1 cursor-pointer"
                                      onClick={() =>
                                        handleConfluencePageClick(page)
                                      }
                                    >
                                      <p className="text-sm font-medium hover:underline">
                                        {page.title}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={closeAddNewSourceDialog}>
                    Cancel
                  </Button>
                  {selectedConfluencePages.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleClearConfluenceSelection}
                      >
                        Clear
                      </Button>
                      <Button
                        onClick={handleAddConfluencePages}
                        disabled={
                          selectedConfluencePages.size === 0 ||
                          isAddSourcePreparing
                        }
                      >
                        {isAddSourcePreparing ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          `Add ${selectedConfluencePages.size} Selected`
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              // Show existing Confluence source with pages
              (() => {
                // Get all Confluence pages (they're stored as separate documents)
                const existingPages = currentSources.filter(
                  (source) =>
                    source.type === "confluence" ||
                    source.type === "confluence_page",
                );
                // Get lastSynced from the most recent page, or use the first one
                const lastSynced =
                  existingPages.length > 0
                    ? existingPages[existingPages.length - 1]?.updatedAt ||
                      existingPages[0]?.updatedAt
                    : null;

                // Format last synced timestamp
                const formatLastSynced = (timestamp: any) => {
                  if (!timestamp) return "Never";
                  try {
                    let date: Date;
                    if (timestamp.toDate) {
                      date = timestamp.toDate();
                    } else if (timestamp.seconds) {
                      date = new Date(timestamp.seconds * 1000);
                    } else if (timestamp instanceof Date) {
                      date = timestamp;
                    } else {
                      return "Unknown";
                    }
                    return date.toLocaleString();
                  } catch (error) {
                    return "Unknown";
                  }
                };

                return (
                  <div className="flex flex-col gap-6">
                    <Accordion type="single" collapsible className="w-full">
                      {/* Show Existing Pages Accordion */}
                      <AccordionItem value="existing-pages">
                        <AccordionTrigger>
                          Show {existingPages.length} Pages
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="overflow-x-auto pb-2">
                            <div className="flex gap-3 min-w-max">
                              {existingPages.length > 0 ? (
                                existingPages.map(
                                  (page: any, index: number) => {
                                    // Build URL from stored url or reconstruct from tinyui_path
                                    const pageUrl =
                                      page.url ||
                                      (page.tinyui_path
                                        ? buildConfluenceUrl(page.tinyui_path)
                                        : null);
                                    return (
                                      <ContextMenu
                                        key={page.id || page.sourceId || index}
                                      >
                                        <ContextMenuTrigger asChild>
                                          <div
                                            className="p-3 rounded-lg border bg-background min-w-[280px] max-w-[280px] flex-shrink-0 cursor-pointer hover:bg-accent transition-colors"
                                            onClick={() => {
                                              if (pageUrl) {
                                                window.open(
                                                  pageUrl,
                                                  "_blank",
                                                  "noopener,noreferrer",
                                                );
                                              } else {
                                                handleConfluencePageClick(page);
                                              }
                                            }}
                                          >
                                            <div className="flex flex-col gap-2">
                                              <p className="text-sm font-medium line-clamp-2 hover:underline">
                                                {page.title}
                                              </p>
                                            </div>
                                          </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          <ContextMenuItem
                                            variant="destructive"
                                            onClick={() =>
                                              handleDeleteConfluencePage(page)
                                            }
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  },
                                )
                              ) : (
                                <p className="text-sm text-muted-foreground py-4">
                                  No pages found
                                </p>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Add New Pages Accordion */}
                      <AccordionItem value="search-pages">
                        <AccordionTrigger>Add New Pages</AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col gap-4">
                            {/* Tabs */}
                            <div className="flex gap-2 border-b">
                              <button
                                type="button"
                                onClick={() => setConfluenceSearchTab("query")}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                  confluenceSearchTab === "query"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                Search by query
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfluenceSearchTab("cql")}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                  confluenceSearchTab === "cql"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                Search with CQL
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfluenceSearchTab("spaces")}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                                  confluenceSearchTab === "spaces"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                Search by Spaces
                              </button>
                            </div>

                            {confluenceSearchTab === "spaces" ? (
                              <div className="flex flex-col gap-3">
                                <p className="text-sm text-muted-foreground"></p>
                                <div className="border rounded-md p-3">
                                  {isLoadingConfluenceSpaces ? (
                                    <p className="text-sm text-muted-foreground">
                                      Loading spaces...
                                    </p>
                                  ) : confluenceSpaces.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      No spaces available yet.
                                    </p>
                                  ) : (
                                    <div className="max-h-[240px] overflow-y-auto pr-1">
                                      <Accordion
                                        type="single"
                                        collapsible
                                        className="w-full"
                                        onValueChange={(value) => {
                                          if (!value) {
                                            setOpenConfluenceSpaceId(null);
                                            return;
                                          }
                                          setOpenConfluenceSpaceId(
                                            value.replace("space-", ""),
                                          );
                                        }}
                                      >
                                        {confluenceSpaces.map((space) => (
                                          <AccordionItem
                                            key={space.id}
                                            value={`space-${space.id}`}
                                          >
                                            <AccordionTrigger>
                                              {space.name}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                              {loadingConfluencePagesBySpace[
                                                space.id
                                              ] ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                                  Loading pages...
                                                </div>
                                              ) : space.pages?.length ? (
                                                <div className="flex flex-col gap-3">
                                                  <div className="flex gap-2">
                                                    <Input
                                                      type="text"
                                                      placeholder="Search by page title"
                                                      value={
                                                        confluenceSpaceSearches[
                                                          space.id
                                                        ] || ""
                                                      }
                                                      onChange={(e) =>
                                                        setConfluenceSpaceSearches(
                                                          (prev) => ({
                                                            ...prev,
                                                            [space.id]:
                                                              e.target.value,
                                                          }),
                                                        )
                                                      }
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      onClick={() =>
                                                        setConfluenceSpaceSearches(
                                                          (prev) => ({
                                                            ...prev,
                                                            [space.id]:
                                                              prev[space.id] ||
                                                              "",
                                                          }),
                                                        )
                                                      }
                                                    >
                                                      Search
                                                    </Button>
                                                  </div>
                                                  {getFilteredConfluencePages(
                                                    space.id,
                                                    space.pages,
                                                  ).length > 0 ? (
                                                    renderConfluencePageList(
                                                      getFilteredConfluencePages(
                                                        space.id,
                                                        space.pages,
                                                      ),
                                                    )
                                                  ) : (
                                                    <p className="text-sm text-muted-foreground">
                                                      No pages match this title
                                                      search.
                                                    </p>
                                                  )}
                                                </div>
                                              ) : (
                                                <p className="text-sm text-muted-foreground py-2">
                                                  No pages found in this space.
                                                </p>
                                              )}
                                            </AccordionContent>
                                          </AccordionItem>
                                        ))}
                                      </Accordion>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col gap-2">
                                  <Label htmlFor="confluence-search-existing">
                                    {confluenceSearchTab === "query"
                                      ? "Search Query"
                                      : "CQL Query"}
                                  </Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id="confluence-search-existing"
                                      type="text"
                                      placeholder={
                                        confluenceSearchTab === "query"
                                          ? "Search by page title or contents"
                                          : "Enter CQL query (e.g., space = TEST and type = page)"
                                      }
                                      value={
                                        confluenceSearchTab === "query"
                                          ? confluenceSearchInput
                                          : confluenceCQLInput
                                      }
                                      onChange={(e) =>
                                        confluenceSearchTab === "query"
                                          ? setConfluenceSearchInput(
                                              e.target.value,
                                            )
                                          : setConfluenceCQLInput(
                                              e.target.value,
                                            )
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" &&
                                          !isSearchingConfluence
                                        ) {
                                          handleConfluenceSearch();
                                        }
                                      }}
                                      className="flex-1"
                                      disabled={isSearchingConfluence}
                                    />
                                    <Button
                                      onClick={handleConfluenceSearch}
                                      disabled={
                                        (confluenceSearchTab === "query"
                                          ? !confluenceSearchInput.trim()
                                          : !confluenceCQLInput.trim()) ||
                                        isSearchingConfluence
                                      }
                                    >
                                      {isSearchingConfluence
                                        ? "Searching..."
                                        : "Search"}
                                    </Button>
                                  </div>
                                </div>

                                {/* Search Results */}
                                {confluenceSearchResults.length > 0 && (
                                  <div className="flex flex-col gap-4">
                                    <div className="border-t pt-4">
                                      <p className="text-sm font-medium mb-3">
                                        Search Results (
                                        {confluenceSearchResults.length})
                                      </p>
                                      <div className="space-y-2 h-[200px] overflow-y-auto">
                                        {confluenceSearchResults.map(
                                          (page: any) => (
                                            <div
                                              key={page.id}
                                              className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                                                selectedConfluencePages.has(
                                                  page.id,
                                                )
                                                  ? "border-primary bg-primary/5"
                                                  : ""
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-3 flex-1">
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedConfluencePages.has(
                                                      page.id,
                                                    )}
                                                    onChange={() =>
                                                      handleToggleConfluencePage(
                                                        page.id,
                                                      )
                                                    }
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                    className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                                  />
                                                  <div
                                                    className="flex-1 cursor-pointer"
                                                    onClick={() =>
                                                      handleConfluencePageClick(
                                                        page,
                                                      )
                                                    }
                                                  >
                                                    <p className="text-sm font-medium hover:underline">
                                                      {page.title}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      {lastSynced && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                          <RefreshCw className="h-3 w-3" />
                          <span>
                            Last synced: {formatLastSynced(lastSynced)}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={closeAddNewSourceDialog}
                        >
                          Close
                        </Button>
                        {selectedConfluencePages.size > 0 && (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleClearConfluenceSelection}
                            >
                              Clear
                            </Button>
                            <Button
                              onClick={handleAddConfluencePages}
                              disabled={selectedConfluencePages.size === 0}
                            >
                              {isAddSourcePreparing ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                `Add ${selectedConfluencePages.size} Selected`
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        );
      case "slack":
        return (
          <div className="flex flex-col gap-6">
            {hasSlackInstallation === null ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : !hasSlackInstallation ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-sm text-muted-foreground text-center">
                  Configure your slack connection
                </p>
                <Button
                  onClick={() => {
                    closeAddNewSourceDialog();
                    router.push("/settings");
                  }}
                >
                  Go to Settings
                </Button>
              </div>
            ) : !hasSlackSource ? (
              // Show search UI if no Slack source exists
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="slack-search">Search Channels</Label>
                  <Input
                    id="slack-search"
                    type="text"
                    placeholder="Search for channels..."
                    value={slackSearchInput}
                    onChange={(e) => setSlackSearchInput(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Channel Results */}
                {(() => {
                  // Get existing Slack channel names (case-insensitive Set for fast lookup)
                  const existingChannelNames = new Set(
                    currentSources
                      .filter((source) => source.type === "slack_channel")
                      .map((source) => source.name?.toLowerCase())
                      .filter((name): name is string => !!name),
                  );

                  // Client-side filtering - exclude already added channels and apply search
                  const filteredChannels = allSlackChannels.filter(
                    (channel) => {
                      const channelNameLower =
                        channel.name?.toLowerCase() || "";
                      const isAlreadyAdded =
                        existingChannelNames.has(channelNameLower);
                      const matchesSearch = channelNameLower.includes(
                        slackSearchInput.toLowerCase(),
                      );
                      return !isAlreadyAdded && matchesSearch;
                    },
                  );
                  const isSearchActive = Boolean(slackSearchInput.trim());
                  const displayChannels = isSearchActive
                    ? filteredChannels
                    : filteredChannels.slice(0, 5);

                  return filteredChannels.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-3">
                          Channels (
                          {isSearchActive
                            ? filteredChannels.length
                            : `${displayChannels.length} of ${filteredChannels.length}`}
                          )
                        </p>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {displayChannels.map((channel: any) => (
                            <div
                              key={channel.id}
                              className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                                selectedSlackChannels.has(channel.id)
                                  ? "border-primary bg-primary/5"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedSlackChannels.has(
                                      channel.id,
                                    )}
                                    onChange={() =>
                                      handleToggleSlackChannel(channel.id)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                  <div
                                    className="flex-1 cursor-pointer"
                                    onClick={() =>
                                      handleSlackChannelClick(channel)
                                    }
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium hover:underline">
                                        #{channel.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {channel.is_private
                                          ? "Private"
                                          : "Public"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span>
                                        {channel.num_members || 0} member
                                        {(channel.num_members || 0) !== 1
                                          ? "s"
                                          : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : isLoadingSlackChannels ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-muted-foreground">
                        Loading channels...
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-muted-foreground">
                        {slackSearchInput.trim()
                          ? "No channels found"
                          : "No channels available"}
                      </p>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={closeAddNewSourceDialog}>
                    Cancel
                  </Button>
                  {selectedSlackChannels.size > 0 && (
                    <Button
                      onClick={handleAddSlackChannels}
                      disabled={
                        selectedSlackChannels.size === 0 ||
                        isStartingBatch ||
                        isAddSourcePreparing
                      }
                    >
                      {isAddSourcePreparing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : isStartingBatch ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        `Add ${selectedSlackChannels.size} Selected`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Show existing Slack sources with channels
              (() => {
                // Get all Slack channels (they're stored as separate documents)
                const existingChannels = currentSources.filter(
                  (source) => source.type === "slack_channel",
                );

                // Batch queue items are already filtered in the listener (status !== "done")
                const inProgressItems = batchQueueItems;

                // Get existing Slack channel names (case-insensitive Set for fast lookup)
                const existingChannelNames = new Set(
                  currentSources
                    .filter((source) => source.type === "slack_channel")
                    .map((source) => source.name?.toLowerCase())
                    .filter((name): name is string => !!name),
                );

                // Client-side filtering for search - exclude already added channels
                const filteredChannels = allSlackChannels.filter((channel) => {
                  const channelNameLower = channel.name?.toLowerCase() || "";
                  const isAlreadyAdded =
                    existingChannelNames.has(channelNameLower);
                  const matchesSearch = channelNameLower.includes(
                    slackSearchInput.toLowerCase(),
                  );
                  return !isAlreadyAdded && matchesSearch;
                });

                // Format last synced timestamp helper
                const formatLastSynced = (timestamp: any) => {
                  if (!timestamp) return "Never";
                  try {
                    let date: Date;
                    if (timestamp.toDate) {
                      date = timestamp.toDate();
                    } else if (timestamp.seconds) {
                      date = new Date(timestamp.seconds * 1000);
                    } else if (timestamp instanceof Date) {
                      date = timestamp;
                    } else {
                      return "Unknown";
                    }
                    return date.toLocaleString();
                  } catch (error) {
                    return "Unknown";
                  }
                };

                return (
                  <div className="flex flex-col gap-6">
                    <Accordion type="single" collapsible className="w-full">
                      {/* Show Existing Channels Accordion */}
                      {existingChannels.length > 0 && (
                        <AccordionItem value="existing-channels">
                          <AccordionTrigger>
                            Show {existingChannels.length} Channel
                            {existingChannels.length !== 1 ? "s" : ""}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-x-auto pb-2">
                              <div className="flex gap-3 min-w-max">
                                {existingChannels.map(
                                  (channel: any, index: number) => {
                                    const channelUrl = buildSlackChannelUrl(
                                      slackTeamId,
                                      channel.id,
                                    );
                                    const isSyncing = syncingChannels.has(
                                      channel.id,
                                    );

                                    return (
                                      <ContextMenu
                                        key={
                                          channel.id ||
                                          channel.sourceId ||
                                          index
                                        }
                                      >
                                        <ContextMenuTrigger asChild>
                                          <div className="p-3 rounded-lg border bg-background min-w-[360px] max-w-[360px] flex-shrink-0">
                                            <div className="flex items-start justify-between gap-2">
                                              <div
                                                className="flex-1 cursor-pointer"
                                                onClick={() => {
                                                  if (channelUrl) {
                                                    window.open(
                                                      channelUrl,
                                                      "_blank",
                                                      "noopener,noreferrer",
                                                    );
                                                  }
                                                }}
                                              >
                                                <div className="flex flex-col gap-2">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium hover:underline">
                                                      #
                                                      {channel.name ||
                                                        "Unknown"}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                      {channel.is_private
                                                        ? "Private"
                                                        : "Public"}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                                    <span>
                                                      {channel.num_members || 0}{" "}
                                                      member
                                                      {(channel.num_members ||
                                                        0) !== 1
                                                        ? "s"
                                                        : ""}
                                                    </span>
                                                    {channel.last_synced_at && (
                                                      <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
                                                        <RefreshCw className="h-3 w-3" />
                                                        <span>
                                                          Last synced:{" "}
                                                          {formatLastSynced(
                                                            channel.last_synced_at,
                                                          )}
                                                        </span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSyncSlackChannel(
                                                    channel.id,
                                                    channel.name || "Unknown",
                                                  );
                                                }}
                                                disabled={isSyncing}
                                                className="flex-shrink-0"
                                              >
                                                {isSyncing ? (
                                                  <>
                                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                    Syncing...
                                                  </>
                                                ) : (
                                                  <>
                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                    Resync
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          <ContextMenuItem
                                            variant="destructive"
                                            onClick={() =>
                                              handleDeleteClick(channel.id)
                                            }
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* In Progress Accordion */}
                      {inProgressItems.length > 0 && (
                        <AccordionItem value="in-progress">
                          <AccordionTrigger>
                            In Progress ({inProgressItems.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-x-auto pb-2">
                              <div className="flex gap-3 min-w-max">
                                {inProgressItems.map(
                                  (item: any, index: number) => (
                                    <div
                                      key={item.channel_id || index}
                                      className="p-3 rounded-lg border bg-muted min-w-[360px] max-w-[360px] flex-shrink-0"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium">
                                                #
                                                {item.channel_name || "Unknown"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        {item.error ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-shrink-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSyncChannelTranscript(
                                                    item.channel_id,
                                                    item.channel_name,
                                                    item.batch_id,
                                                  );
                                                }}
                                                disabled={syncingChannels.has(
                                                  item.channel_id,
                                                )}
                                              >
                                                {syncingChannels.has(
                                                  item.channel_id,
                                                ) ? (
                                                  <>
                                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                    Syncing...
                                                  </>
                                                ) : (
                                                  "error"
                                                )}
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <div className="flex flex-col gap-1">
                                                <p className="text-xs font-medium">
                                                  Error Details
                                                </p>
                                                <p className="text-xs">
                                                  {item.result?.details
                                                    ?.error === "not_in_channel"
                                                    ? "Add Solari Slack Bots to this channel, to sync it to the agent"
                                                    : typeof item.error ===
                                                        "string"
                                                      ? item.error
                                                      : JSON.stringify(
                                                          item.error,
                                                          null,
                                                          2,
                                                        )}
                                                </p>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-shrink-0"
                                          >
                                            {item.status || "Unknown"}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* Add New Channels Accordion */}
                      <AccordionItem value="search-channels">
                        <AccordionTrigger>Add New Channels</AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="slack-search-existing">
                                Search Channels
                              </Label>
                              <Label className="text-xs text-muted-foreground">
                                Remember to add Solari Slack Bots to any private
                                channels you'd like to add.
                              </Label>
                              <Input
                                id="slack-search-existing"
                                type="text"
                                placeholder="Search for channels..."
                                value={slackSearchInput}
                                onChange={(e) =>
                                  setSlackSearchInput(e.target.value)
                                }
                                className="w-full"
                              />
                            </div>

                            {/* Search Results */}
                            {filteredChannels.length > 0 ? (
                              <div className="flex flex-col gap-4">
                                <div className="border-t pt-4">
                                  <p className="text-sm font-medium mb-3">
                                    Channels ({filteredChannels.length})
                                  </p>
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {filteredChannels.map((channel: any) => (
                                      <div
                                        key={channel.id}
                                        className={`p-3 rounded-lg border bg-background hover:bg-accent transition-colors ${
                                          selectedSlackChannels.has(channel.id)
                                            ? "border-primary bg-primary/5"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-3 flex-1">
                                            <input
                                              type="checkbox"
                                              checked={selectedSlackChannels.has(
                                                channel.id,
                                              )}
                                              onChange={() =>
                                                handleToggleSlackChannel(
                                                  channel.id,
                                                )
                                              }
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="mt-1 h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div
                                              className="flex-1 cursor-pointer"
                                              onClick={() =>
                                                handleSlackChannelClick(channel)
                                              }
                                            >
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium hover:underline">
                                                  #{channel.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                  {channel.is_private
                                                    ? "Private"
                                                    : "Public"}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>
                                                  {channel.num_members || 0}{" "}
                                                  member
                                                  {(channel.num_members ||
                                                    0) !== 1
                                                    ? "s"
                                                    : ""}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : isLoadingSlackChannels ? (
                              <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-muted-foreground">
                                  Loading channels...
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-muted-foreground">
                                  {slackSearchInput.trim()
                                    ? "No channels found"
                                    : "No channels available"}
                                </p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={closeAddNewSourceDialog}
                        >
                          Close
                        </Button>
                        {selectedSlackChannels.size > 0 && (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleClearSlackSelection}
                            >
                              Clear
                            </Button>
                            <Button
                              onClick={handleAddSlackChannels}
                              disabled={
                                selectedSlackChannels.size === 0 ||
                                isStartingBatch ||
                                isAddSourcePreparing
                              }
                            >
                              {isAddSourcePreparing ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Adding...
                                </>
                              ) : isStartingBatch ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                `Add ${selectedSlackChannels.size} Selected`
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        );
      case "google drive":
      case "googledrive":
        return (
          <div>
            {/* Google Drive-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Google Drive source configuration
            </p>
          </div>
        );
      case "notion":
        return (
          <div>
            {/* Notion-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Notion source configuration
            </p>
          </div>
        );
      case "gong":
        return (
          <div>
            {/* Gong-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Gong source configuration
            </p>
          </div>
        );
      default:
        return (
          <div>
            <p className="text-sm text-muted-foreground">
              Source configuration
            </p>
          </div>
        );
    }
  };

  const renderMembersPermissionsContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingMembers ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-sm text-muted-foreground"
                >
                  Loading members...
                </TableCell>
              </TableRow>
            ) : agentMembers.length > 0 ? (
              agentMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.displayName || "—"}
                  </TableCell>
                  <TableCell>{member.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 w-full">
                      <Select
                        value={member.permission || member.role || ""}
                        onValueChange={(value) =>
                          handleAgentRoleChange(
                            member.id,
                            member.email,
                            value as "view" | "edit" | "admin",
                          )
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">view</SelectItem>
                          <SelectItem value="edit">edit</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto text-destructive hover:text-destructive/80"
                        disabled={
                          (member.permission || member.role) === "admin"
                        }
                        onClick={() => {
                          setMemberToRemove({
                            id: member.id,
                            email: member.email,
                          });
                          setRemoveMemberDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-sm text-muted-foreground"
                >
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sticky bottom-0 bg-muted pt-3 border-t">
        <Button onClick={() => setAddMemberDialogOpen(true)} className="w-full">
          Add member
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
        {/* Top Left Box - Current Sources */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Current Sources</h2>
              <p className="text-sm text-muted-foreground">
                what your agent uses to answer questions
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openMaximizeDialog("currentSources")}
                className="p-1 hover:bg-accent rounded-md transition-colors group"
              >
                <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderCurrentSourcesContent()}
          </div>
        </div>

        {/* Top Right Box - Add New Sources */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Add New Sources</h2>
              <p className="text-sm text-muted-foreground">
                What kind of source would you like to add?
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openMaximizeDialog("addNewSources")}
                className="p-1 hover:bg-accent rounded-md transition-colors group"
              >
                <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderAddNewSourcesContent()}
          </div>
        </div>

        {/* Bottom Left Box - View only members */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Members and permissions
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAddMemberDialogOpen(true)}
                className="p-1 hover:bg-accent rounded-md transition-colors group"
              >
                <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderMembersPermissionsContent()}
          </div>
        </div>

        {/* Bottom Right Box - Edit only members */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Agent Analytics</h2>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex-1">
              {ratingStatsLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading ratings…
                </div>
              ) : !ratingStats ? (
                <div className="text-sm text-muted-foreground">No data yet</div>
              ) : ratingStats.ratedCount < 2 ? (
                <div className="flex gap-6 text-sm">
                  <div>
                    <div className="text-muted-foreground">Messages</div>
                    <div className="font-medium">
                      {ratingStats.messageCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">
                      Correct source chosen
                    </div>
                    <div className="font-medium">
                      {ratingStats.correctSourcePercent ?? 0}%
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/*
                  <div className="flex h-full gap-4">
                    <div className="w-1/2">
                      <AnalyticsHBarChart
                        title="Source accuracy"
                        // description="How often did our source-router get the right source"
                        containerClassName="w-full"
                        chartHeightClassName="h-[100px]"
                        maxValue={100}
                        valueFormatter={(value) => `${Math.round(value)}%`}
                        valueLabel="Rate"
                        items={[
                          {
                            label: "✅",
                            value: ratingStats?.correctSourcePercent ?? 0,
                          },
                          {
                            label: "❌",
                            value: 100 - (ratingStats?.correctSourcePercent ?? 0),
                          },
                        ]}
                      />
                    </div>

                    <div className="w-1/2">
                      <AnalyticsHBarChart
                        title="Thumbs up vs down"
                        // description="Based on rated messages"
                        containerClassName="w-full"
                        chartHeightClassName="h-[100px]"
                        maxValue={100}
                        valueFormatter={(value) => `${Math.round(value)}%`}
                        valueLabel="Rate"
                        items={[
                          {
                            label: "Thumbs up",
                            value: ratingStats?.thumbsUpPercent ?? 0,
                          },
                          {
                            label: "Thumbs down",
                            value: 100 - (ratingStats?.thumbsUpPercent ?? 0),
                          },
                        ]}
                      />
                    </div>
                  </div>
                  */}
                  <div className="grid h-full grid-cols-2 gap-4">
                    <Card className="@container/card">
                      <CardHeader>
                        <CardDescription className="flex items-center gap-2">
                          <span>Thumbs up</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Thumbs up info"
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="text-xs">
                                  Percent of rated messages that got a thumbs
                                  up.
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                          {Math.round(ratingStats?.thumbsUpPercent ?? 0)}%
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="@container/card">
                      <CardHeader>
                        <CardDescription className="flex items-center gap-2">
                          <span>Correct source</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Correct source info"
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                How often the source-rater chosen the correct
                                source
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                          {Math.round(ratingStats?.correctSourcePercent ?? 0)}%
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                </>
              )}
            </div>
            {/* {ratingStatsLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading ratings…
              </div>
            ) : !ratingStats ? (
              <div className="text-sm text-muted-foreground">No data yet</div>
            ) : (
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">Rating</div>
                  {ratingStats.ratedCount < 2 ? (
                    <div>{ratingStats.ratedCount} ratings</div>
                  ) : (
                    <div className="font-medium">
                      {ratingStats.thumbsUpPercent ?? 0}% positive
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Rated messages</div>
                  <div className="font-medium">{ratingStats.ratedCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    Correct source chosen
                  </div>
                  {ratingStats.sourceEvalCount < 2 ? (
                    <div>{ratingStats.sourceEvalCount} cases</div>
                  ) : (
                    <div className="font-medium">
                      {ratingStats.correctSourcePercent ?? 0}%
                    </div>
                  )}
                </div>
              </div>
            )} */}
          </div>
          <div className="sticky bottom-0 bg-muted pt-3 border-t">
            <Button
              onClick={() => {
                if (agentId) {
                  posthog?.capture(
                    "agent:analytics_viewed",
                    getAgentEventProps(),
                  );
                  router.push(`/agent-analytics?id=${agentId}`);
                }
              }}
              disabled={!agentId}
              className="w-full"
            >
              View analytics
            </Button>
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {addMemberDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAddMemberDialogOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg w-[60vw] h-[70vh] flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Cancel button in top left */}
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAddMemberDialogOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Dialog Header */}
            <div className="p-6 border-b pl-16">
              <h2 className="text-2xl font-semibold">Add member</h2>
            </div>

            {/* Dialog Content - to be defined */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingMemberTiles ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Loading members...
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No team members found.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="sticky top-0 z-10 bg-background pb-3">
                    <Input
                      placeholder="Search by email..."
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    {teamMembers
                      .filter((member) => {
                        const query = memberSearch.trim().toLowerCase();
                        if (!query) return true;
                        return (member.email || "")
                          .toLowerCase()
                          .includes(query);
                      })
                      .slice(0, memberSearch.trim() ? undefined : 10)
                      .map((member) => {
                        const agentMember = agentMembers.find(
                          (agentMember) => agentMember.id === member.id,
                        );
                        const isAlreadyMember = agentMemberIds.has(member.id);
                        const isSelected = selectedMemberIds.has(member.id);
                        const roleValue =
                          selectedMemberRoles[member.id] ||
                          agentMember?.permission ||
                          agentMember?.role ||
                          "";
                        return (
                          <Card key={member.id}>
                            <div
                              role="button"
                              tabIndex={isAlreadyMember ? -1 : 0}
                              onClick={() => toggleMemberSelection(member.id)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  toggleMemberSelection(member.id);
                                }
                              }}
                              aria-disabled={isAlreadyMember}
                              className={`flex w-full items-start gap-3 p-4 text-left transition-colors ${
                                isAlreadyMember
                                  ? "cursor-not-allowed"
                                  : isSelected
                                    ? "bg-primary/5"
                                    : "hover:bg-accent"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected || isAlreadyMember}
                                disabled={isAlreadyMember}
                                onCheckedChange={() =>
                                  toggleMemberSelection(member.id)
                                }
                                onClick={(
                                  event: React.MouseEvent<HTMLButtonElement>,
                                ) => event.stopPropagation()}
                              />
                              <div className="flex flex-1 items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">
                                      {member.displayName || "Unnamed member"}
                                    </p>
                                    {(isAlreadyMember || isSelected) && (
                                      <Check
                                        className={`h-4 w-4 ${
                                          isAlreadyMember
                                            ? "text-muted-foreground"
                                            : "text-primary"
                                        }`}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {member.email || "—"}
                                  </p>
                                </div>
                                <div className="w-[140px]">
                                  <Select
                                    value={roleValue}
                                    onValueChange={(value) => {
                                      if (isAlreadyMember) {
                                        setAgentMembers((prev) =>
                                          prev.map((item) =>
                                            item.id === member.id
                                              ? { ...item, role: value }
                                              : item,
                                          ),
                                        );
                                      } else {
                                        setSelectedMemberRoles((roles) => ({
                                          ...roles,
                                          [member.id]: value as
                                            | "view"
                                            | "edit"
                                            | "",
                                        }));
                                      }
                                    }}
                                  >
                                    <SelectTrigger
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                    >
                                      <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="view">view</SelectItem>
                                      <SelectItem value="edit">edit</SelectItem>
                                      <SelectItem value="admin">
                                        admin
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t px-6 py-4">
              <Button
                onClick={handleInviteSelectedMembers}
                disabled={selectedMemberIds.size === 0 || isInvitingMembers}
                className="w-full"
              >
                {isInvitingMembers
                  ? "Inviting..."
                  : `Invite ${selectedMemberIds.size} members to agent`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Source Dialog */}
      {addNewSourceDialogOpen && selectedSourceType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[60vw] h-[85vh] flex flex-col relative">
            {/* Cancel button in top left */}
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeAddNewSourceDialog}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Dialog Header */}
            <div className="p-6 border-b pl-16">
              <h2 className="text-2xl font-semibold">
                Add {selectedSourceType.name} Source
              </h2>
            </div>

            {/* Dialog Content - conditionally rendered based on source type */}
            <div className="flex-1 overflow-y-auto p-6">
              {renderAddNewSourceDialogContent()}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {sourceToDelete?.nickname ||
                sourceToDelete?.name ||
                "this source"}
              "? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Jira Ticket Confirmation Dialog */}
      <AlertDialog
        open={deleteTicketDialogOpen}
        onOpenChange={(open) => {
          setDeleteTicketDialogOpen(open);
          if (!open) {
            setTicketToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ticket?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTicketDialogOpen(false);
                setTicketToDelete(null);
              }}
            >
              Clear
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJiraTicketConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingTicket}
            >
              {isDeletingTicket ? "Deleting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {slackTranscriptSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[70vw] h-[80vh] flex flex-col relative">
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSlackTranscript}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 border-b pl-16">
              <h2 className="text-2xl font-semibold">Slack Transcript</h2>
              <p className="text-sm text-muted-foreground mt-1">
                #{slackTranscriptSource.name || "slack-channel"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <SlackTranscriptViewer
                uid={auth.currentUser?.uid || ""}
                agentId={agentId || ""}
                sourceId={slackTranscriptSource.id}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Description Dialog */}
      <AlertDialog
        open={descriptionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDescriptionDialogOpen(false);
            setEditingDescriptionSource(null);
            setDescriptionInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Source Description</AlertDialogTitle>
            <AlertDialogDescription>
              Update the description for this source. This helps your agent
              determine when to use this source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="this helps your agent determine when we should use this source"
              className="w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDescriptionDialogOpen(false);
                setEditingDescriptionSource(null);
                setDescriptionInput("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDescriptionSave}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maximize Dialog */}
      {maximizeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[60vw] h-[70vh] flex flex-col relative">
            {/* Cancel button in top left */}
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMaximizeDialog}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Dialog Header */}
            <div className="p-6 border-b pl-16">
              {maximizeDialog === "currentSources" && (
                <>
                  <h2 className="text-2xl font-semibold">Current Sources</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    what your agent uses to answer questions
                  </p>
                </>
              )}
              {maximizeDialog === "addNewSources" && (
                <>
                  <h2 className="text-2xl font-semibold">Add New Sources</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    What kind of source would you like to add?
                  </p>
                </>
              )}
            </div>

            {/* Dialog Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {maximizeDialog === "currentSources" &&
                renderCurrentSourcesContent()}
              {maximizeDialog === "addNewSources" &&
                renderAddNewSourcesContent()}
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from this agent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setMemberToRemove(null);
                setRemoveMemberDialogOpen(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!memberToRemove || !teamId || !agentId) {
                  return;
                }
                try {
                  setIsRemovingMember(true);
                  const response = await removeAgentMember(
                    teamId,
                    agentId,
                    memberToRemove.id,
                  );
                  if (response.success) {
                    toast.success("removed member from agent");
                    const memberInfo = agentMembers.find(
                      (member) => member.id === memberToRemove.id,
                    );
                    posthog?.capture("agent: updated_member_permission", {
                      ...getAgentEventProps(),
                      member_email: memberToRemove.email || "",
                      member_name: memberInfo?.displayName || "",
                      member_role:
                        memberInfo?.permission || memberInfo?.role || "",
                    });
                    await refreshAgentMembers();
                    setMemberToRemove(null);
                    setRemoveMemberDialogOpen(false);
                  } else if (response.error) {
                    toast.error(response.error);
                  }
                } catch (error) {
                  console.error("Failed to remove agent member:", error);
                  toast.error("Failed to remove member.");
                } finally {
                  setIsRemovingMember(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingMember}
            >
              {isRemovingMember ? "Removing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Column Types Confirmation Dialog */}
      <AlertDialog
        open={columnTypesDialogOpen}
        onOpenChange={setColumnTypesDialogOpen}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Column Types</AlertDialogTitle>
            <AlertDialogDescription>
              Review and update the column types for your table. You can change
              the type using the dropdown.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-4">
            {Object.entries(columnTypes).map(([columnName, columnData]) => (
              <div
                key={columnName}
                className="flex items-center justify-between gap-4 p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{columnName}</p>
                  <p className="text-xs text-muted-foreground">
                    Detected: {columnData.type} ({columnData.pandas_dtype})
                  </p>
                  {columnData.example_values &&
                    columnData.example_values.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Examples: {columnData.example_values.join(", ")}
                      </p>
                    )}
                </div>
                <div className="flex-1 max-w-xs">
                  <Select
                    value={columnData.canon_dtype}
                    onValueChange={(value) =>
                      handleColumnTypeChange(columnName, value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setColumnTypesDialogOpen(false);
                setColumnTypes({});
                setColumnTypesAgentSourceId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveColumnTypes}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {uploadJobs.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button onClick={() => setIsUploadJobsDrawerOpen(true)}>
            <span className="mr-2">Show upload jobs</span>
            <Badge variant="secondary">{uploadJobs.length}</Badge>
          </Button>
        </div>
      )}

      <Sheet
        open={isUploadJobsDrawerOpen}
        onOpenChange={setIsUploadJobsDrawerOpen}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Upload jobs</SheetTitle>
            <SheetDescription>
              Active uploads for your team.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {uploadJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active upload jobs right now.
              </p>
            ) : (
              uploadJobs.map((job) => {
                const status = job.status ?? "unknown";
                const statusVariant =
                  status === "error"
                    ? "destructive"
                    : status === "processing"
                      ? "secondary"
                      : "outline";
                const isConfluence = job.connector === "confluence";
                const isSlack = job.connector === "slack";
                const isWebsite = job.connector === "website";
                const isDoc = job.connector === "doc";
                const sourceRecord = (
                  job as { sources?: Array<Record<string, unknown>> }
                ).sources?.[0] ?? null;
                const truncateText = (value?: string | null, max = 100) =>
                  value && value.length > max ? `${value.slice(0, max)}...` : value;
                const confluenceUrl = isConfluence
                  ? (sourceRecord as { url?: string })?.url || job.url
                  : undefined;
                const confluenceTitle = isConfluence
                  ? (sourceRecord as { title?: string })?.title ||
                    job.title ||
                    (job as { page?: { title?: string } }).page?.title ||
                    (job as { page_title?: string }).page_title ||
                    (job as { source_title?: string }).source_title
                  : undefined;
                const confluenceExcerpt = isConfluence
                  ? (sourceRecord as { excerpt?: string })?.excerpt ||
                    job.excerpt
                  : undefined;
                const truncatedExcerpt = truncateText(confluenceExcerpt, 100);
                const websiteTitle = isWebsite
                  ? (sourceRecord as { title?: string })?.title ||
                    job.title ||
                    (job as { url?: string }).url
                  : undefined;
                const websiteNickname = isWebsite
                  ? (sourceRecord as { nickname?: string })?.nickname ||
                    (job as { nickname?: string }).nickname
                  : undefined;
                const docNickname = isDoc
                  ? (sourceRecord as { nickname?: string })?.nickname ||
                    (job as { nickname?: string }).nickname
                  : undefined;
                const docFilePath = isDoc
                  ? (sourceRecord as { file_path?: string })?.file_path ||
                    (sourceRecord as { filePath?: string })?.filePath ||
                    (job as { file_path?: string }).file_path ||
                    (job as { filePath?: string }).filePath ||
                    (job as { title?: string }).title
                  : undefined;
                const trimmedFilePath = docFilePath
                  ? docFilePath.split("/files/")[1] || docFilePath
                  : undefined;
                const truncatedFilePath = truncateText(trimmedFilePath, 60);
                return (
                  <div
                    key={job.id}
                    className="rounded-lg border bg-background p-3"
                    onClick={() => {
                      if (isWebsite && websiteTitle) {
                        window.open(websiteTitle, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={statusVariant}>{status}</Badge>
                      {(confluenceUrl || (isWebsite && websiteTitle)) && (
                        <a
                          href={confluenceUrl || websiteTitle}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Open link in new tab"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    {job.connector === "confluence" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Image
                            src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
                            alt="Confluence"
                            width={16}
                            height={16}
                            className="h-4 w-4"
                          />
                          {confluenceUrl ? (
                            <a
                              href={confluenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {confluenceTitle ?? "Untitled page"}
                            </a>
                          ) : (
                            <p className="text-sm font-medium">
                              {confluenceTitle ?? "Untitled page"}
                            </p>
                          )}
                        </div>
                        {truncatedExcerpt && (
                          <p className="text-xs text-muted-foreground">
                            {truncatedExcerpt}
                          </p>
                        )}
                      </div>
                    )}
                    {job.connector === "slack" && (
                      <div className="mt-2 space-y-2">
                        {(() => {
                          const channelName =
                            (sourceRecord as { channel_name?: string })
                              ?.channel_name ||
                            (sourceRecord as { name?: string })?.name ||
                            (job as { channel_name?: string }).channel_name ||
                            job.title ||
                            "Slack channel";
                          return (
                            <div className="flex items-center gap-2">
                              <Image
                                src="https://img.icons8.com/?size=100&id=4n94I13nDTyw&format=png&color=000000"
                                alt="Slack"
                                width={16}
                                height={16}
                                className="h-4 w-4"
                              />
                              <p className="text-sm font-medium">
                                {channelName}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {job.connector === "website" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <CiGlobe className="h-4 w-4" />
                          <p className="text-sm font-medium">
                            {websiteTitle ?? "Website"}
                          </p>
                        </div>
                        {websiteNickname && (
                          <p className="text-xs text-muted-foreground">
                            <span className="italic">@{websiteNickname}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {job.connector === "doc" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <p className="text-sm font-medium">
                            {docNickname ?? "Document"}
                          </p>
                        </div>
                        {docNickname && (
                          <p className="text-xs text-muted-foreground">
                            <span className="italic">@{docNickname}</span>
                          </p>
                        )}
                        {truncatedFilePath && (
                          <p className="text-xs text-muted-foreground">
                            {truncatedFilePath}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Slack Batch Sync Widget */}
      <SlackSyncWidget
        visible={widgetData.visible}
        teamId={slackTeamId}
        rows={widgetData.rows}
        completed={widgetData.completed}
        failed={widgetData.failed}
        total={widgetData.total}
        agentId={agentId || ""}
        uid={user?.uid || ""}
      />
    </>
  );
}
