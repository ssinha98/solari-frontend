"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CgMaximize } from "react-icons/cg";
import {
  listAgentMembers,
  listTeamMembers,
  addAgentMembers,
  removeAgentMember,
} from "@/tools/api";
import { auth, db } from "@/tools/firebase";
import {
  getDoc,
  doc,
  collection,
  getDocs,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { computeRatingAnalytics, type RatingDoc } from "@/lib/utils";

type AgentMember = {
  id: string;
  displayName?: string;
  email?: string;
  role?: string;
  permission?: string;
};

type TeamMember = {
  id: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
};

export function ConfigureWorkflow({ agentId }: { agentId: string | null }) {
  const posthog = usePostHog();
  const router = useRouter();

  // Team / agent context
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");

  // Members
  const [agentMembers, setAgentMembers] = useState<AgentMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [agentMemberIds, setAgentMemberIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
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

  // Agent load
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);

  // Trigger method
  const [triggerMethod, setTriggerMethod] = useState<string>("");
  const [isSavingTrigger, setIsSavingTrigger] = useState(false);

  // Output type
  const [tableOutputEnabled, setTableOutputEnabled] = useState(false);
  const [isSavingOutputType, setIsSavingOutputType] = useState(false);

  // Analytics
  const [ratingStats, setRatingStats] = useState<ReturnType<
    typeof computeRatingAnalytics
  > | null>(null);
  const [ratingStatsLoading, setRatingStatsLoading] = useState(false);

  // ─── Firebase: teamId ───────────────────────────────────────────────────────

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

  // ─── Firebase: teamName ─────────────────────────────────────────────────────

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

  // ─── Firebase: agentName ────────────────────────────────────────────────────

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

  // ─── Backend: load agent info ───────────────────────────────────────────────

  useEffect(() => {
    const loadAgent = async () => {
      const user = auth.currentUser;
      if (!user || !agentId) return;

      setIsLoadingAgent(true);
      try {
        const response = await fetch("/api/workflow/get-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.uid, agent_id: agentId }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          if (data.agent && typeof data.agent.trigger === "string") {
            setTriggerMethod(data.agent.trigger);
          }
          const outputType =
            data.outputType ??
            data.agent?.outputType ??
            data.agent?.output_type ??
            data.version?.outputType ??
            data.workflowConfig?.outputType ??
            "single";
          setTableOutputEnabled(outputType === "table");
        }
      } catch (error) {
        console.error("Failed to load workflow agent:", error);
      } finally {
        setIsLoadingAgent(false);
      }
    };

    loadAgent();
  }, [agentId]);

  // ─── Firebase: ratings ──────────────────────────────────────────────────────

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
        const ratingDocs = snap.docs.map((d) => d.data() as RatingDoc);
        setRatingStats(computeRatingAnalytics(ratingDocs));
      } catch (err) {
        console.error("Failed to load rating analytics", err);
        setRatingStats(null);
      } finally {
        setRatingStatsLoading(false);
      }
    };
    fetchRatings();
  }, [agentId, teamId]);

  // ─── Firebase: agent members ────────────────────────────────────────────────

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

  // ─── Firebase: team members for invite dialog ───────────────────────────────

  useEffect(() => {
    const fetchMembersForInvite = async () => {
      if (!addMemberDialogOpen || !teamId || !agentId) return;

      try {
        setIsLoadingMemberTiles(true);
        const [teamMembersResponse, agentMembersResponse] = await Promise.all([
          listTeamMembers(teamId, auth.currentUser?.uid || ""),
          listAgentMembers(teamId, agentId),
        ]);

        setTeamMembers(
          teamMembersResponse.members.map((member, index) => ({
            id: member.uid || `member-${index}`,
            displayName: member.displayName,
            email: member.email,
            photoURL: member.photoURL,
          })),
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
        setAgentMembers(nextAgentMembers);
        setAgentMemberIds(new Set(nextAgentMembers.map((m) => m.id)));
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

  // Escape key closes add-member dialog
  useEffect(() => {
    if (!addMemberDialogOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMemberDialogOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [addMemberDialogOpen]);

  // ─── Event props ────────────────────────────────────────────────────────────

  const getAgentEventProps = () => {
    const eventProps: Record<string, string> = {};
    const userId = auth.currentUser?.uid;
    if (userId) eventProps.user_id = userId;
    if (teamId) eventProps.team_id = teamId;
    if (teamName) eventProps.team_name = teamName;
    if (agentId) {
      eventProps.agent_id = agentId;
      eventProps.agent_name = agentName || "Workflow agent";
    }
    return eventProps;
  };

  // ─── Member handlers ────────────────────────────────────────────────────────

  const refreshAgentMembers = async () => {
    if (!teamId || !agentId) return;
    try {
      const refreshed = await listAgentMembers(teamId, agentId);
      if (refreshed.success) {
        const members = refreshed.members.map((member, index) => ({
          id: member.uid || member.id || member.email || `member-${index}`,
          displayName: member.displayName,
          email: member.email,
          role: member.role,
          permission: member.permission,
        }));
        setAgentMembers(members);
        setAgentMemberIds(new Set(members.map((m) => m.id)));
      }
    } catch (error) {
      console.error("Failed to refresh agent members:", error);
    }
  };

  const handleAgentRoleChange = async (
    memberId: string,
    email: string | undefined,
    permission: "view" | "edit" | "admin",
  ) => {
    if (!teamId || !agentId || !email) return;
    try {
      const response = await addAgentMembers(
        teamId,
        agentId,
        agentName || "Workflow agent",
        [{ email, permission }],
      );
      if (response.success && (!response.failures || response.failures.length === 0)) {
        setAgentMembers((prev) =>
          prev.map((member) =>
            member.id === memberId
              ? { ...member, permission, role: permission }
              : member,
          ),
        );
        const memberInfo = agentMembers.find((m) => m.id === memberId);
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
          if (failure.email) toast.error(`Failed to update ${failure.email}`);
        });
      }
    } catch (error) {
      console.error("Failed to update agent member role:", error);
      toast.error("Failed to update member role.");
    }
  };

  const handleAddMembers = async () => {
    if (!teamId || !agentId || selectedMemberIds.size === 0) return;

    const membersToAdd = Array.from(selectedMemberIds).map((id) => {
      const member = teamMembers.find((m) => m.id === id);
      return {
        email: member?.email || "",
        permission: (selectedMemberRoles[id] || "view") as
          | "view"
          | "edit"
          | "admin",
      };
    });

    try {
      setIsInvitingMembers(true);
      const response = await addAgentMembers(
        teamId,
        agentId,
        agentName || "Workflow agent",
        membersToAdd,
      );

      if (response.success) {
        posthog?.capture("agent: added_members", {
          ...getAgentEventProps(),
          member_count: membersToAdd.length.toString(),
        });
        toast.success("Members added.");
        setAddMemberDialogOpen(false);
        await refreshAgentMembers();
      } else {
        toast.error("Failed to add members.");
      }
    } catch (error) {
      console.error("Failed to add members:", error);
      toast.error("Failed to add members.");
    } finally {
      setIsInvitingMembers(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!teamId || !agentId || !memberToRemove) return;
    try {
      setIsRemovingMember(true);
      await removeAgentMember(teamId, agentId, memberToRemove.id);
      posthog?.capture("agent: removed_member", {
        ...getAgentEventProps(),
        member_email: memberToRemove.email || "",
      });
      toast.success("Member removed.");
      setRemoveMemberDialogOpen(false);
      setMemberToRemove(null);
      await refreshAgentMembers();
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error("Failed to remove member.");
    } finally {
      setIsRemovingMember(false);
    }
  };

  // ─── Output type handler ────────────────────────────────────────────────────

  const handleOutputTypeChange = async (enabled: boolean) => {
    setTableOutputEnabled(enabled);

    const user = auth.currentUser;
    if (!user || !agentId) return;

    setIsSavingOutputType(true);
    try {
      const response = await fetch("/api/workflow/version/set-output-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          output_type: enabled ? "table" : "single",
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      toast.success(enabled ? "Table output enabled" : "Table output disabled");
    } catch (error) {
      console.error("Failed to save output type:", error);
      toast.error("Failed to save output type. Please try again.");
      setTableOutputEnabled(!enabled);
    } finally {
      setIsSavingOutputType(false);
    }
  };

  // ─── Trigger method handler ─────────────────────────────────────────────────

  const handleTriggerChange = async (value: string) => {
    setTriggerMethod(value);

    const user = auth.currentUser;
    if (!user || !agentId) return;

    setIsSavingTrigger(true);
    try {
      const response = await fetch("/api/workflow/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          trigger: value,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      toast.success("Trigger saved");
      posthog?.capture("agent: workflow_trigger_updated", {
        ...getAgentEventProps(),
        trigger: value,
      });
    } catch (error) {
      console.error("Failed to save workflow trigger:", error);
      toast.error("Failed to save trigger. Please try again.");
    } finally {
      setIsSavingTrigger(false);
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderMembersContent = () => (
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
            {isLoadingAgent || isLoadingMembers ? (
              <>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-[140px]" /></TableCell>
                  </TableRow>
                ))}
              </>
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
                        disabled={(member.permission || member.role) === "admin"}
                        onClick={() => {
                          setMemberToRemove({ id: member.id, email: member.email });
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
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
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

  const renderAnalyticsContent = () => {
    if (isLoadingAgent || ratingStatsLoading) {
      return (
        <div className="flex gap-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      );
    }
    if (!ratingStats) {
      return <div className="text-sm text-muted-foreground">No data yet</div>;
    }
    return (
      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-muted-foreground">Messages</div>
          <div className="font-medium">{ratingStats.messageCount}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Thumbs up</div>
          <div className="font-medium">
            {Math.round(ratingStats.thumbsUpPercent ?? 0)}%
          </div>
        </div>
      </div>
    );
  };

  // ─── Filtered team members for invite dialog ─────────────────────────────────

  const filteredTeamMembers = teamMembers.filter((member) => {
    const search = memberSearch.toLowerCase();
    return (
      member.displayName?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search)
    );
  });

  // ─── UI ──────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
        {/* Top Left — Workflow Trigger */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-1">Workflow Trigger</h2>
            <p className="text-sm text-muted-foreground">
              How this workflow gets started.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingAgent ? (
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-[160px]" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Workflow Trigger Method
                    </span>
                    {isSavingTrigger && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        Saving…
                      </span>
                    )}
                  </div>
                  <Select
                    value={triggerMethod}
                    onValueChange={handleTriggerChange}
                    disabled={isSavingTrigger}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui">Manual</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Top Right — Output Type */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-1">Output Type</h2>
            <p className="text-sm text-muted-foreground">
              Configure how this workflow produces output.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="table-output" className="text-sm font-medium cursor-pointer">
                    Table output
                  </Label>
                  {isSavingOutputType && (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      Saving…
                    </span>
                  )}
                </div>
                <Switch
                  id="table-output"
                  checked={tableOutputEnabled}
                  onCheckedChange={handleOutputTypeChange}
                  disabled={isSavingOutputType}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Left — Members and permissions */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Members and permissions
              </h2>
            </div>
            <button
              onClick={() => setAddMemberDialogOpen(true)}
              className="p-1 hover:bg-accent rounded-md transition-colors group"
            >
              <CgMaximize className="h-4 w-4 transition-opacity group-hover:opacity-70" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{renderMembersContent()}</div>
        </div>

        {/* Bottom Right — Analytics */}
        <div className="rounded-lg bg-muted p-6 flex flex-col h-[calc(50vh-6rem)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-1">Agent Runs & Analytics</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            {renderAnalyticsContent()}
          </div>
          <div className="sticky bottom-0 pt-3 border-t mt-3">
            <Button
              onClick={() => {
                if (agentId) router.push(`/workflow-analytics?id=${agentId}`);
              }}
              disabled={!agentId}
              className="w-full"
            >
              View runs & analytics
            </Button>
          </div>
        </div>
      </div>

      {/* ── Add member dialog ───────────────────────────────────────────────── */}
      {addMemberDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setAddMemberDialogOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold">Add members</h2>
              <p className="text-sm text-muted-foreground">
                Select team members to add to this workflow agent.
              </p>
            </div>

            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search by name or email…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />

            <div className="max-h-64 overflow-y-auto space-y-2">
              {isLoadingMemberTiles ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : filteredTeamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members found.</p>
              ) : (
                filteredTeamMembers.map((member) => {
                  const alreadyAdded = agentMemberIds.has(member.id);
                  const isSelected = selectedMemberIds.has(member.id);
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 rounded-md border p-3 ${
                        alreadyAdded ? "opacity-50" : "cursor-pointer hover:bg-muted"
                      }`}
                      onClick={() => {
                        if (alreadyAdded) return;
                        setSelectedMemberIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(member.id)) {
                            next.delete(member.id);
                          } else {
                            next.add(member.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <Checkbox
                        checked={isSelected || alreadyAdded}
                        disabled={alreadyAdded}
                        onCheckedChange={() => {
                          if (alreadyAdded) return;
                          setSelectedMemberIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(member.id)) {
                              next.delete(member.id);
                            } else {
                              next.add(member.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.displayName || member.email || "Unknown"}
                        </p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        )}
                      </div>
                      {isSelected && !alreadyAdded && (
                        <Select
                          value={selectedMemberRoles[member.id] || "view"}
                          onValueChange={(value) =>
                            setSelectedMemberRoles((prev) => ({
                              ...prev,
                              [member.id]: value as "view" | "edit" | "admin",
                            }))
                          }
                        >
                          <SelectTrigger
                            className="w-[110px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">view</SelectItem>
                            <SelectItem value="edit">edit</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {alreadyAdded && (
                        <span className="text-xs text-muted-foreground">
                          Added
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddMemberDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMembers}
                disabled={selectedMemberIds.size === 0 || isInvitingMembers}
              >
                {isInvitingMembers ? "Adding…" : "Add members"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove member dialog ─────────────────────────────────────────────── */}
      <AlertDialog
        open={removeMemberDialogOpen}
        onOpenChange={(open) => {
          setRemoveMemberDialogOpen(open);
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">
                {memberToRemove?.email ?? "this member"}
              </span>{" "}
              from this workflow agent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRemoveMemberDialogOpen(false);
                setMemberToRemove(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingMember}
            >
              {isRemovingMember ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
