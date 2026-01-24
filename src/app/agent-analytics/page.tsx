"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/tools/firebase";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Info } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnalyticsHBarChart } from "@/components/analytics_hbarchart";

type RatingDoc = {
  id: string;
  data: Record<string, unknown>;
};

type RatingRow = {
  id: string;
  question: string;
  sourceProvided: string;
  suggestedSource: string;
  finalSource: string;
  answer: string;
  rating: string;
  notes: string;
};

type SectionKey =
  | "question"
  | "sourceProvided"
  | "suggestedSource"
  | "finalSource"
  | "answer"
  | "rating"
  | "notes";

function AgentAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("id");
  const [userId, setUserId] = useState<string | null>(
    auth.currentUser?.uid || null
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<RatingDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<RatingRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionKey | null>(
    null
  );
  const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
    question: null,
    sourceProvided: null,
    suggestedSource: null,
    finalSource: null,
    answer: null,
    rating: null,
    notes: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchTeamId = async () => {
      if (!userId) {
        setTeamId(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", userId));
        const nextTeamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;
        setTeamId(nextTeamId ?? null);
      } catch (error) {
        console.error("Failed to load team ID:", error);
        setTeamId(null);
      }
    };

    fetchTeamId();
  }, [userId]);

  useEffect(() => {
    if (!userId || !agentId || !teamId) {
      setRatings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const ratingsRef = collection(
      db,
      "teams",
      teamId,
      "agents",
      agentId,
      "ratings"
    );

    const unsubscribe = onSnapshot(
      ratingsRef,
      (snapshot) => {
        const docs: RatingDoc[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data() as Record<string, unknown>,
        }));
        setRatings(docs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load ratings:", error);
        setRatings([]);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, agentId, teamId]);

  useEffect(() => {
    if (!drawerOpen || !selectedSection) return;
    const target = sectionRefs.current[selectedSection];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drawerOpen, selectedSection]);

  if (!agentId) {
    return <p className="text-muted-foreground">Agent ID is required.</p>;
  }

  if (!userId) {
    return <p className="text-muted-foreground">Please sign in to continue.</p>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading analytics...</p>;
  }

  if (ratings.length === 0) {
    return <p className="text-muted-foreground">No analytics yet.</p>;
  }

  const CustomToolTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-full bg-black text-white px-3 py-1 text-xs flex items-center gap-2 shadow">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.name}</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const rows: RatingRow[] = ratings.map((rating) => {
    const data = rating.data;
    return {
      id: rating.id,
      question: String(data.question ?? ""),
      sourceProvided:
        data.source_provided === true
          ? "true"
          : data.source_provided === false
            ? "false"
            : "",
      suggestedSource: String(data.suggested_source ?? ""),
      finalSource: String(data.final_source ?? ""),
      answer: String(data.answer ?? ""),
      rating: String(data.rating ?? ""),
      notes: String(data.notes ?? ""),
    };
  });

  const totalRated = ratings.reduce((acc, r) => {
    const rating = String(r.data.rating ?? "");
    return acc + (rating === "up" || rating === "down" ? 1 : 0);
  }, 0);

  const thumbsUpCount = ratings.reduce((acc, r) => {
    const rating = String(r.data.rating ?? "");
    return acc + (rating === "up" ? 1 : 0);
  }, 0);

  const thumbsUpPercent =
    totalRated > 0 ? Math.round((thumbsUpCount / totalRated) * 100) : 0;
  const thumbsDownPercent = totalRated > 0 ? 100 - thumbsUpPercent : 0;

  const sourceEvalCount = ratings.reduce((acc, r) => {
    const data = r.data as any;
    if (data.source_provided !== false) return acc;
    const finalSource = String(data.final_source ?? "")
      .trim()
      .toLowerCase();
    const suggestedSource = String(data.suggested_source ?? "")
      .trim()
      .toLowerCase();
    return finalSource && suggestedSource ? acc + 1 : acc;
  }, 0);

  const correctSourceCount = ratings.reduce((acc, r) => {
    const data = r.data as any;
    if (data.source_provided !== false) return acc;
    const finalSource = String(data.final_source ?? "")
      .trim()
      .toLowerCase();
    const suggestedSource = String(data.suggested_source ?? "")
      .trim()
      .toLowerCase();
    if (!finalSource || !suggestedSource) return acc;
    return finalSource === suggestedSource ? acc + 1 : acc;
  }, 0);

  const correctSourcePercent =
    sourceEvalCount > 0
      ? Math.round((correctSourceCount / sourceEvalCount) * 100)
      : 0;

  const incorrectSourcePercent =
    sourceEvalCount > 0 ? 100 - correctSourcePercent : 0;

  const handleCellClick = (row: RatingRow, section: SectionKey) => {
    setSelectedRow(row);
    setSelectedSection(section);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => {
            if (agentId) {
              router.push(`/chatAgent?id=${agentId}`);
            }
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to agent
        </button>
      </div>
      <div className="flex gap-4">
        <AnalyticsHBarChart
          title="Source accuracy"
          description="How often did our source-router get the right source?"
          containerClassName="w-full md:w-1/2"
          chartHeightClassName="h-[180px]"
          maxValue={100}
          valueFormatter={(v) => `${Math.round(v)}%`}
          valueLabel="Rate"
          items={[
            {
              label: "Correct source",
              value: correctSourcePercent ?? 0,
            },
            {
              label: "Incorrect source",
              value: incorrectSourcePercent ?? 0,
            },
          ]}
        />

        <AnalyticsHBarChart
          title="Thumbs up vs down"
          description="Based on your ratings"
          containerClassName="w-full md:w-1/2"
          chartHeightClassName="h-[180px]"
          maxValue={100}
          valueFormatter={(v) => `${Math.round(v)}%`}
          valueLabel="Rate"
          items={[
            {
              label: "Thumbs up",
              value: thumbsUpPercent ?? 0,
            },
            {
              label: "Thumbs down",
              value: thumbsDownPercent ?? 0,
            },
          ]}
        />
      </div>
      <div className="rounded-lg border border-border bg-background font-mono">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Question</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Question info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          What you asked your agent
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Source Provided</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Source Provided info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          True or False: did your message specifiy a source to
                          use?
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Suggested Source</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Suggested Source info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          Which source did the router suggest?
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Final Source</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Final Source info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          In the end, which source did the agent use? (If you
                          provided a source, this is the source you chose)
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Answer</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Answer info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          Your agents response to the question
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Rating</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Rating info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">Was the answer helpful?</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-2">
                  <span>Notes</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Notes info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">Any additional notes</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-accent">
                <TableCell className="max-w-[280px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "question")}
                    className="w-full text-left"
                  >
                    {row.question}
                  </button>
                </TableCell>
                <TableCell className="max-w-[160px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "sourceProvided")}
                    className="w-full text-left"
                  >
                    <span
                      className={
                        row.sourceProvided === "true"
                          ? "text-green-500"
                          : row.sourceProvided === "false"
                            ? "text-red-500"
                            : ""
                      }
                    >
                      {row.sourceProvided}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "suggestedSource")}
                    className="w-full text-left"
                  >
                    {row.suggestedSource ? `@${row.suggestedSource}` : ""}
                  </button>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "finalSource")}
                    className="w-full text-left"
                  >
                    {row.finalSource ? `@${row.finalSource}` : ""}
                  </button>
                </TableCell>
                <TableCell className="max-w-[320px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "answer")}
                    className="w-full text-left"
                  >
                    {row.answer}
                  </button>
                </TableCell>
                <TableCell className="max-w-[120px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "rating")}
                    className="w-full text-left"
                  >
                    {row.rating === "up" ? (
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                    ) : row.rating === "down" ? (
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    ) : (
                      ""
                    )}
                  </button>
                </TableCell>
                <TableCell className="max-w-[280px] truncate">
                  <button
                    type="button"
                    onClick={() => handleCellClick(row, "notes")}
                    className="w-full text-left"
                  >
                    {row.notes}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedRow(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="font-mono">Response Details</SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div
                ref={(node) => {
                  sectionRefs.current.question = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Question</p>
                <Separator className="my-2" />
                <p className="whitespace-pre-wrap break-words font-mono text-sm">
                  {selectedRow.question || ""}
                </p>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.sourceProvided = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Source Provided</p>
                <Separator className="my-2" />
                <p
                  className={`whitespace-pre-wrap break-words font-mono text-sm ${
                    selectedRow.sourceProvided === "true"
                      ? "text-green-500"
                      : selectedRow.sourceProvided === "false"
                        ? "text-red-500"
                        : ""
                  }`}
                >
                  {selectedRow.sourceProvided || ""}
                </p>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.suggestedSource = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Suggested Source</p>
                <Separator className="my-2" />
                <p className="whitespace-pre-wrap break-words font-mono text-sm">
                  {selectedRow.suggestedSource
                    ? `@${selectedRow.suggestedSource}`
                    : ""}
                </p>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.finalSource = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Final Source</p>
                <Separator className="my-2" />
                <p className="whitespace-pre-wrap break-words font-mono text-sm">
                  {selectedRow.finalSource ? `@${selectedRow.finalSource}` : ""}
                </p>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.answer = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Answer</p>
                <Separator className="my-2" />
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="whitespace-pre-wrap break-words text-sm font-mono"
                >
                  {selectedRow.answer || ""}
                </ReactMarkdown>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.rating = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Rating</p>
                <Separator className="my-2" />
                <div className="flex items-center gap-2">
                  {selectedRow.rating === "up" ? (
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                  ) : selectedRow.rating === "down" ? (
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                  ) : null}
                  <p className="whitespace-pre-wrap break-words font-mono text-sm">
                    {selectedRow.rating || ""}
                  </p>
                </div>
              </div>
              <div
                ref={(node) => {
                  sectionRefs.current.notes = node;
                }}
                className="rounded-md border border-border bg-muted p-3 text-white"
              >
                <p className="text-sm uppercase font-mono">Notes</p>
                <Separator className="my-2" />
                <p className="whitespace-pre-wrap break-words font-mono text-sm">
                  {selectedRow.notes || ""}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AgentAnalyticsPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading analytics...</p>}
    >
      <AgentAnalyticsContent />
    </Suspense>
  );
}
