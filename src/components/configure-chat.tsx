"use client";

import { useState, useEffect } from "react";
import { FileText, File, Trash2, X, Upload, Check } from "lucide-react";
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
import { analyzeTable, uploadWebsiteToPinecone } from "@/tools/api";
import { auth, db } from "@/tools/firebase";
import {
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { IoIosDocument } from "react-icons/io";
import { CiGlobe, CiViewTable, CiCircleAlert } from "react-icons/ci";
import { CgMaximize } from "react-icons/cg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      return (
        <Image
          src="https://img.icons8.com/?size=100&id=h8EoAfgRDYLo&format=png&color=000000"
          alt="Confluence"
          width={16}
          height={16}
          className="h-4 w-4"
        />
      );
    case "slack":
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

export function ConfigureChat({ agentId }: { agentId: string | null }) {
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
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

  // State for description edit dialog
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [editingDescriptionSource, setEditingDescriptionSource] = useState<{
    id: string;
    nickname: string;
    type: string;
    currentDescription: string;
  } | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");

  // Dummy data for view only members
  const [viewOnlyMembers, setViewOnlyMembers] = useState([
    { id: "1", name: "John Doe", email: "john.doe@example.com" },
    { id: "2", name: "Jane Smith", email: "jane.smith@example.com" },
    { id: "3", name: "Bob Johnson", email: "bob.johnson@example.com" },
  ]);

  // Dummy data for edit only members
  const [editOnlyMembers, setEditOnlyMembers] = useState([
    { id: "1", name: "Alice Williams", email: "alice.williams@example.com" },
    { id: "2", name: "Charlie Brown", email: "charlie.brown@example.com" },
  ]);

  // State for "all team members" checkbox - view only
  const [allTeamMembers, setAllTeamMembers] = useState(false);

  // State for "all team members" checkbox - edit only
  const [allTeamMembersEditOnly, setAllTeamMembersEditOnly] = useState(false);

  // State for "Add member" dialog - view only
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  // State for "Add member" dialog - edit only
  const [addMemberDialogOpenEditOnly, setAddMemberDialogOpenEditOnly] =
    useState(false);

  // State for maximize dialog
  const [maximizeDialog, setMaximizeDialog] = useState<
    | "currentSources"
    | "addNewSources"
    | "viewOnlyMembers"
    | "editOnlyMembers"
    | null
  >(null);

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

  // Map backend type to UI type
  const mapBackendTypeTocanon_dtype = (
    backendType: string,
    pandasDtype: string
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
        source.id === id ? { ...source, nickname: newNickname } : source
      )
    );
  };

  const handleNicknameSave = async (sourceId: string) => {
    if (!agentId) return;

    const source = currentSources.find((s) => s.id === sourceId);
    if (!source) return;

    // Get the original nickname from Firestore to compare
    const originalSources = await getAgentSources(agentId);
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
        agentId,
        sourceId,
        newNickname.trim(),
        oldNickname,
        source.type || ""
      );
      // Refresh sources to ensure consistency
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);
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
          s.id === sourceId ? { ...s, nickname: originalNickname } : s
        )
      );
      setEditingSourceId(null);
      setOriginalNicknames((prev) => {
        const newState = { ...prev };
        delete newState[sourceId];
        return newState;
      });
    }
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
    if (!editingDescriptionSource || !agentId) return;

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
        agentId,
        editingDescriptionSource.id,
        newDescription,
        editingDescriptionSource.nickname,
        editingDescriptionSource.type
      );
      // Refresh sources to ensure consistency
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);
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
    if (!sourceToDelete || !agentId) return;

    const source = currentSources.find((s) => s.id === sourceToDelete.id);
    if (!source) return;

    try {
      await deleteSource(
        agentId,
        sourceToDelete.id,
        source.nickname || "",
        source.type || ""
      );

      // Refresh sources from Firestore
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);

      toast.success("Source deleted successfully");
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    } catch (error) {
      console.error("Failed to delete source:", error);
      toast.error("Failed to delete source");
    }
  };

  const handleRemoveMember = (id: string) => {
    setViewOnlyMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const handleRemoveEditOnlyMember = (id: string) => {
    setEditOnlyMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const openMaximizeDialog = (
    box:
      | "currentSources"
      | "addNewSources"
      | "viewOnlyMembers"
      | "editOnlyMembers"
  ) => {
    setMaximizeDialog(box);
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
  };

  const handleAddWebsiteSource = async () => {
    if (!websiteUrl.trim() || !websiteNickname.trim() || !agentId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await addAgentSource(
        agentId,
        websiteNickname.trim(),
        "website",
        websiteUrl.trim()
      );

      // Refresh sources from Firestore
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);

      // Close the dialog and reset form
      closeAddNewSourceDialog();
      toast.success("Website source added successfully");

      // Upload website to Pinecone (non-blocking)
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const namespace = userData.pinecone_namespace;

            if (namespace) {
              uploadWebsiteToPinecone(
                namespace,
                websiteUrl.trim(),
                websiteNickname.trim()
              ).catch((error) => {
                console.error(
                  "Failed to upload website to Pinecone (non-blocking):",
                  error
                );
              });
            }
          }
        } catch (error) {
          console.error(
            "Error fetching user namespace for Pinecone upload:",
            error
          );
        }
      }
    } catch (error) {
      console.error("Failed to add website source:", error);
      toast.error("Failed to add website source");
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
    if (!documentNickname.trim() || !agentId) {
      toast.error("Please enter a nickname");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      // Upload file to Firebase Storage
      const filePath = await uploadSourceFile(
        selectedFile,
        documentNickname.trim()
      );

      // Add source with file path
      const fileName = selectedFile.name;
      await addAgentSource(
        agentId,
        documentNickname.trim(),
        "document",
        fileName,
        filePath,
        documentDescription.trim() || undefined
      );

      // Refresh sources from Firestore
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);

      // Close the dialog and reset form
      closeAddNewSourceDialog();
      toast.success("Document source added successfully");
    } catch (error) {
      console.error("Failed to add document source:", error);
      toast.error("Failed to add document source");
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
        "Wrong file type. Please upload a .csv, .xlsx, or .tsv file."
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
    e: React.ChangeEvent<HTMLInputElement>
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
    if (!tableNickname.trim() || !agentId) {
      toast.error("Please enter a nickname");
      return;
    }

    if (!selectedTableFile) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      // Convert to CSV if needed (xlsx, tsv -> csv)
      const csvFile = await convertToCSV(selectedTableFile);

      // Upload file to Firebase Storage (now as CSV)
      const filePath = await uploadSourceFile(csvFile, tableNickname.trim());

      // Add source with file path - capture the document ID
      // Use original filename for display, but filePath points to CSV
      const fileName = selectedTableFile.name;
      const agentSourceId = await addAgentSource(
        agentId,
        tableNickname.trim(),
        "table",
        fileName,
        filePath
      );

      // Get user ID for API call
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated");
      }

      // Call backend to analyze the table (ONLY for table sources)
      try {
        const analysisResponse = await analyzeTable(
          user.uid,
          agentId,
          agentSourceId
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
                columnData.pandas_dtype
              ),
            };
          }
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
      // Refresh sources from Firestore
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);

      // Close the dialog and reset form
      closeAddNewSourceDialog();
      toast.success("Table source added successfully");
    } catch (error) {
      console.error("Failed to add table source:", error);
      toast.error("Failed to add table source");
    }
  };

  const handleDeleteTableSource = async () => {
    if (!tableSourcePendingReview || !agentId) return;

    try {
      await deleteTableSource(
        agentId,
        tableSourcePendingReview.agentSourceId,
        tableSourcePendingReview.nickname,
        tableSourcePendingReview.filePath
      );

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
            columnData.pandas_dtype
          ),
        };
      }
    );
    setColumnTypes(mappedColumns);
    setColumnTypesAgentSourceId(tableSourcePendingReview.agentSourceId);
    setTableSourcePendingReview(null);
    setColumnTypesDialogOpen(true);
    // Don't close the add source dialog yet - wait for column confirmation
  };

  const handleColumnTypeChange = (
    columnName: string,
    newcanon_dtype: string
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
    if (!columnTypesAgentSourceId || !agentId) return;

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
        "users",
        user.uid,
        "agents",
        agentId,
        "sources",
        columnTypesAgentSourceId
      );
      await updateDoc(agentSourceRef, {
        columnMetadata: columnMetadata,
        updatedAt: serverTimestamp(),
      });

      // Also update user's source document
      const userSourcesRef = collection(db, "users", user.uid, "sources");
      const querySnapshot = await getDocs(
        query(userSourcesRef, where("type", "==", "table"))
      );

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const agentsArray = data.agents || [];
        if (agentsArray.includes(agentId)) {
          const userSourceRef = doc(
            db,
            "users",
            user.uid,
            "sources",
            docSnap.id
          );
          await updateDoc(userSourceRef, {
            columnMetadata: columnMetadata,
            updatedAt: serverTimestamp(),
          });
          break;
        }
      }

      // Refresh sources and close dialogs
      const sources = await getAgentSources(agentId);
      setCurrentSources(sources);

      setColumnTypesDialogOpen(false);
      setColumnTypes({});
      setColumnTypesAgentSourceId(null);

      // Only close the "add new source" dialog if it's open (i.e., we're adding a new source)
      if (addNewSourceDialogOpen) {
        closeAddNewSourceDialog();
        toast.success("Table source added successfully");
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
    if (!agentId) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated");
      }

      // Call analyzeTable to get column metadata
      const analysisResponse = await analyzeTable(user.uid, agentId, sourceId);

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
              columnData.pandas_dtype
            ),
          };
        }
      );
      setColumnTypes(mappedColumns);
      setColumnTypesAgentSourceId(sourceId);
      setColumnTypesDialogOpen(true);
    } catch (error) {
      console.error("Failed to analyze table for source:", error);
      toast.error("Failed to load column metadata");
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

  // Fetch sources from Firestore when agentId is available
  useEffect(() => {
    const fetchSources = async () => {
      if (!agentId) {
        setCurrentSources([]);
        return;
      }

      try {
        setIsLoadingSources(true);
        const sources = await getAgentSources(agentId);
        setCurrentSources(sources);
      } catch (error) {
        console.error("Failed to fetch sources:", error);
        setCurrentSources([]);
      } finally {
        setIsLoadingSources(false);
      }
    };

    fetchSources();
  }, [agentId]);

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
            {currentSources.map((source) => (
              <tr key={source.id} className="border-b last:border-b-0">
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    {getFileTypeIcon(source)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={source.nickname || ""}
                      onChange={(e) =>
                        handleNicknameChange(source.id, e.target.value)
                      }
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          await handleNicknameSave(source.id);
                        }
                        if (e.key === "Escape") {
                          // Revert changes on Escape
                          const originalNickname =
                            originalNicknames[source.id] || "";
                          setCurrentSources((prev) =>
                            prev.map((s) =>
                              s.id === source.id
                                ? { ...s, nickname: originalNickname }
                                : s
                            )
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
            ))}
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
          className="flex flex-col items-center justify-center p-4 rounded-md bg-background border border-border cursor-pointer hover:bg-accent transition-colors aspect-square"
        >
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
                disabled={!documentNickname.trim() || !selectedFile}
              >
                Done
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
                disabled={!websiteUrl.trim() || !websiteNickname.trim()}
              >
                Done
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
                  disabled={!tableNickname.trim() || !selectedTableFile}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        );
      case "jira":
        return (
          <div>
            {/* Jira-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Jira source configuration
            </p>
          </div>
        );
      case "confluence":
        return (
          <div>
            {/* Confluence-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Confluence source configuration
            </p>
          </div>
        );
      case "slack":
        return (
          <div>
            {/* Slack-specific UI will go here */}
            <p className="text-sm text-muted-foreground">
              Slack source configuration
            </p>
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

  const renderViewOnlyMembersContent = () => (
    <div className="flex flex-col h-full">
      {/* Sticky header with checkbox */}
      <div className="sticky top-0 bg-muted z-10 pb-3 mb-3 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allTeamMembers}
            onChange={(e) => setAllTeamMembers(e.target.checked)}
            className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <span className="text-sm font-medium">all team members</span>
        </label>
      </div>

      {/* Members list - scrollable */}
      <div className="flex-1 overflow-y-auto pb-16">
        {!allTeamMembers && (
          <div className="space-y-2">
            {viewOnlyMembers.length > 0 ? (
              viewOnlyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background border border-border"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="ml-4 p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members added yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sticky "Add member" button at bottom */}
      <div className="sticky bottom-0 bg-muted pt-3 border-t">
        <Button onClick={() => setAddMemberDialogOpen(true)} className="w-full">
          Add member
        </Button>
      </div>
    </div>
  );

  const renderEditOnlyMembersContent = () => (
    <div className="flex flex-col h-full">
      {/* Sticky header with checkbox */}
      <div className="sticky top-0 bg-muted z-10 pb-3 mb-3 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allTeamMembersEditOnly}
            onChange={(e) => setAllTeamMembersEditOnly(e.target.checked)}
            className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <span className="text-sm font-medium">all team members</span>
        </label>
      </div>

      {/* Members list - scrollable */}
      <div className="flex-1 overflow-y-auto pb-16">
        {!allTeamMembersEditOnly && (
          <div className="space-y-2">
            {editOnlyMembers.length > 0 ? (
              editOnlyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background border border-border"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveEditOnlyMember(member.id)}
                    className="ml-4 p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members added yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sticky "Add member" button at bottom */}
      <div className="sticky bottom-0 bg-muted pt-3 border-t">
        <Button
          onClick={() => setAddMemberDialogOpenEditOnly(true)}
          className="w-full"
        >
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
              <h2 className="text-lg font-semibold mb-1">View only members</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openMaximizeDialog("viewOnlyMembers")}
                className="p-1 hover:bg-accent rounded-md transition-colors group"
              >
                <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderViewOnlyMembersContent()}
          </div>
        </div>

        {/* Bottom Right Box - Edit only members */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">Edit only members</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openMaximizeDialog("editOnlyMembers")}
                className="p-1 hover:bg-accent rounded-md transition-colors group"
              >
                <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderEditOnlyMembersContent()}
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {addMemberDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[60vw] h-[70vh] flex flex-col relative">
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
              {/* Content will be added here */}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Dialog - Edit Only */}
      {addMemberDialogOpenEditOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[60vw] h-[70vh] flex flex-col relative">
            {/* Cancel button in top left */}
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAddMemberDialogOpenEditOnly(false)}
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
              {/* Content will be added here */}
            </div>
          </div>
        </div>
      )}

      {/* Add New Source Dialog */}
      {addNewSourceDialogOpen && selectedSourceType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-[60vw] h-[70vh] flex flex-col relative">
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
              {maximizeDialog === "viewOnlyMembers" && (
                <h2 className="text-2xl font-semibold">View only members</h2>
              )}
              {maximizeDialog === "editOnlyMembers" && (
                <h2 className="text-2xl font-semibold">Edit only members</h2>
              )}
            </div>

            {/* Dialog Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {maximizeDialog === "currentSources" &&
                renderCurrentSourcesContent()}
              {maximizeDialog === "addNewSources" &&
                renderAddNewSourcesContent()}
              {maximizeDialog === "viewOnlyMembers" &&
                renderViewOnlyMembersContent()}
              {maximizeDialog === "editOnlyMembers" && (
                <div>{/* Content for edit only members */}</div>
              )}
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
