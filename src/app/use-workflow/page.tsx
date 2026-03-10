"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/tools/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function FileInputCard({
  nodeLabel,
  inputVariableName,
  file,
  onFileChange,
  onOpenPicker,
}: {
  nodeLabel: string;
  inputVariableName: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onOpenPicker: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-100">
          {nodeLabel}
        </CardTitle>
        <p className="text-xs text-zinc-500 font-mono">{inputVariableName}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {file ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[#2D47BC44] bg-zinc-950 px-4 py-3 text-center">
            <FileText size={24} className="text-[#2D47BC]" />
            <p className="text-sm font-medium text-zinc-300">{file.name}</p>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="text-xs text-zinc-500 underline hover:text-zinc-400"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFileChange(f);
            }}
            onClick={onOpenPicker}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors"
            style={{
              borderColor: isDragging ? "#2D47BC" : "#3f3f46",
              background: isDragging ? "#2D47BC08" : "transparent",
            }}
          >
            <Upload size={24} className="text-zinc-500" />
            <p className="text-center text-sm text-zinc-500">
              Drag and drop your file here, or
            </p>
            <span className="text-sm font-semibold text-[#2D47BC] underline">
              Choose file
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UseWorkflowContent() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("id") ?? null;
  const displayName = searchParams.get("name") || "Workflow agent";
  const versionId = searchParams.get("version") ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [inputVariables, setInputVariables] = useState<
    Array<{
      inputVariableName: string;
      inputVariableType: string;
      nodeId: string;
      nodeKind: string;
      nodeLabel: string;
    }>
  >([]);
  const [inputVarsLoading, setInputVarsLoading] = useState(false);
  const [userReady, setUserReady] = useState(false);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentFileKey, setCurrentFileKey] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<{
    error?: string;
    missing?: Array<{ inputVariableName: string; nodeLabel?: string }>;
  } | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const router = useRouter();

  const isRunInProgress =
    !!currentRunId &&
    (runStatus === "queued" ||
      runStatus === "running" ||
      runStatus === "paused_deep_research");
  const isRunCompleted = !!currentRunId && runStatus === "completed";
  const isRunForReview = !!currentRunId && runStatus === "for_review";
  const isRunPaused = !!currentRunId && runStatus === "paused";
  const isRunFailed = !!currentRunId && runStatus === "failed";
  const needsReview = isRunForReview || isRunPaused;

  // Poll run status every 3 seconds while a run is in progress
  useEffect(() => {
    if (!currentRunId || !agentId) return;
    if (
      runStatus === "completed" ||
      runStatus === "failed" ||
      runStatus === "for_review" ||
      runStatus === "paused"
    )
      return;

    const poll = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const res = await fetch("/api/workflow/run/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.uid, agent_id: agentId, run_id: currentRunId }),
        });
        const data = await res.json();
        if (data.success && data.status) setRunStatus(data.status);
        if (data.failureReason) setFailureReason(data.failureReason);
      } catch {
        // silently fail, keep polling
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [currentRunId, agentId, runStatus]);

  const stringVars = inputVariables.filter(
    (v) =>
      v.inputVariableType === "string" ||
      v.inputVariableType === "text" ||
      v.inputVariableType === "url",
  );
  const fileVars = inputVariables.filter((v) => v.inputVariableType === "file");
  const allFilled =
    inputVariables.length === 0 ||
    (stringVars.every(
      (v) => (textValues[v.inputVariableName] ?? "").trim() !== "",
    ) &&
      fileVars.every((v) => fileValues[v.inputVariableName] != null));

  const handleRun = async () => {
    const user = auth.currentUser;
    if (!user || !agentId || !allFilled) return;
    const input_variables: Record<string, string> = {};
    for (const v of stringVars) {
      const val = (textValues[v.inputVariableName] ?? "").trim();
      if (val) input_variables[v.inputVariableName] = val;
    }
    for (const v of fileVars) {
      const file = fileValues[v.inputVariableName];
      if (file) input_variables[v.inputVariableName] = file.name;
    }
    setRunLoading(true);
    setRunError(null);
    setRunStatus(null);
    try {
      const res = await fetch("/api/workflow/run/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          agent_id: agentId,
          input_variables,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.runId) setCurrentRunId(data.runId);
        setRunStatus(data.status ?? "running");
        toast.success("Run started");
      } else {
        setRunError({
          error: data.error,
          missing: data.missing ?? [],
        });
      }
    } catch (err) {
      setRunError({ error: (err as Error)?.message ?? "Request failed" });
    } finally {
      setRunLoading(false);
    }
  };

  const ReadOnlyNode = ({
    data,
  }: {
    data: { kind?: string; label?: string };
  }) => (
    <div
      style={{
        background: "#000",
        border: "1px solid #2D47BC",
        borderRadius: 8,
        padding: "8px 14px",
        fontFamily: "'DM Mono','Fira Code',monospace",
        minWidth: 140,
        position: "relative",
      }}
    >
      {data.kind !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: "#2D47BC",
            width: 8,
            height: 8,
            border: "2px solid #000",
          }}
        />
      )}
      {data.kind !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: "#2D47BC",
            width: 8,
            height: 8,
            border: "2px solid #000",
          }}
        />
      )}
      <div
        style={{
          fontSize: 10,
          color: "#2D47BC",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 3,
        }}
      >
        {data.kind}
      </div>
      <div style={{ fontSize: 12, color: "#2D47BC", fontWeight: 600 }}>
        {data.label}
      </div>
    </div>
  );

  // inside your component, derive nodes and edges from agentData:
  // const workflowNodes = agentData?.nodes ?? [];
  // const workflowEdges = agentData?.connections ?? [];

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => setUserReady(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userReady || !agentId) {
      setAgentData(null);
      setError(null);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Sign in to view this workflow.");
      setAgentData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/workflow/get-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.uid,
        agent_id: agentId,
        ...(versionId ? { version_id: versionId } : {}),
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? `Request failed (${res.status})`);
          setAgentData(null);
          return;
        }
        setAgentData(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load agent");
          setAgentData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userReady, agentId, versionId]);

  // On mount, seed currentRunId/runStatus from any active run so polling picks it up
  useEffect(() => {
    if (!userReady || !agentId) return;
    const user = auth.currentUser;
    if (!user) return;

    fetch("/api/workflow/run/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.uid, agent_id: agentId }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;
        const active = data.activeRuns?.[0];
        if (active?.runId && active?.status) {
          setCurrentRunId(active.runId);
          setRunStatus(active.status);
          if (active.failureReason) setFailureReason(active.failureReason);
        }
      })
      .catch(() => {});
  }, [userReady, agentId]);

  // Fetch input variables for run
  useEffect(() => {
    if (!userReady || !agentId) {
      setInputVariables([]);
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    let cancelled = false;
    setInputVarsLoading(true);
    fetch("/api/workflow/run/input-variables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.uid, agent_id: agentId }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setInputVariables([]);
          return;
        }
        if (data.success && Array.isArray(data.inputVariables)) {
          setInputVariables(data.inputVariables);
        } else {
          setInputVariables([]);
        }
      })
      .catch(() => {
        if (!cancelled) setInputVariables([]);
      })
      .finally(() => {
        if (!cancelled) setInputVarsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userReady, agentId]);

  if (!agentId) {
    return (
      <div className="container max-w-2xl py-8">
        <p className="text-muted-foreground">
          Missing agent <code className="rounded bg-muted px-1">id</code> in
          URL. Use{" "}
          <code className="rounded bg-muted px-1">/use-workflow?id=...</code>.
        </p>
      </div>
    );
  }

  if (!userReady) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const workflowAgentUrl = `/workflowAgent?id=${agentId}${displayName ? `&name=${encodeURIComponent(displayName)}` : ""}`;
  const workflowConfig = (agentData as any)?.workflowConfig;
  const workflowNodes: Node[] = (workflowConfig?.nodes ?? []).map((n: any) => ({
    ...n,
    type: n.type ?? "workflow",
  }));
  const workflowEdges: Edge[] = (workflowConfig?.edges ?? []).map((e: any) => ({
    ...e,
    style: { stroke: "#2D47BC", strokeWidth: 1.5 },
    labelStyle: {
      fill: "#2D47BC",
      fontFamily: "'DM Mono','Fira Code',monospace",
      fontSize: 11,
    },
    labelBgStyle: { fill: "#000" },
  }));
  // const workflowEdges: Edge[] = workflowConfig?.edges ?? [];

  // const workflowEdges: Edge[] = workflowConfig?.edges ?? [];

  return (
    <div className="relative flex h-[85vh] max-h-[85vh] overflow-hidden">
      {/* Left: dark grey — agent info, fits viewport and scrolls internally */}
      {/* <div className="w-1/2 h-full flex flex-col overflow-hidden rounded-lg bg-zinc-800">
        <div className="shrink-0 p-6 space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {displayName}
          </h1>
          <p className="text-sm text-zinc-400">Agent ID: {agentId}</p>
        </div>
        <div className="flex-1 min-h-0 flex flex-col rounded-b-lg border border-zinc-600 border-t-0 overflow-hidden mx-6 mb-6">
          <div className="shrink-0 bg-zinc-700/50 px-4 py-2 border-b border-zinc-600">
            <span className="text-xs font-medium text-zinc-300">
              Agent (get-agent response)
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 bg-zinc-800">
            {loading ? (
              <Skeleton className="h-32 w-full rounded bg-zinc-700" />
            ) : agentData ? (
              <pre className="text-xs text-zinc-300">
                {JSON.stringify(agentData, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div> */}
      {/* Left: rounded canvas container */}
      <div className="w-1/2 h-full flex flex-col overflow-hidden rounded-lg bg-zinc-900">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="h-32 w-full rounded bg-zinc-700" />
          </div>
        ) : workflowNodes &&
          Array.isArray(workflowNodes) &&
          workflowNodes.length > 0 ? (
          <ReactFlow
            nodes={workflowNodes}
            edges={workflowEdges}
            nodesDraggable={false}
            nodeTypes={{ workflow: ReadOnlyNode }}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={true}
            panOnDrag={true}
            defaultEdgeOptions={{
              style: { stroke: "#2D47BC", strokeWidth: 1.5 },
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#3f3f46"
            />
            {false && (
              <Controls
                showInteractive={false}
                style={{
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                }}
              />
            )}
          </ReactFlow>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
            No workflow configured
          </div>
        )}
      </div>
      {/* Right: input variables for run — tabs (Text / File) */}
      <div className="w-1/2 h-full bg-black shrink-0 flex flex-col overflow-hidden">
        <div className="p-4 flex-1 min-h-0 overflow-auto">
          {inputVarsLoading ? (
            <Skeleton className="h-24 w-full rounded bg-zinc-800" />
          ) : (
            <Tabs defaultValue="text" className="h-full flex flex-col">
              <TabsList className="w-full bg-zinc-900 border border-zinc-800 mb-4">
                <TabsTrigger
                  value="text"
                  className="data-[state=active]:bg-zinc-800"
                >
                  Text
                </TabsTrigger>
                <TabsTrigger
                  value="file"
                  className="data-[state=active]:bg-zinc-800"
                >
                  File
                </TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="flex-1 overflow-auto mt-0">
                {stringVars.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    There are no text input variables.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {stringVars.map((v) => (
                      <Card
                        key={v.inputVariableName}
                        className="bg-zinc-900 border-zinc-800"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-zinc-100">
                            {v.nodeLabel}
                          </CardTitle>
                          <p className="text-xs text-zinc-500 font-mono">
                            {v.inputVariableName}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Input
                            className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                            placeholder="Enter value…"
                            value={textValues[v.inputVariableName] ?? ""}
                            onChange={(e) =>
                              setTextValues((prev) => ({
                                ...prev,
                                [v.inputVariableName]: e.target.value,
                              }))
                            }
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="file" className="flex-1 overflow-auto mt-0">
                {fileVars.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    There are no file input variables.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {fileVars.map((v) => (
                      <FileInputCard
                        key={v.inputVariableName}
                        nodeLabel={v.nodeLabel}
                        inputVariableName={v.inputVariableName}
                        file={fileValues[v.inputVariableName] ?? null}
                        onFileChange={(file) =>
                          setFileValues((prev) => ({
                            ...prev,
                            [v.inputVariableName]: file,
                          }))
                        }
                        onOpenPicker={() => {
                          setCurrentFileKey(v.inputVariableName);
                          fileInputRef.current?.click();
                        }}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && currentFileKey) {
              setFileValues((prev) => ({ ...prev, [currentFileKey]: file }));
              setCurrentFileKey(null);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Buttons and run error */}
      <div className="absolute bottom-0 right-0 w-1/2 p-6 flex flex-col gap-3 bg-black">
        <div className="flex items-center gap-3">
          {!versionId && (
            <Button variant="secondary" className="flex-1" asChild>
              <Link href={workflowAgentUrl}>Edit</Link>
            </Button>
          )}
          <Button
            className={`flex-1 text-white disabled:opacity-60 ${
              needsReview
                ? "bg-orange-600 hover:bg-orange-600/90"
                : isRunFailed
                  ? "bg-red-600 hover:bg-red-600/90"
                  : isRunCompleted
                    ? "bg-green-600 hover:bg-green-600/90"
                    : "bg-[#2D47BC] hover:bg-[#2D47BC]/90"
            }`}
            disabled={!allFilled || runLoading || isRunInProgress}
            onClick={
              needsReview
                ? () => router.push("/for-review-dashboard")
                : handleRun
            }
          >
            {runLoading || runStatus === "paused_deep_research" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : needsReview ? (
              "Review Workflow"
            ) : isRunFailed ? (
              "Run failed"
            ) : isRunCompleted ? (
              "✓ Completed"
            ) : isRunInProgress ? (
              "Running"
            ) : (
              "Run"
            )}
          </Button>
        </div>
        {currentRunId && (
          <p className="text-xs text-zinc-500 font-mono">
            Run ID: {currentRunId}
          </p>
        )}
        {runError && (
          <p className="text-red-500 text-sm font-mono">
            Missing values for the following variable(s):{" "}
            {runError.missing?.length
              ? runError.missing
                  .map(
                    (m) =>
                      m.inputVariableName +
                      (m.nodeLabel ? ` (${m.nodeLabel})` : ""),
                  )
                  .join(", ")
              : (runError.error ?? "Unknown error")}
          </p>
        )}
        {isRunFailed && failureReason && (
          <p className="text-red-400 text-sm font-mono">
            {failureReason}
          </p>
        )}
      </div>
    </div>
  );
}

export default function UseWorkflowPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-2xl py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
      }
    >
      <UseWorkflowContent />
    </Suspense>
  );
}
