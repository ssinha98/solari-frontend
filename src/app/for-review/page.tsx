"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/tools/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Clock, Pencil, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ReviewItem = {
  agentId: string;
  agentName: string;
  createdAt: string;
  createdBy: string;
  input: string;
  nodeId: string;
  nodeLabel: string;
  notes: string;
  output: string | null;
  outputType?: "single" | "table";
  reviewId: string;
  runId: string;
  status: "pending" | "reviewed" | "dismissed";
};

type ContextNode = {
  kind: string;
  nodeId: string;
  nodeLabel: string;
  output: string | null;
  status: string;
} | null;

type TableReviewData = {
  outputTable: {
    columns: string[];
    rows: Record<string, Record<string, unknown>>;
  };
  tableColumns?: Array<{ key: string; label: string }>;
};

function StatusBadge({ status }: { status: ReviewItem["status"] }) {
  if (status === "reviewed") {
    return (
      <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle className="h-3 w-3" />
        Reviewed
      </Badge>
    );
  }
  if (status === "dismissed") {
    return (
      <Badge className="gap-1 bg-red-500/10 text-red-600 border-red-500/20">
        <XCircle className="h-3 w-3" />
        Dismissed
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

function NodeCard({
  node,
  label,
}: {
  node: ContextNode;
  label: "Previous node" | "Next node";
}) {
  if (!node) {
    const isPrevious = label === "Previous node";
    if (isPrevious) {
      return (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #27272a",
            borderRadius: 8,
            padding: "10px 14px",
            fontFamily: "'DM Mono','Fira Code',monospace",
            minWidth: 160,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#52525b",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 3,
            }}
          >
            Previous node
          </div>
          <div style={{ fontSize: 12, color: "#52525b" }}>—</div>
        </div>
      );
    }
    // No next node → workflow ends here
    return (
      <div
        style={{
          background: "#000",
          border: "1px solid #10b981",
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: "'DM Mono','Fira Code',monospace",
          minWidth: 160,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "#10b981",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 3,
          }}
        >
          output
        </div>
        <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
          Complete
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#000",
        border: "1px solid #2D47BC",
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: "'DM Mono','Fira Code',monospace",
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#2D47BC",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 3,
        }}
      >
        {node.kind}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#2D47BC",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {node.nodeLabel}
      </div>
      {node.output !== null && node.output !== undefined && (
        <div
          style={{
            fontSize: 11,
            color: "#71717a",
            marginTop: 4,
            borderTop: "1px solid #1e1e2e",
            paddingTop: 6,
            wordBreak: "break-word",
          }}
        >
          {typeof node.output === "object"
            ? JSON.stringify(node.output)
            : String(node.output)}
        </div>
      )}
    </div>
  );
}

function CurrentReviewNodeCard({ item }: { item: ReviewItem }) {
  return (
    <div
      style={{
        background: "#000",
        border: "1px solid #ef4444",
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: "'DM Mono','Fira Code',monospace",
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#ef4444",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 3,
        }}
      >
        for review
      </div>
      <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
        {item.nodeLabel}
      </div>
    </div>
  );
}

function ForReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = searchParams.get("reviewId");

  const [userId, setUserId] = useState<string | null>(
    auth.currentUser?.uid || null,
  );
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [previousNode, setPreviousNode] = useState<ContextNode>(null);
  const [nextNode, setNextNode] = useState<ContextNode>(null);
  const [tableData, setTableData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedOutput, setEditedOutput] = useState("");
  const [cellEditOpen, setCellEditOpen] = useState(false);
  const [cellEditRowIndex, setCellEditRowIndex] = useState<number | null>(null);
  const [cellEditColumn, setCellEditColumn] = useState<string | null>(null);
  const [cellEditValue, setCellEditValue] = useState("");
  const [isUpdatingCell, setIsUpdatingCell] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !reviewId) {
      setIsLoading(false);
      return;
    }

    const fetchItem = async () => {
      setIsLoading(true);
      setError(null);
      setTableData(null);
      setSelectedRowKeys(new Set());
      try {
        const res = await fetch("/api/workflow/for-review/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, review_id: reviewId }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        if (data.success && data.item) {
          const reviewItem = data.item as ReviewItem;
          setItem(reviewItem);
          setEditedOutput(reviewItem.input ?? "");
          setPreviousNode(data.previousNode ?? null);
          setNextNode(data.nextNode ?? null);

          const outputType =
            reviewItem.outputType ?? data.outputType ?? "single";

          if (outputType === "table") {
            const tableRes = await fetch("/api/workflow/review/get-table", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: userId,
                agent_id: reviewItem.agentId,
                run_id: reviewItem.runId,
              }),
            });
            if (tableRes.ok) {
              const tableJson = await tableRes.json();
              setTableData(tableJson);
            }
          }
        } else {
          setError("Review item not found.");
        }
      } catch (err) {
        console.error("Failed to fetch review item:", err);
        setError("Failed to load review item.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [userId, reviewId]);

  if (!reviewId) {
    return <p className="text-muted-foreground">Review ID is required.</p>;
  }

  if (!userId) {
    return <p className="text-muted-foreground">Please sign in to continue.</p>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (error || !item) {
    return (
      <p className="text-destructive text-sm">{error ?? "Item not found."}</p>
    );
  }

  const isTableOutput =
    item.outputType === "table" && tableData != null;

  return (
    <div
      className={
        isTableOutput
          ? "grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]"
          : "grid grid-cols-1 gap-10 lg:grid-cols-2"
      }
    >
      {/* Left — form content */}
      <div className="w-full space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.push("/for-review-dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to dashboard
          </button>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{item.nodeLabel}</h1>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {item.agentName} &middot;{" "}
            {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>

        <Separator />

        {item.outputType === "table" && tableData ? (
          <>
            {item.notes && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Instructions
                </p>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
                  {item.notes}
                </div>
              </div>
            )}
            {(tableData as TableReviewData).outputTable && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Table output
                  </p>
                  {selectedRowKeys.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500"
                      onClick={async () => {
                        if (
                          userId == null ||
                          item == null ||
                          tableData == null
                        )
                          return;
                        const data = tableData as TableReviewData;
                        const keysToDelete = new Set(selectedRowKeys);
                        const rowsToRestore = Object.fromEntries(
                          Object.entries(data.outputTable.rows).filter(
                            ([key]) => keysToDelete.has(key),
                          ),
                        );

                        // Optimistic delete
                        setTableData({
                          ...data,
                          outputTable: {
                            ...data.outputTable,
                            rows: Object.fromEntries(
                              Object.entries(data.outputTable.rows).filter(
                                ([key]) => !keysToDelete.has(key),
                              ),
                            ),
                          },
                        });
                        setSelectedRowKeys(new Set());

                        try {
                          const res = await fetch(
                            "/api/workflow/review/delete-rows",
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                user_id: userId,
                                agent_id: item.agentId,
                                run_id: item.runId,
                                row_indices: Array.from(keysToDelete)
                                  .map(Number)
                                  .sort((a, b) => a - b),
                              }),
                            },
                          );
                          if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err?.error ?? "Delete failed");
                          }
                          const result = await res.json();
                          if (result.notFound?.length) {
                            console.warn(
                              "Delete rows notFound:",
                              result.notFound,
                            );
                          }
                          toast.success("Rows deleted");
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Failed to delete rows",
                          );
                          // Restore on failure
                          setTableData({
                            ...data,
                            outputTable: {
                              ...data.outputTable,
                              rows: {
                                ...data.outputTable.rows,
                                ...rowsToRestore,
                              },
                            },
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete rows
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-2">
                          <Checkbox
                            checked={
                              selectedRowKeys.size > 0 &&
                              selectedRowKeys.size ===
                                Object.keys(
                                  (tableData as TableReviewData).outputTable
                                    .rows,
                                ).length
                            }
                            onCheckedChange={(checked) => {
                              const allKeys = Object.keys(
                                (tableData as TableReviewData).outputTable
                                  .rows,
                              );
                              setSelectedRowKeys(
                                checked ? new Set(allKeys) : new Set(),
                              );
                            }}
                            aria-label="Select all rows"
                          />
                        </TableHead>
                        {(tableData as TableReviewData).outputTable.columns.map(
                          (col) => {
                            const label =
                              (tableData as TableReviewData).tableColumns?.find(
                                (c) => c.key === col,
                              )?.label ?? col.replace(/_/g, " ");
                            return (
                              <TableHead key={col} className="text-xs">
                                {label}
                              </TableHead>
                            );
                          },
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(
                        (tableData as TableReviewData).outputTable.rows,
                      )
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([rowKey, row]) => (
                          <TableRow key={rowKey}>
                            <TableCell className="w-10 px-2">
                              <Checkbox
                                checked={selectedRowKeys.has(rowKey)}
                                onCheckedChange={(checked) => {
                                  setSelectedRowKeys((prev) => {
                                    const next = new Set(prev);
                                    if (checked) {
                                      next.add(rowKey);
                                    } else {
                                      next.delete(rowKey);
                                    }
                                    return next;
                                  });
                                }}
                                aria-label={`Select row ${rowKey}`}
                              />
                            </TableCell>
                            {(tableData as TableReviewData).outputTable.columns.map(
                              (col) => {
                                const cellVal = row[col];
                              const displayVal =
                                cellVal != null && cellVal !== undefined
                                  ? typeof cellVal === "number"
                                    ? Number(cellVal).toLocaleString()
                                    : typeof cellVal === "object"
                                      ? JSON.stringify(cellVal)
                                      : String(cellVal)
                                  : "";
                              return (
                                <TableCell
                                  key={col}
                                  className="text-xs max-w-[300px] group"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className="truncate flex-1 min-w-0"
                                      title={
                                        cellVal != null
                                          ? typeof cellVal === "object"
                                            ? JSON.stringify(cellVal)
                                            : String(cellVal)
                                          : undefined
                                      }
                                    >
                                      {displayVal}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCellEditRowIndex(Number(rowKey));
                                        setCellEditColumn(col);
                                        setCellEditValue(
                                          cellVal != null &&
                                            cellVal !== undefined
                                            ? typeof cellVal === "object"
                                              ? JSON.stringify(cellVal, null, 2)
                                              : String(cellVal)
                                            : "",
                                        );
                                        setCellEditOpen(true);
                                      }}
                                      className="shrink-0 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                      aria-label="Edit cell"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                </TableCell>
                              );
                            },
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Original value (read-only) */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Original value
              </p>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
                {item.input || "—"}
              </div>
            </div>

            {/* Notes / instructions */}
            {item.notes && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Instructions
                </p>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
                  {item.notes}
                </div>
              </div>
            )}

            {/* Update value (editable) */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Update value
              </p>
              <Textarea
                className="min-h-[160px] resize-y text-sm"
                placeholder="Update value..."
                value={editedOutput}
                onChange={(e) => setEditedOutput(e.target.value)}
              />
              <Button className="w-full bg-[#2D47BC] hover:bg-[#2D47BC]/90 text-white">
                Update content
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Right — node context */}
      <div className="min-h-[520px] flex items-center justify-center">
        <div className="w-56 flex flex-col gap-2">
          <NodeCard node={previousNode} label="Previous node" />

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-6 bg-[#2D47BC44]" />
          </div>

          <CurrentReviewNodeCard item={item} />

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-6 bg-[#2D47BC44]" />
          </div>

          <NodeCard node={nextNode} label="Next node" />
        </div>
      </div>

      {/* Bottom actions spanning both sections */}
      <div className="lg:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Button variant="outline" className="w-full">
          Restart workflow
        </Button>
        <Button className="w-full bg-[#2D47BC] hover:bg-[#2D47BC]/90 text-white">
          Save and continue workflow
        </Button>
      </div>

      {/* Cell edit dialog — table output only */}
      {isTableOutput && (
        <Dialog open={cellEditOpen} onOpenChange={setCellEditOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit cell</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm text-muted-foreground block mb-2">
                {cellEditColumn != null
                  ? (tableData as TableReviewData).tableColumns?.find(
                      (c) => c.key === cellEditColumn,
                    )?.label ?? cellEditColumn.replace(/_/g, " ")
                  : ""}
              </label>
              <Textarea
                value={cellEditValue}
                onChange={(e) => setCellEditValue(e.target.value)}
                className="w-full min-h-[100px] resize-y"
                disabled={isUpdatingCell}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCellEditOpen(false)}
                disabled={isUpdatingCell}
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  if (
                    userId == null ||
                    item == null ||
                    cellEditRowIndex == null ||
                    cellEditColumn == null ||
                    tableData == null
                  )
                    return;
                  setIsUpdatingCell(true);
                  try {
                    const res = await fetch(
                      "/api/workflow/review/update-cell",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          user_id: userId,
                          agent_id: item.agentId,
                          run_id: item.runId,
                          row_index: cellEditRowIndex,
                          column: cellEditColumn,
                          value: cellEditValue,
                        }),
                      },
                    );
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err?.error ?? "Update failed");
                    }
                    setCellEditOpen(false);
                    toast.success("Cell updated");
                    setTableData((prev: unknown) => {
                      const data = prev as TableReviewData;
                      const rows = { ...data.outputTable.rows };
                      const rowKey = String(cellEditRowIndex);
                      rows[rowKey] = {
                        ...rows[rowKey],
                        [cellEditColumn]: cellEditValue,
                      };
                      return {
                        ...data,
                        outputTable: {
                          ...data.outputTable,
                          rows,
                        },
                      };
                    });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to update",
                    );
                  } finally {
                    setIsUpdatingCell(false);
                  }
                }}
                disabled={isUpdatingCell}
                className="bg-[#2D47BC] hover:bg-[#2D47BC]/90"
              >
                {isUpdatingCell ? "Updating…" : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ForReviewPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <ForReviewContent />
    </Suspense>
  );
}
