"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/tools/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
          <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
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
        <div style={{ fontSize: 10, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
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
      <div style={{ fontSize: 10, color: "#2D47BC", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
        {node.kind}
      </div>
      <div style={{ fontSize: 12, color: "#2D47BC", fontWeight: 600, marginBottom: 6 }}>
        {node.nodeLabel}
      </div>
      {node.output !== null && node.output !== undefined && (
        <div style={{ fontSize: 11, color: "#71717a", marginTop: 4, borderTop: "1px solid #1e1e2e", paddingTop: 6, wordBreak: "break-word" }}>
          {node.output}
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedOutput, setEditedOutput] = useState("");

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
      try {
        const res = await fetch("/api/workflow/for-review/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, review_id: reviewId }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        if (data.success && data.item) {
          setItem(data.item as ReviewItem);
          setEditedOutput(data.item.input ?? "");
          setPreviousNode(data.previousNode ?? null);
          setNextNode(data.nextNode ?? null);
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

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
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
