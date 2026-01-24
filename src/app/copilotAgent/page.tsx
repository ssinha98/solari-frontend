"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { createAgent, updateAgentName } from "@/tools/agent_tools";
import { auth, db } from "@/tools/firebase";
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
import { Label } from "@/components/ui/label";

function CopilotAgentContent() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();
  const hasCreatedRef = useRef(false);

  const displayName = searchParams.get("name") || "Copilot agent";

  useEffect(() => {
    const idFromParams = searchParams.get("id");
    const shouldCreateNew = searchParams.get("new") === "true";

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
          const id = await createAgent("copilot", teamId, user.uid);
          setAgentId(id);
          setShowNameDialog(true);
        } catch (error) {
          console.error("Failed to create copilot agent:", error);
        } finally {
          setIsCreating(false);
        }
      };

      initializeAgent();
    }
  }, [searchParams]);

  const handleSaveName = async () => {
    if (!agentId || !agentName.trim()) return;

    try {
      setIsSaving(true);
      await updateAgentName(agentId, agentName.trim());
      setShowNameDialog(false);
    } catch (error) {
      console.error("Failed to save agent name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Creating copilot agent...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">{displayName}</h1>
          <p className="text-muted-foreground">
            Create and configure your copilot agent.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Copilot agent configuration goes here.
          </p>
          {agentId && (
            <p className="text-xs text-muted-foreground mt-2">
              Agent ID: {agentId}
            </p>
          )}
        </div>
      </div>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Agent</DialogTitle>
            <DialogDescription>
              Give your copilot agent a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g., HR Copilot"
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

export default function CopilotAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <CopilotAgentContent />
    </Suspense>
  );
}
