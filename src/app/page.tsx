"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import Link from "next/link";
import { GoWorkflow } from "react-icons/go";
import { MdChatBubble } from "react-icons/md";
import { FaHandsHelping } from "react-icons/fa";
import { VscSettings, VscInfo } from "react-icons/vsc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserAgents, Agent } from "@/tools/agent_tools";

// Dummy data - will be replaced with Firebase data
const dummyTasks = {
  hasPendingTasks: false,
};

const dummyAgentRuns = [
  {
    id: "1",
    agentName: "HR copilot",
    nextRun: "Tomorrow @ 9am",
  },
];

// Helper function to get icon component based on agent type
function getAgentTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "workflow":
      return <GoWorkflow className="h-5 w-5" />;
    case "source chat":
      return <MdChatBubble className="h-5 w-5" />;
    case "copilot":
      return <FaHandsHelping className="h-5 w-5" />;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoadingAgents(true);
        const userAgents = await getUserAgents();
        setAgents(userAgents);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    fetchAgents();
  }, []);

  const handleAgentTypeSelect = (type: string) => {
    setIsMenuOpen(false);

    // Navigate to the corresponding agent creation page with ?new=true query param
    switch (type.toLowerCase()) {
      case "workflow":
        router.push("/workflowAgent?new=true");
        break;
      case "source chat":
        router.push("/chatAgent?new=true");
        break;
      case "copilot":
        router.push("/copilotAgent?new=true");
        break;
      default:
        break;
    }
  };

  const handleAgentRowClick = (agent: Agent) => {
    const basePath =
      agent.type === "workflow"
        ? "/workflowAgent"
        : agent.type === "source chat"
          ? "/chatAgent"
          : "/copilotAgent";

    const params = new URLSearchParams({ id: agent.id });
    if (agent.name) {
      params.set("name", agent.name);
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="space-y-4 relative pb-20">
      {/* Top two boxes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Your Tasks Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Tasks</h2>
          <div className="rounded-lg border bg-card p-6">
            {dummyTasks.hasPendingTasks ? (
              <p className="text-sm text-muted-foreground">
                You have pending tasks
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  No pending tasks
                </p>
                <Link
                  href="#"
                  className="text-sm text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  What are agent tasks? →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Upcoming agent runs Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Upcoming agent runs</h2>
          <div className="rounded-lg border bg-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Agent name
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Next run
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dummyAgentRuns.length > 0 ? (
                    dummyAgentRuns.map((run) => (
                      <tr key={run.id} className="border-b last:border-b-0">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{run.agentName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{run.nextRun}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-4 px-4 text-center text-sm text-muted-foreground"
                      >
                        No upcoming runs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Agents table section - full width */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Agents</h2>
        <div className="rounded-lg border bg-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Info
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                    Settings
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAgents ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-4 text-center text-sm text-muted-foreground"
                    >
                      Loading agents...
                    </td>
                  </tr>
                ) : agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr
                      key={agent.id}
                      onClick={() => handleAgentRowClick(agent)}
                      className="border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {getAgentTypeIcon(agent.type)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {agent.name || `${agent.type} agent`}
                      </td>
                      <td className="py-3 px-4">
                        <VscInfo className="h-5 w-5" />
                      </td>
                      <td className="py-3 px-4">
                        <VscSettings className="h-5 w-5" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 px-4 text-center text-sm text-muted-foreground"
                    >
                      No agents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="rounded-lg px-6 h-14 shadow-lg hover:shadow-xl transition-shadow gap-2 bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-5 w-5" />
              <span>Add new agent</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("workflow")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <GoWorkflow className="h-4 w-4" />
              <span>Workflow</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("source chat")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <MdChatBubble className="h-4 w-4" />
              <span>Source Chat</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAgentTypeSelect("copilot")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <FaHandsHelping className="h-4 w-4" />
              <span>Copilot</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
