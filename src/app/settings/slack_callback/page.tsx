"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/tools/firebase";
import { collection, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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

interface SlackInstallation {
  id: string;
  team: {
    id: string;
    name: string;
  };
  team_id: string;
  bot_token: string;
  slack_team?: {
    id: string;
    name: string;
  };
  slack_team_id?: string;
  slack_bot_token?: string;
  scope: string;
  slack_scope?: string;
  installed_at: number;
  slack_installed_at?: number;
  provider: string;
  slack_provider?: string;
}

export default function SlackCallbackPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const [installation, setInstallation] = useState<SlackInstallation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const hasTrackedCompletion = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          toast.error("User must be authenticated");
          return;
        }

        setIsLoading(true);

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        setTeamId(nextTeamId ?? null);

        if (!nextTeamId) {
          setInstallation(null);
          return;
        }

        const teamSnap = await getDoc(doc(db, "teams", nextTeamId));
        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          setTeamName(
            typeof teamData.team_name === "string" ? teamData.team_name : "",
          );
        } else {
          setTeamName("");
        }

        // Fetch Slack installations
        const slackInstallationsRef = collection(
          db,
          "teams",
          nextTeamId,
          "users",
          user.uid,
          "slack_installations"
        );
        const snapshot = await getDocs(slackInstallationsRef);

        if (!snapshot.empty) {
          // Get the first installation (you can modify this to handle multiple if needed)
          const firstDoc = snapshot.docs[0];
          const data = firstDoc.data();
          setInstallation({
            id: firstDoc.id,
            team: data.slack_team || data.team || { id: "", name: "" },
            team_id: data.slack_team_id || data.team_id || "",
            bot_token: data.slack_bot_token || data.bot_token || "",
            scope: data.slack_scope || data.scope || "",
            installed_at: data.slack_installed_at || data.installed_at || 0,
            provider: data.slack_provider || data.provider || "slack",
          });
        }
      } catch (error) {
        console.error("Error fetching Slack installation:", error);
        toast.error("Failed to load Slack installation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getPosthogAuthProps = () => {
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
    return eventProps;
  };

  useEffect(() => {
    if (!installation || hasTrackedCompletion.current) {
      return;
    }
    posthog?.capture("settings: slack_completed", getPosthogAuthProps());
    hasTrackedCompletion.current = true;
  }, [installation, posthog, teamId, teamName]);

  const handleRemoveConnection = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("User must be authenticated");
        return;
      }

      if (!installation || !teamId) {
        toast.error("No installation found to remove");
        return;
      }

      setIsRemoving(true);

      // Delete from team-scoped slack_installations
      const teamInstallationRef = doc(
        db,
        "teams",
        teamId,
        "users",
        user.uid,
        "slack_installations",
        installation.id
      );

      // Delete from user-scoped slack_installations (legacy location)
      const userInstallationRef = doc(
        db,
        "users",
        user.uid,
        "slack_installations",
        installation.id
      );

      await Promise.all([
        deleteDoc(teamInstallationRef),
        deleteDoc(userInstallationRef),
      ]);

      setInstallation(null);
      setRemoveDialogOpen(false);
      toast.success("Slack connection removed successfully");

      // Optionally redirect back to settings after a short delay
      setTimeout(() => {
        router.push("/settings");
      }, 1500);
    } catch (error) {
      console.error("Error removing Slack connection:", error);
      toast.error("Failed to remove Slack connection");
    } finally {
      setIsRemoving(false);
    }
  };

  // Parse scopes from comma-separated string
  const parseScopes = (scopeString: string): string[] => {
    if (!scopeString) return [];
    return scopeString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return (
    <div className="space-y-4">
      <div>
        <Button
          onClick={() => router.push("/settings")}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>
        <h2 className="text-2xl font-semibold mb-2">Slack Connection</h2>
        <p className="text-muted-foreground">
          View and manage your Slack integration.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground text-center">
            Loading Slack installation...
          </p>
        </div>
      ) : !installation ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground text-center">
            No Slack installation found.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Team Information</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Team Name
                </p>
                <p className="text-base">{installation.team.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Team ID
                </p>
                <p className="text-base font-mono text-sm">
                  {installation.team_id || installation.team.id || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Scopes</h3>
            <div className="space-y-2">
              {parseScopes(installation.scope).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parseScopes(installation.scope).map((scope, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No scopes available
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={() => setRemoveDialogOpen(true)}
              variant="destructive"
              disabled={isRemoving}
            >
              Remove Connection
            </Button>
          </div>
        </div>
      )}

      {/* Remove Connection Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Slack Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your Slack connection? This will
              delete all Slack-related data from your account and you will need
              to connect again to reconnect. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConnection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove Connection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
