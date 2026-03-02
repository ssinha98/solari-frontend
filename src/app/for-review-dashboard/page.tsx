"use client";

import { Suspense, useEffect, useState } from "react";
import { auth } from "@/tools/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DashboardItem = {
  reviewId: string;
  agentId: string;
  agentName: string;
  nodeId: string;
  nodeLabel: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  runId: string;
};

function StatusBadge({ status }: { status: DashboardItem["status"] }) {
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

function ForReviewDashboardContent() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(
    auth.currentUser?.uid || null,
  );
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set(),
  );
  const [isDeletingTasks, setIsDeletingTasks] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/workflow/for-review/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items as DashboardItem[]);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch for-review items:", err);
        setError("Failed to load review items.");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [userId]);

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const availableIds = new Set(items.map((item) => item.reviewId));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [items]);

  const handleDeleteTasks = async () => {
    if (selectedTaskIds.size === 0 || isDeletingTasks) {
      return;
    }
    if (!userId) {
      toast.error("You must be signed in to delete tasks.");
      return;
    }
    const reviewIds = Array.from(selectedTaskIds);
    setIsDeletingTasks(true);
    try {
      const response = await fetch("/api/workflow/for-review/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          review_ids: reviewIds,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        toast.error("Failed to delete selected tasks.");
        return;
      }
      setItems((prev) =>
        prev.filter((item) => !selectedTaskIds.has(item.reviewId)),
      );
      setSelectedTaskIds(new Set());
      toast.success("Selected tasks deleted.");
    } catch (error) {
      console.error("Failed to delete selected tasks:", error);
      toast.error("Failed to delete selected tasks.");
    } finally {
      setIsDeletingTasks(false);
    }
  };

  if (!userId) {
    return (
      <p className="text-muted-foreground">Please sign in to continue.</p>
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            Your tasks ({items.length})
          </h1>
          {selectedTaskIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteTasks}
              disabled={isDeletingTasks}
            >
              {isDeletingTasks ? "Deleting..." : "Delete tasks"}
            </Button>
          )}
        </div>
        <div className="rounded-lg border bg-card">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              No items flagged for review.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 w-10" />
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Node
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Agent
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.reviewId}
                      className="border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        router.push(
                          `/for-review?reviewId=${item.reviewId}`,
                        )
                      }
                    >
                      <td
                        className="py-3 px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedTaskIds.has(item.reviewId)}
                          onCheckedChange={(checked) => {
                            setSelectedTaskIds((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(item.reviewId);
                              } else {
                                next.delete(item.reviewId);
                              }
                              return next;
                            });
                          }}
                          aria-label={`Select ${item.nodeLabel}`}
                        />
                      </td>
                      <td className="py-3 px-4 text-sm">{item.nodeLabel}</td>
                      <td className="py-3 px-4 text-sm">{item.agentName}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForReviewDashboardPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <ForReviewDashboardContent />
    </Suspense>
  );
}
