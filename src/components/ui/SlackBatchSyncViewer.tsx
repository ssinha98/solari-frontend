// SlackSyncWidget.tsx
"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LuExternalLink } from "react-icons/lu";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type SlackSyncRow = {
  batchId: string; // needed later for retry
  channelId: string;
  channelName: string;
  status: "queued" | "running" | "done" | "error";
  details?: string | null;
  teamId?: string | null; // optional per-row override
};

export type SlackSyncWidgetProps = {
  visible: boolean;
  teamId: string | null;

  rows: SlackSyncRow[];

  // progress bar stats (for the active batch)
  completed: number;
  failed: number;
  total: number;

  // Required for retry functionality
  agentId: string;
  uid: string;

  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export const buildSlackChannelUrl = (
  teamId: string | null,
  channelId: string
): string | null => {
  if (!teamId || !channelId) return null;
  return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
};

function statusBadgeClass(status: SlackSyncRow["status"]) {
  switch (status) {
    case "running":
      return "bg-blue-600 text-white";
    case "queued":
      return "bg-white/10 text-white";
    case "done":
      return "border border-white/20 text-white bg-transparent";
    case "error":
      return "bg-red-600 text-white";
    default:
      return "bg-white/10 text-white";
  }
}

function statusLabel(status: SlackSyncRow["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function SlackSyncWidget({
  visible,
  teamId,
  rows,
  completed,
  failed,
  total,
  agentId,
  uid,
  defaultExpanded = false,
  onExpandedChange,
}: SlackSyncWidgetProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [retryingChannels, setRetryingChannels] = React.useState<Set<string>>(
    new Set()
  );

  if (!visible) return null;

  const safeTotal = Math.max(1, total);
  const doneCount = (completed ?? 0) + (failed ?? 0);
  const progressPct = Math.min(100, Math.max(0, (doneCount / safeTotal) * 100));

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      onExpandedChange?.(next);
      return next;
    });
  };

  const handleRetry = async (row: SlackSyncRow) => {
    const channelKey = `${row.batchId}:${row.channelId}`;

    // Add to retrying set
    setRetryingChannels((prev) => new Set(prev).add(channelKey));

    try {
      const response = await fetch("/api/slack/batch_channel_retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          agent_id: agentId,
          channel_id: row.channelId,
          channel_name: row.channelName,
          batch_id: row.batchId,
          team_id: row.teamId ?? teamId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to retry channel: ${errorText}`);
      }

      const data = await response.json();
      if (data.ok) {
        toast.success(`Retrying sync for #${row.channelName}`);
        // The table will automatically update via Firestore listener
        // When status changes from "error" to "done", the row will disappear
      } else {
        throw new Error("Retry failed");
      }
    } catch (error) {
      console.error("Error retrying Slack channel:", error);
      toast.error(
        `Failed to retry channel: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      // Remove from retrying set
      setRetryingChannels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(channelKey);
        return newSet;
      });
    }
  };

  return (
    <>
      {expanded ? (
        <Card
          className={
            "fixed bottom-4 right-4 z-50 shadow-lg " +
            "bg-black text-white border border-white/10 " +
            "w-[40vw] h-[40vh]"
          }
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            onClick={toggle}
          >
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 text-left select-none"
              aria-expanded={expanded}
            >
              <span className="text-sm font-medium text-white ">
                Slack Sync Job
              </span>
              <span className="text-white/70">
                <ChevronDown className="h-4 w-4" />
              </span>
            </button>
          </div>
          <div className="px-3 pb-3 space-y-3">
            {/* Progress */}
            {total > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Syncing channels…</span>
                  <span>
                    {doneCount} / {total}
                  </span>
                </div>
                <Progress value={progressPct} className="h-2 bg-white/10" />
              </div>
            )}

            {/* Table */}

            {/* Table */}
            <div className="rounded-md border border-white/10 overflow-hidden">
              <ScrollArea className="h-[calc(40vh-6.2rem)]">
                <Table className="text-white">
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/80 text-xs">
                        Channel name
                      </TableHead>
                      <TableHead className="w-[110px] text-white/80 text-xs">
                        Status
                      </TableHead>
                      <TableHead className="text-white/80 text-xs">
                        Details
                      </TableHead>
                      <TableHead className="w-[80px] text-white/80 text-xs">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow className="border-white/10">
                        <TableCell
                          colSpan={4}
                          className="text-sm text-white/60 text-xs"
                        >
                          No channels in progress.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => {
                        const url = buildSlackChannelUrl(
                          row.teamId ?? teamId,
                          row.channelId
                        );

                        return (
                          <TableRow
                            key={`${row.batchId}:${row.channelId}`}
                            className="border-white/10 hover:bg-white/5"
                          >
                            <TableCell className="font-medium text-white">
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white hover:underline flex items-center gap-1 text-xs"
                                  title={`Open #${row.channelName} in Slack`}
                                >
                                  #{row.channelName}
                                  <LuExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="flex items-center gap-1">
                                  #{row.channelName}
                                  <LuExternalLink className="h-3 w-3 opacity-50" />
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge className={statusBadgeClass(row.status)}>
                                {statusLabel(row.status)}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-sm text-white/60 text-xs">
                              {row.details === "not_in_channel"
                                ? "Add Solari Slack Bots to this channel, to sync it to the agent"
                                : row.details || "—"}
                            </TableCell>

                            <TableCell>
                              {row.status === "error" && (
                                <Badge
                                  className="bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors"
                                  onClick={() => handleRetry(row)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleRetry(row);
                                    }
                                  }}
                                >
                                  {retryingChannels.has(
                                    `${row.batchId}:${row.channelId}`
                                  )
                                    ? "Retrying..."
                                    : "Retry"}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          onClick={toggle}
          className="fixed bottom-8 right-4 z-50 shadow-lg bg-black text-white border border-white/10 hover:bg-black/90 w-[40vw] flex items-center justify-start gap-2"
          aria-label="Expand Slack Sync Job"
        >
          <span className="text-sm font-medium text-white">Slack Sync Job</span>
          <span className="text-white/70">
            <ChevronUp className="h-4 w-4" />
          </span>
        </Button>
      )}
    </>
  );
}
