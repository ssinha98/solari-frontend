"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfigureWorkflow } from "@/components/configure-workflow";
import { RunWorkflow } from "@/components/run-workflow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ChevronDown, ExternalLink } from "lucide-react";
import { createAgent, updateAgentName } from "@/tools/agent_tools";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

function WorkflowAgentContent() {
  const router = useRouter();
  const posthog = usePostHog();
  const [editMode, setEditMode] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [canEditAgent, setCanEditAgent] = useState<boolean | null>(null);
  const [versions, setVersions] = useState<{ label: string; versionId: string; createdAt: string }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [resolvedAgentName, setResolvedAgentName] = useState("");
  const searchParams = useSearchParams();
  const hasCreatedRef = useRef(false);

  const displayName = searchParams.get("name") || "Workflow agent";

  // ─── Load team/agent context for PostHog ─────────────────────────────────

  useEffect(() => {
    const fetchAgentContext = async () => {
      const user = auth.currentUser;
      if (!user || !agentId) {
        setTeamId(null);
        setTeamName("");
        setResolvedAgentName(displayName);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        setTeamId(nextTeamId ?? null);

        if (!nextTeamId) {
          setTeamName("");
          setResolvedAgentName(displayName);
          return;
        }

        const teamSnap = await getDoc(doc(db, "teams", nextTeamId));
        const nextTeamName = teamSnap.data()?.team_name;
        setTeamName(typeof nextTeamName === "string" ? nextTeamName : "");

        const agentSnap = await getDoc(
          doc(db, "teams", nextTeamId, "agents", agentId),
        );
        const nextAgentName = agentSnap.data()?.name;
        setResolvedAgentName(
          typeof nextAgentName === "string" && nextAgentName
            ? nextAgentName
            : displayName,
        );
      } catch (error) {
        console.error("Failed to load agent context:", error);
        setTeamName("");
        setResolvedAgentName(displayName);
      }
    };

    fetchAgentContext();
  }, [agentId, displayName]);

  const getAgentEventProps = () => {
    const eventProps: Record<string, string> = {};
    const userId = auth.currentUser?.uid;
    if (userId) eventProps.user_id = userId;
    if (teamId) eventProps.team_id = teamId;
    if (teamName) eventProps.team_name = teamName;
    if (agentId) {
      eventProps.agent_id = agentId;
      eventProps.agent_name = resolvedAgentName || displayName;
    }
    return eventProps;
  };

  // ─── Fetch versions ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!agentId) return;
    const fetchVersions = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setVersionsLoading(true);
      try {
        const res = await fetch("/api/workflow/list-versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.uid, agent_id: agentId }),
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.versions)) {
          const sorted = [...json.versions].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setVersions(sorted);
          if (sorted.length > 0) setSelectedVersion(sorted[0].versionId);
        }
      } catch (err) {
        console.error("Failed to fetch versions:", err);
      } finally {
        setVersionsLoading(false);
      }
    };
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchVersions();
    });
    return () => unsubscribe();
  }, [agentId]);

  // ─── Agent creation / URL params ─────────────────────────────────────────

  useEffect(() => {
    const idFromParams = searchParams.get("id");
    const shouldCreateNew = searchParams.get("new") === "true";
    const shouldEdit = searchParams.get("edit") === "true";

    setEditMode(shouldEdit);

    if (idFromParams) {
      setAgentId(idFromParams);
    }

    if (shouldCreateNew && !idFromParams && !hasCreatedRef.current) {
      hasCreatedRef.current = true;
      setIsCreating(true);

      const initializeAgent = async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            throw new Error("User must be authenticated to create an agent");
          }
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const tid = userSnap.exists()
            ? (userSnap.data().teamId as string | undefined)
            : undefined;
          if (!tid) {
            throw new Error("Team ID not found");
          }
          const id = await createAgent("workflow", tid, user.uid);
          setAgentId(id);
          setShowNameDialog(true);
        } catch (error) {
          console.error("Failed to create workflow agent:", error);
        } finally {
          setIsCreating(false);
        }
      };

      initializeAgent();
    }
  }, [searchParams]);

  // ─── Permission check ─────────────────────────────────────────────────────

  useEffect(() => {
    const checkAgentPermission = async () => {
      const user = auth.currentUser;
      if (!user || !agentId) {
        setCanEditAgent(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setCanEditAgent(false);
          return;
        }

        const tid = userSnap.data().teamId as string | undefined;
        if (!tid) {
          setCanEditAgent(false);
          return;
        }

        const teamUserSnap = await getDoc(
          doc(db, "teams", tid, "users", user.uid),
        );
        if (!teamUserSnap.exists()) {
          setCanEditAgent(false);
          return;
        }

        const data = teamUserSnap.data();
        const agents = Array.isArray(data.agents) ? data.agents : [];
        const agentPermission = agents.find(
          (a: { agent_id?: string; role?: string }) => a.agent_id === agentId,
        )?.role;

        setCanEditAgent(
          agentPermission === "edit" || agentPermission === "admin",
        );
      } catch (error) {
        console.error("Failed to check agent permissions:", error);
        setCanEditAgent(false);
      }
    };

    checkAgentPermission();
  }, [agentId]);

  useEffect(() => {
    if (canEditAgent === false && editMode) {
      setEditMode(false);
      toast.error(
        "You don't have permission to edit this agent. Contact your team admin or the owner of this agent if you think this is wrong.",
      );
    }
  }, [canEditAgent, editMode]);

  // ─── Name dialog ──────────────────────────────────────────────────────────

  const handleSaveName = async () => {
    if (!agentId || !agentName.trim()) return;

    try {
      setIsSaving(true);
      const trimmedName = agentName.trim();
      await updateAgentName(agentId, trimmedName);
      posthog?.capture("create_new_agent: complete", {
        ...getAgentEventProps(),
        agent_name: trimmedName,
      });
      setShowNameDialog(false);
      router.replace(
        `/workflowAgent?id=${agentId}&edit=false&name=${encodeURIComponent(trimmedName)}`,
      );
    } catch (error) {
      console.error("Failed to save agent name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isCreating) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Creating workflow agent...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* View dropdown + Use workflow link */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {editMode ? "Workflow settings" : "Edit workflow"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  posthog?.capture("agent:edit_mode_off", getAgentEventProps());
                  setEditMode(false);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("edit", "false");
                  router.replace(`?${params.toString()}`);
                }}
              >
                Edit workflow
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (canEditAgent === false) {
                    toast.error(
                      "You don't have permission to edit this agent. Contact your team admin or the owner of this agent if you think this is wrong.",
                    );
                    return;
                  }
                  posthog?.capture("agent:edit_mode_on", getAgentEventProps());
                  setEditMode(true);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("edit", "true");
                  router.replace(`?${params.toString()}`);
                }}
              >
                Workflow settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          {agentId && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Agent versions</Label>
                {versionsLoading ? (
                  <Skeleton className="h-8 w-[140px] rounded-md" />
                ) : (
                  <Select
                    value={selectedVersion}
                    onValueChange={(versionId) => {
                      setSelectedVersion(versionId);
                      window.open(
                        `/workflowAgent?id=${agentId}&version=${versionId}${displayName ? `&name=${encodeURIComponent(displayName)}` : ""}`,
                        "_blank"
                      );
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.versionId} value={v.versionId}>
                          <div className="flex items-center gap-2">
                            <span>{v.label}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Link
                href={`/use-workflow?id=${agentId}${displayName ? `&name=${encodeURIComponent(displayName)}` : ""}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Use workflow →
              </Link>
              <Link
                href={`/workflow-analytics?id=${agentId}${displayName ? `&name=${encodeURIComponent(displayName)}` : ""}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Analytics →
              </Link>
            </div>
          )}
        </div>

        {editMode ? (
          <ConfigureWorkflow agentId={agentId} />
        ) : (
          <RunWorkflow agentId={agentId} displayName={displayName} />
        )}
      </div>

      {/* Name dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Agent</DialogTitle>
            <DialogDescription>
              Give your workflow agent a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g., Onboarding Workflow"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && agentName.trim()) {
                    handleSaveName();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveName}
              disabled={!agentName.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function WorkflowAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <WorkflowAgentContent />
    </Suspense>
  );
}
