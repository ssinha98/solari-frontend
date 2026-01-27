"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/tools/firebase";
import {
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
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

interface Workspace {
  cloudId: string;
  name: string;
  scopes: string[];
  url: string;
}

interface WorkspacesResponse {
  status: string;
  workspaces: Workspace[];
}

export default function JiraCallbackPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedCloudId, setSelectedCloudId] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          toast.error("User must be authenticated");
          return;
        }

        setIsLoading(true);

        // Fetch team's current Jira settings
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const teamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;

        if (teamId) {
          const teamRef = doc(db, "teams", teamId);
          const teamSnap = await getDoc(teamRef);
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            setSelectedCloudId(teamData.jira_cloud_id || null);
          } else {
            setSelectedCloudId(null);
          }
        } else {
          setSelectedCloudId(null);
        }

        // Fetch workspaces
        const response = await fetch(
          `/api/jira/workspaces?user_id=${user.uid}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch workspaces: ${errorText}`);
        }

        const data: WorkspacesResponse = await response.json();
        if (data.status === "success" && data.workspaces) {
          setWorkspaces(data.workspaces);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load Jira workspaces");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleWorkspaceSelect = async (workspace: Workspace) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("User must be authenticated");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const teamId = userSnap.exists()
        ? (userSnap.data().teamId as string | undefined)
        : undefined;

      if (!teamId) {
        toast.error("Team ID is required");
        return;
      }

      setIsUpdating(true);
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        jira_cloud_id: workspace.cloudId,
        jira_site_url: workspace.url,
        updatedAt: serverTimestamp(),
      });

      setSelectedCloudId(workspace.cloudId);
      toast.success(`Jira workspace "${workspace.name}" selected successfully`);
    } catch (error) {
      console.error("Error updating user workspace:", error);
      toast.error("Failed to update Jira workspace");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveConnection = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("User must be authenticated");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const teamId = userSnap.exists()
        ? (userSnap.data().teamId as string | undefined)
        : undefined;

      if (!teamId) {
        toast.error("Team ID is required");
        return;
      }

      setIsRemoving(true);
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        jira_cloud_id: deleteField(),
        jira_site_url: deleteField(),
        jira_access_token: deleteField(),
        jira_connected: deleteField(),
        jira_expires_at: deleteField(),
        jira_refresh_token: deleteField(),
        updatedAt: serverTimestamp(),
      });

      setSelectedCloudId(null);
      setRemoveDialogOpen(false);
      toast.success("Jira connection removed successfully");
    } catch (error) {
      console.error("Error removing Jira connection:", error);
      toast.error("Failed to remove Jira connection");
    } finally {
      setIsRemoving(false);
    }
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
        <h2 className="text-2xl font-semibold mb-2">Select Workspace</h2>
        <p className="text-muted-foreground">
          Choose which workspace to connect to your account.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground text-center">
            Loading workspaces...
          </p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground text-center">
            No workspaces found.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((workspace) => {
            const isSelected = selectedCloudId === workspace.cloudId;
            return (
              <div
                key={workspace.cloudId}
                className={`rounded-lg border p-4 flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-primary/5 border-primary"
                    : "bg-card hover:bg-accent"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{workspace.name}</h3>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Check className="h-3 w-3" />
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {workspace.url}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cloud ID: {workspace.cloudId}
                  </p>
                </div>
                <Button
                  onClick={() => handleWorkspaceSelect(workspace)}
                  disabled={isUpdating || isSelected}
                  variant={isSelected ? "secondary" : "outline"}
                >
                  {isSelected ? "Selected" : "Select"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {selectedCloudId && (
        <div className="pt-4 border-t">
          <Button
            onClick={() => setRemoveDialogOpen(true)}
            variant="destructive"
            disabled={isRemoving}
          >
            Remove Connection
          </Button>
        </div>
      )}

      {/* Remove Connection Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Atlassian Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your Atlassian connection? This
              will delete all Atlassian-related data from your account and you
              will need to log in again to reconnect. This action cannot be
              undone.
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
