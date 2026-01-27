// useSlackSyncWidgetData.ts
"use client";

import * as React from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import type { SlackSyncRow } from "./SlackBatchSyncViewer";
import { db } from "@/tools/firebase";

type SlackQueueItem = {
  channel_id: string;
  channel_name: string;
  status: "queued" | "running" | "done" | "error";
  team_id?: string | null;

  error?: string | null;
  result?: any;
};

type SlackBatchDoc = {
  batch_id: string; // ✅ present on each document (per you)
  status: "running" | "done"; // if you have more states, add them here
  completed?: number;
  failed?: number;
  total?: number;

  created_at_unix?: number; // optional if you store it
  queue?: SlackQueueItem[];
};

function detailsFromQueueItem(item: SlackQueueItem): string | null {
  // Prefer Slack-specific nested error (e.g. result.details.error = "not_in_channel")
  const nested = item?.result?.details?.error ?? item?.result?.error;
  if (typeof nested === "string" && nested.trim()) return nested;

  // Fall back to top-level error (e.g. "slack_api_error")
  if (typeof item?.error === "string" && item.error.trim()) return item.error;

  return null;
}

function rowsFromBatchDocs(
  batchDocs: SlackBatchDoc[],
  pageTeamId: string | null,
): SlackSyncRow[] {
  const out: SlackSyncRow[] = [];

  for (const b of batchDocs) {
    const batchId = b.batch_id;
    const queue = Array.isArray(b.queue) ? b.queue : [];

    for (const q of queue) {
      if (q.status === "done") continue; // ✅ only show non-done channel items

      out.push({
        batchId,
        channelId: q.channel_id,
        channelName: q.channel_name,
        status: q.status,
        details: q.status === "error" ? detailsFromQueueItem(q) : null,
        teamId: q.team_id ?? pageTeamId,
      });
    }
  }

  // Nice ordering in the widget
  const order: Record<SlackSyncRow["status"], number> = {
    running: 0,
    queued: 1,
    error: 2,
    done: 3,
  };
  out.sort((a, b) => order[a.status] - order[b.status]);

  return out;
}

function pickActiveBatch(batchDocs: SlackBatchDoc[]): SlackBatchDoc | null {
  const active = batchDocs.filter((b) => b.status !== "done");
  if (active.length === 0) return null;

  // Prefer newest by created_at_unix if present, otherwise just first
  return active
    .slice()
    .sort((a, b) => (b.created_at_unix ?? 0) - (a.created_at_unix ?? 0))[0];
}

export function useSlackSyncWidgetData(
  teamId: string | null,
  agentId: string,
  slackTeamId: string | null,
  uid: string | null,
) {
  const [rows, setRows] = React.useState<SlackSyncRow[]>([]);
  const [visible, setVisible] = React.useState(false);

  // Progress bar stats (from the single active batch)
  const [completed, setCompleted] = React.useState(0);
  const [failed, setFailed] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  // Optional: useful later for retry UI if you want it
  const [activeBatchId, setActiveBatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!teamId || !agentId || !uid) return;

    const colRef = collection(
      db,
      "teams",
      teamId,
      "users",
      uid,
      "agents",
      agentId,
      "slack_pinecone_batches",
    );

    // Listen to recent batch docs and filter client-side.
    // This avoids Firestore "!=" query constraints and stays robust.
    const qRef = query(colRef, orderBy("batch_id", "desc"), limit(25));

    const unsub = onSnapshot(qRef, (snap) => {
      const docs: SlackBatchDoc[] = [];
      snap.forEach((d) => docs.push(d.data() as SlackBatchDoc));

      // Rows: edge-case safe across batches, but only non-done queue items
      const nextRows = rowsFromBatchDocs(docs, slackTeamId);
      setRows(nextRows);
      setVisible(nextRows.length > 0);

      // Progress: only from the single active batch (status != done)
      const active = pickActiveBatch(docs);
      setActiveBatchId(active?.batch_id ?? null);
      setCompleted(active?.completed ?? 0);
      setFailed(active?.failed ?? 0);
      setTotal(active?.total ?? active?.queue?.length ?? 0);
    });

    return () => unsub();
  }, [teamId, agentId, slackTeamId, uid]);

  return { rows, visible, completed, failed, total, activeBatchId };
}
