"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/tools/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Info, ThumbsUp, ThumbsDown, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsHBarChart } from "@/components/analytics_hbarchart";

type NodeExecution = {
  nodeId: string;
  nodeLabel: string;
  kind: string;
  status: string;
  output: string;
  outputVariable: string | null;
  startedAt: string;
  completedAt: string;
  error: string | null;
};

type RunRow = {
  id: string;
  triggeredBy: string;
  triggerSource: string;
  status: string;
  startedAt: string;
  completedAt: string;
  versionLabel: string;
  inputVariables: Record<string, string>;
  outputVariables: Record<string, unknown>;
  nodeExecutions: NodeExecution[];
};

const KIND_COLORS: Record<string, string> = {
  trigger: "#f97316",
  llm: "#6366f1",
  connector: "#3b82f6",
  eval: "#a855f7",
  forReview: "#f43f5e",
  output: "#10b981",
  action: "#3b82f6",
  condition: "#a855f7",
};

function statusColor(status: string) {
  if (status === "completed") return "text-green-500";
  if (status === "failed") return "text-red-500";
  if (status === "running") return "text-yellow-400";
  return "text-muted-foreground";
}

function formatDate(raw: string) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleString();
}

function WorkflowAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("id");

  const [userId, setUserId] = useState<string | null>(
    auth.currentUser?.uid ?? null,
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<{
    overall: { thumbsUp: number; thumbsDown: number; score: number; total: number };
    perNode: { nodeLabel: string; score: number; thumbsUp: number; thumbsDown: number }[];
    perRun: { runId: string; startedAt: string; score: number | null }[];
  } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodeRatings, setNodeRatings] = useState<
    Record<string, "up" | "down" | null>
  >({});
  const [nodeRatingLoading, setNodeRatingLoading] = useState<
    Record<string, boolean>
  >({});
  const [nodeComments, setNodeComments] = useState<Record<string, string>>({});
  const [commentDialog, setCommentDialog] = useState<{
    nodeId: string;
    nodeLabel: string;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  type SortKey = "status" | "versionLabel" | "triggerSource" | "startedAt" | "completedAt" | "id" | "nodeSuccessRate";
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const nodeSuccessRate = (run: RunRow) => {
    const execs = run.nodeExecutions;
    if (!execs.length) return -1;
    return execs.filter((n) => n.status === "completed").length / execs.length;
  };

  const sortedRuns = [...runs].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "startedAt" || sortKey === "completedAt") {
      cmp = new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime();
    } else if (sortKey === "nodeSuccessRate") {
      cmp = nodeSuccessRate(a) - nodeSuccessRate(b);
    } else {
      cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) {
      setTeamId(null);
      return;
    }
    getDoc(doc(db, "users", userId))
      .then((snap) =>
        setTeamId(
          snap.exists() ? ((snap.data().teamId as string) ?? null) : null,
        ),
      )
      .catch(() => setTeamId(null));
  }, [userId]);

  useEffect(() => {
    if (!userId || !agentId) {
      setRuns([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch("/api/workflow/run/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, agent_id: agentId }),
    })
      .then((res) => res.json())
      .then((data) => {
        const raw: RunRow[] = (data.runs ?? []).map(
          (r: Record<string, unknown>) => ({
            id: String(r.runId ?? r.id ?? ""),
            triggeredBy: String(r.triggeredBy ?? ""),
            triggerSource: String(r.triggerSource ?? ""),
            status: String(r.status ?? ""),
            startedAt: String(r.startedAt ?? ""),
            completedAt: String(r.completedAt ?? ""),
            versionLabel: String(r.versionLabel ?? ""),
            inputVariables: (r.inputVariables ?? {}) as Record<string, string>,
            outputVariables: (r.outputVariables ?? {}) as Record<
              string,
              unknown
            >,
            nodeExecutions: (
              (r.nodeExecutions ?? []) as Record<string, unknown>[]
            ).map((n) => ({
              nodeId: String(n.nodeId ?? ""),
              nodeLabel: String(n.nodeLabel ?? ""),
              kind: String(n.kind ?? ""),
              status: String(n.status ?? ""),
              output: String(n.output ?? ""),
              outputVariable: n.outputVariable
                ? String(n.outputVariable)
                : null,
              startedAt: String(n.startedAt ?? ""),
              completedAt: String(n.completedAt ?? ""),
              error: n.error ? String(n.error) : null,
            })),
          }),
        );
        setRuns(raw);
      })
      .catch(() => setRuns([]))
      .finally(() => setIsLoading(false));
  }, [userId, agentId, teamId]);

  useEffect(() => {
    if (!userId || !agentId) { setFeedbackData(null); setFeedbackLoading(false); return; }
    setFeedbackLoading(true);
    fetch("/api/workflow/analytics/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, agent_id: agentId, limit: 30 }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setFeedbackData(data);
      })
      .catch(() => setFeedbackData(null))
      .finally(() => setFeedbackLoading(false));
  }, [userId, agentId, teamId]);

  const handleRowClick = (run: RunRow) => {
    setSelectedRun(run);
    setNodeRatings({});
    setDrawerOpen(true);
  };

  const submitNodeRating = async (nodeId: string, rating: "up" | "down") => {
    if (!userId || !agentId || !selectedRun) return;
    // toggle off if same rating clicked again
    const next = nodeRatings[nodeId] === rating ? null : rating;
    setNodeRatingLoading((prev) => ({ ...prev, [nodeId]: true }));
    try {
      const res = await fetch("/api/workflow/run/node-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          run_id: selectedRun.id,
          node_id: nodeId,
          feedback: {
            rating:
              next === "up"
                ? "thumbs_up"
                : next === "down"
                  ? "thumbs_down"
                  : null,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNodeRatings((prev) => ({ ...prev, [nodeId]: next }));
      }
    } catch {
      // silently fail
    } finally {
      setNodeRatingLoading((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  const submitComment = async (nodeId: string, comment: string) => {
    if (!userId || !agentId || !selectedRun) return;
    try {
      const res = await fetch("/api/workflow/run/node-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          run_id: selectedRun.id,
          node_id: nodeId,
          feedback: {
            rating:
              nodeRatings[nodeId] === "up"
                ? "thumbs_up"
                : nodeRatings[nodeId] === "down"
                  ? "thumbs_down"
                  : null,
            comment,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNodeComments((prev) => ({ ...prev, [nodeId]: comment }));
      }
    } catch {
      // silently fail
    }
  };

  if (!agentId)
    return <p className="text-muted-foreground">Agent ID is required.</p>;
  if (!userId)
    return <p className="text-muted-foreground">Please sign in to continue.</p>;

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const failureRate = totalRuns > 0 ? 100 - successRate : 0;

  const chartsLoading = isLoading || feedbackLoading;

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => agentId && router.push(`/workflowAgent?id=${agentId}`)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to agent
        </button>
      </div>

      {/* Charts — 2x2 grid */}
      {chartsLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* 1. Run success rate */}
          <AnalyticsHBarChart
            title="Run success rate"
            description="How often do workflow runs complete successfully?"
            chartHeightClassName="h-[180px]"
            maxValue={100}
            valueFormatter={(v) => `${Math.round(v)}%`}
            valueLabel="Rate"
            items={[
              { label: "Completed", value: successRate },
              { label: "Failed", value: failureRate },
            ]}
          />

          {/* 2. Overall feedback */}
          <AnalyticsHBarChart
            title="Overall feedback"
            description="Thumbs up vs thumbs down across all node executions"
            chartHeightClassName="h-[180px]"
            valueLabel="Count"
            items={[
              { label: "Thumbs up", value: feedbackData?.overall.thumbsUp ?? 0 },
              { label: "Thumbs down", value: feedbackData?.overall.thumbsDown ?? 0 },
            ]}
          />

          {/* 3. Per node feedback */}
          <AnalyticsHBarChart
            title="Feedback by node"
            description="Score per node (thumbs up %)"
            chartHeightClassName={`h-[${Math.max(160, (feedbackData?.perNode.length ?? 2) * 48)}px]`}
            maxValue={100}
            valueFormatter={(v) => `${Math.round(v)}%`}
            valueLabel="Score"
            items={(feedbackData?.perNode ?? []).map((n) => ({
              label: n.nodeLabel,
              value: n.score ?? 0,
            }))}
          />

          {/* 4. Per run feedback — trend line */}
          <Card className="bg-black text-white border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Feedback trend</CardTitle>
              <CardDescription className="text-white/70">
                Feedback score (%) over time per run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(feedbackData?.perRun ?? [])
                      .slice()
                      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
                      .map((r) => ({
                        date: formatDate(r.startedAt).split(",")[0],
                        score: r.score ?? null,
                      }))}
                    margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#fafafa",
                      }}
                      formatter={(v: number) => [`${Math.round(v)}%`, "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#303AAF"
                      strokeWidth={2}
                      dot={{ fill: "#303AAF", r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs table */}
      {isLoading ? (
        <Skeleton className="h-[300px] w-full rounded-lg" />
      ) : runs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No run logs yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-background font-mono">
          <Table>
            <TableHeader>
              <TableRow>
                {(
                  [
                    ["Status", "Run status (completed / failed / running)", "status"],
                    ["Version", "Agent version this run used", "versionLabel"],
                    ["Trigger", "What triggered this run", "triggerSource"],
                    ["Started", "When the run started", "startedAt"],
                    ["Completed", "When the run finished", "completedAt"],
                    ["Run ID", "Unique identifier for this run", "id"],
                    ["Node success rate", "% of node executions that completed successfully within this run", "nodeSuccessRate"],
                  ] as [string, string, SortKey][]
                ).map(([label, tip, key]) => {
                  const isActive = sortKey === key;
                  const SortIcon = isActive
                    ? sortDir === "asc" ? ArrowUp : ArrowDown
                    : ArrowUpDown;
                  return (
                    <TableHead key={key}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className={`flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          <span className={isActive ? "text-foreground font-semibold" : ""}>{label}</span>
                          <SortIcon className="h-3 w-3 shrink-0" />
                        </button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground ml-1"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className="text-xs">{tip}</span>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.map((run) => (
                <TableRow
                  key={run.id}
                  className="hover:bg-accent cursor-pointer"
                  onClick={() => handleRowClick(run)}
                >
                  <TableCell>
                    <span className={statusColor(run.status)}>
                      {run.status}
                    </span>
                  </TableCell>
                  <TableCell>{run.versionLabel || "—"}</TableCell>
                  <TableCell>{run.triggerSource || "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {formatDate(run.startedAt)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {formatDate(run.completedAt)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                    {run.id || "—"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const execs = run.nodeExecutions;
                      if (!execs.length) return <span className="text-muted-foreground">—</span>;
                      const passed = execs.filter((n) => n.status === "completed").length;
                      const pct = Math.round((passed / execs.length) * 100);
                      return (
                        <span className={pct === 100 ? "text-green-500" : pct >= 50 ? "text-yellow-400" : "text-red-500"}>
                          {pct}% <span className="text-muted-foreground text-xs">({passed}/{execs.length})</span>
                        </span>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedRun(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">Run Details</SheetTitle>
          </SheetHeader>
          {selectedRun && (
            <div className="p-4 space-y-4">
              {/* Node executions */}
              {selectedRun.nodeExecutions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm uppercase font-mono text-muted-foreground tracking-widest">
                    Node Executions
                  </p>
                  {selectedRun.nodeExecutions.map((n) => (
                    <Card key={n.nodeId} className="bg-muted border-border">
                      <CardContent className="p-3 space-y-2">
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: KIND_COLORS[n.kind] ?? "#52525b",
                              }}
                            />
                            <div>
                              <span
                                className={`text-[10px] font-mono ${statusColor(n.status)}`}
                              >
                                {n.status}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-white">
                                  {n.nodeLabel}
                                </span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {n.kind}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!!nodeRatingLoading[n.nodeId]}
                              onClick={() => submitNodeRating(n.nodeId, "up")}
                              className={`p-1 rounded hover:bg-accent transition-colors disabled:opacity-40 ${nodeRatings[n.nodeId] === "up" ? "text-green-500" : "text-muted-foreground"}`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!!nodeRatingLoading[n.nodeId]}
                              onClick={() => submitNodeRating(n.nodeId, "down")}
                              className={`p-1 rounded hover:bg-accent transition-colors disabled:opacity-40 ${nodeRatings[n.nodeId] === "down" ? "text-red-500" : "text-muted-foreground"}`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCommentDraft(nodeComments[n.nodeId] ?? "");
                                setCommentDialog({
                                  nodeId: n.nodeId,
                                  nodeLabel: n.nodeLabel,
                                });
                              }}
                              className={`p-1 rounded hover:bg-accent transition-colors ${nodeComments[n.nodeId] ? "text-blue-400" : "text-muted-foreground"}`}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Output */}
                        {n.output && (
                          <p className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                            {n.output}
                          </p>
                        )}

                        {/* Error */}
                        {n.error && (
                          <p className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                            {n.error}
                          </p>
                        )}

                        {/* Output variable tag */}
                        {n.outputVariable && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            saved as{" "}
                            <span className="text-zinc-300">
                              {n.outputVariable}
                            </span>
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Comment dialog */}
      <AlertDialog
        open={!!commentDialog}
        onOpenChange={(open) => {
          if (!open) setCommentDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">
              Comment — {commentDialog?.nodeLabel}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <Textarea
            placeholder="Add a comment about this node's output…"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCommentDraft("");
                if (commentDialog) {
                  submitComment(commentDialog.nodeId, "");
                }
                setCommentDialog(null);
              }}
            >
              Clear
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (commentDialog) {
                  submitComment(commentDialog.nodeId, commentDraft);
                }
                setCommentDialog(null);
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function WorkflowAnalyticsPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading analytics...</p>}
    >
      <WorkflowAnalyticsContent />
    </Suspense>
  );
}
