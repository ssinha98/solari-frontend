"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfigureChat } from "@/components/configure-chat";
import { RunChat } from "@/components/run-chat";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

function ChatAgentContent() {
  const router = useRouter();
  const posthog = usePostHog();
  const [editMode, setEditMode] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [canEditAgent, setCanEditAgent] = useState<boolean | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [resolvedAgentName, setResolvedAgentName] = useState("");
  const searchParams = useSearchParams();
  const hasCreatedRef = useRef(false);

  const displayName = searchParams.get("name") || "Source chat agent";

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
      eventProps.agent_name = resolvedAgentName || displayName;
    }
    return eventProps;
  };

  useEffect(() => {
    const idFromParams = searchParams.get("id");
    const shouldCreateNew = searchParams.get("new") === "true";
    const shouldEdit = searchParams.get("edit") === "true";

    setEditMode(shouldEdit);

    if (idFromParams) {
      setAgentId(idFromParams);
    }

    // Only create if ?new=true, no existing id, and we haven't created one yet
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
          const teamId = userSnap.exists()
            ? (userSnap.data().teamId as string | undefined)
            : undefined;
          if (!teamId) {
            throw new Error("Team ID not found");
          }
          const id = await createAgent("source chat", teamId, user.uid);
          setAgentId(id);
          setShowNameDialog(true);
        } catch (error) {
          console.error("Failed to create Chat (RAG) agent:", error);
        } finally {
          setIsCreating(false);
        }
      };

      initializeAgent();
    }
  }, [searchParams]);

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

        const teamId = userSnap.data().teamId as string | undefined;
        if (!teamId) {
          setCanEditAgent(false);
          return;
        }

        const teamUserSnap = await getDoc(
          doc(db, "teams", teamId, "users", user.uid)
        );
        if (!teamUserSnap.exists()) {
          setCanEditAgent(false);
          return;
        }

        const data = teamUserSnap.data();
        const agents = Array.isArray(data.agents) ? data.agents : [];
        const agentPermission = agents.find(
          (agent: { agent_id?: string; role?: string }) =>
            agent.agent_id === agentId
        )?.role;

        setCanEditAgent(
          agentPermission === "edit" || agentPermission === "admin"
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
        "You don't have permission to edit this agent. Contact your team admin or the owner of this agent if you thikn this is wrong"
      );
    }
  }, [canEditAgent, editMode]);

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
        `/chatAgent?id=${agentId}&edit=false&name=${encodeURIComponent(
          trimmedName
        )}`
      );
    } catch (error) {
      console.error("Failed to save agent name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Creating Chat (RAG) agent...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              id="edit-mode"
              checked={editMode}
              onCheckedChange={(next) => {
                if (next && canEditAgent === false) {
                  toast.error(
                    "You don't have permission to edit this agent. Contact your team admin or the owner of this agent if you thikn this is wrong"
                  );
                  return;
                }
                posthog?.capture(
                  next ? "agent:edit_mode_on" : "agent:edit_mode_off",
                  getAgentEventProps(),
                );
                setEditMode(next);
              }}
            />
            <Label htmlFor="edit-mode">Edit mode</Label>
          </div>
        </div>

        {editMode ? (
          <ConfigureChat agentId={agentId} />
        ) : (
          <RunChat agentId={agentId} />
        )}
      </div>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Agent</DialogTitle>
            <DialogDescription>
              Give your Chat (RAG) agent a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g., Support Chat"
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

export default function ChatAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ChatAgentContent />
    </Suspense>
  );
}
