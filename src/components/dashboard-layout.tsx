"use client";

import { Suspense, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Pencil, Loader2 } from "lucide-react";
import { updateAgentName } from "@/tools/agent_tools";
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

const pageTitles: Record<string, string> = {
  "/": "Agents",
  "/projects": "Projects",
  "/settings": "Settings",
  "/workflowAgent": "Workflow Agent",
  "/chatAgent": "Chat Agent",
  "/copilotAgent": "Copilot Agent",
};

function DashboardHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = searchParams.get("id");
  const agentName = searchParams.get("name");

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Check if we're on an agent page and have an agent name
  const isAgentPage = [
    "/workflowAgent",
    "/chatAgent",
    "/copilotAgent",
  ].includes(pathname);
  const isExistingAgent = isAgentPage && agentId && agentName;
  const pageTitle =
    isAgentPage && agentName ? agentName : pageTitles[pathname] || "Page";

  const handleEditClick = () => {
    if (isExistingAgent) {
      setNewAgentName(agentName);
      setShowEditDialog(true);
    }
  };

  const handleSaveName = async () => {
    if (!agentId || !newAgentName.trim()) return;

    try {
      setIsSaving(true);
      await updateAgentName(agentId, newAgentName.trim());

      // Update the URL with the new name
      const params = new URLSearchParams(searchParams.toString());
      params.set("name", newAgentName.trim());
      router.push(`${pathname}?${params.toString()}`);

      setShowEditDialog(false);
    } catch (error) {
      console.error("Failed to save agent name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isSaving) {
      // Only close if not saving - this prevents closing during save
      setShowEditDialog(false);
      setNewAgentName("");
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {isExistingAgent ? (
          <button
            onClick={handleEditClick}
            className="group relative inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 pr-8 hover:bg-accent transition-colors"
          >
            <h1 className="text-xl font-semibold">{pageTitle}</h1>
            <Pencil className="absolute right-2 h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        ) : (
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
        )}
      </header>

      <Dialog open={showEditDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent Name</DialogTitle>
            <DialogDescription>
              Update the name for this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g., Support Chat"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAgentName.trim() && !isSaving) {
                    handleSaveName();
                  }
                }}
                autoFocus
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={!newAgentName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Suspense
          fallback={
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-xl font-semibold">Loading...</h1>
            </header>
          }
        >
          <DashboardHeader />
        </Suspense>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
