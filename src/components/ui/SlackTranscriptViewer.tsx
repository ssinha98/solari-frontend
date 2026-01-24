"use client";

import React, { useEffect, useMemo, useState } from "react";

type ThreadMessage = {
  ts: string;
  user: string;
  text: string;
  is_reply: boolean;
  permalink?: string;
};

type ThreadBlock = {
  thread_ts: string | null;
  messages: ThreadMessage[];
};

type ThreadsJson = {
  team_id: string;
  channel_id: string;
  channel_name: string;
  sync_run_id: string;
  generated_at_unix: number;
  threads: ThreadBlock[];
};

type TranscriptResponse = {
  ok: boolean;
  uid: string;
  agent_id: string;
  source_id: string;
  sync_run_id: string;
  created_at?: string;
  last_message_ts?: string;
  threads_json: ThreadsJson;
};

type ChunkListItem = {
  sync_run_id: string;
  created_at?: string;
  last_message_ts?: string;
  // you may have other fields; we only need sync_run_id
};

type ChunkListResponse = {
  ok: boolean;
  count: number;
  items: ChunkListItem[];
};

function formatTs(ts: string) {
  // Slack ts is "seconds.millis" as string; render as local time
  const seconds = Number(ts);
  if (!Number.isFinite(seconds)) return ts;
  const d = new Date(seconds * 1000);
  return d.toLocaleString(); // ok for now
}

function shortenUser(user: string) {
  // You can later map user IDs -> display names with users.info
  return user?.startsWith("U") ? user : user || "unknown";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export default function SlackTranscriptViewer(props: {
  uid: string;
  agentId: string;
  sourceId: string; // channel id doc id
  className?: string;
}) {
  const { uid, agentId, sourceId, className } = props;

  const [chunkIndex, setChunkIndex] = useState<ChunkListItem[]>([]);
  const [idx, setIdx] = useState<number>(0); // 0 = newest
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingChunk, setLoadingChunk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TranscriptResponse | null>(null);

  const hasEarlier = idx > 0;
  const hasOlder = idx < chunkIndex.length - 1;

  const header = useMemo(() => {
    const channelName = data?.threads_json?.channel_name;
    const channelId = data?.threads_json?.channel_id || sourceId;
    const teamId = data?.threads_json?.team_id;
    const slackOpen =
      teamId && channelId
        ? `https://slack.com/app_redirect?team=${encodeURIComponent(
            teamId
          )}&channel=${encodeURIComponent(channelId)}`
        : null;

    return { channelName, channelId, teamId, slackOpen };
  }, [data, sourceId]);

  // 1) Load chunk list (newest first)
  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      setLoadingIndex(true);
      setError(null);
      try {
        const url =
          `/api/slack/transcript_chunks/list` +
          `?uid=${encodeURIComponent(uid)}` +
          `&agent_id=${encodeURIComponent(agentId)}` +
          `&source_id=${encodeURIComponent(sourceId)}` +
          `&limit=100`;

        const resp = await fetchJson<ChunkListResponse>(url);
        if (!resp.ok) throw new Error("chunk_list_failed");
        if (cancelled) return;

        // IMPORTANT: your list endpoint returns created_at desc already.
        setChunkIndex(resp.items || []);
        setIdx(0);
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message || "Failed to load transcript index");
      } finally {
        if (!cancelled) setLoadingIndex(false);
      }
    }

    loadIndex();
    return () => {
      cancelled = true;
    };
  }, [uid, agentId, sourceId]);

  // 2) Load transcript for current idx
  useEffect(() => {
    let cancelled = false;

    async function loadChunk() {
      if (!chunkIndex.length) return;

      const syncRun = chunkIndex[idx]?.sync_run_id;
      if (!syncRun) return;

      setLoadingChunk(true);
      setError(null);
      try {
        const url =
          `/api/slack/transcript_by_sync_run` +
          `?uid=${encodeURIComponent(uid)}` +
          `&agent_id=${encodeURIComponent(agentId)}` +
          `&source_id=${encodeURIComponent(sourceId)}` +
          `&sync_run_id=${encodeURIComponent(syncRun)}`;

        const resp = await fetchJson<TranscriptResponse>(url);
        if (!resp.ok) throw new Error("transcript_fetch_failed");
        if (cancelled) return;

        setData(resp);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load transcript");
      } finally {
        if (!cancelled) setLoadingChunk(false);
      }
    }

    loadChunk();
    return () => {
      cancelled = true;
    };
  }, [uid, agentId, sourceId, chunkIndex, idx]);

  const threads = data?.threads_json?.threads || [];

  return (
    <div className={className}>
      <div className="rounded-2xl border border-neutral-800 bg-black text-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold">
                #{header.channelName || "slack-channel"}
              </div>
              <div className="text-xs text-neutral-400 truncate">
                {header.channelId}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              <span>
                Sync run:{" "}
                <span className="font-mono text-neutral-300">
                  {data?.sync_run_id || "—"}
                </span>
              </span>
              <span>Created: {data?.created_at || "—"}</span>
              <span>Last msg ts: {data?.last_message_ts || "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {header.slackOpen && (
              <a
                href={header.slackOpen}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-900"
              >
                Open in Slack
              </a>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
          <div className="text-xs text-neutral-400">
            {loadingIndex
              ? "Loading runs…"
              : `${chunkIndex.length} sync run(s)`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasEarlier || loadingChunk || loadingIndex}
              onClick={() => setIdx((v) => Math.max(0, v - 1))}
              className="rounded-xl border border-neutral-700 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-neutral-900"
              title="Go to a newer sync run"
            >
              Earlier
            </button>
            <button
              type="button"
              disabled={!hasOlder || loadingChunk || loadingIndex}
              onClick={() =>
                setIdx((v) => Math.min(chunkIndex.length - 1, v + 1))
              }
              className="rounded-xl border border-neutral-700 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-neutral-900"
              title="Go to an older sync run"
            >
              Older
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-auto px-4 py-3">
          {error && (
            <div className="mb-3 rounded-xl border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {loadingChunk && (
            <div className="text-sm text-neutral-400">Loading transcript…</div>
          )}

          {!loadingChunk && !error && threads.length === 0 && (
            <div className="text-sm text-neutral-400">
              No messages in this sync run.
              <div className="mt-2 text-xs text-neutral-500">
                Try clicking <span className="text-neutral-300">Older</span> to
                load a previous run that contains messages.
              </div>
            </div>
          )}

          {!loadingChunk && !error && threads.length > 0 && (
            <div className="space-y-4 font-mono text-[13px] leading-5">
              {threads.map((t, i) => {
                const isThread = !!t.thread_ts && t.messages?.length > 1;
                return (
                  <div
                    key={`${t.thread_ts || "standalone"}-${i}`}
                    className="rounded-xl border border-neutral-900 bg-neutral-950/40 px-3 py-2"
                  >
                    {t.messages.map((m, j) => {
                      const isReply = m.is_reply;
                      return (
                        <div
                          key={`${m.ts}-${j}`}
                          className={`py-1 ${isReply ? "pl-6" : ""}`}
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-neutral-400">
                              [{formatTs(m.ts)}]
                            </span>
                            <span className="text-white">
                              @{shortenUser(m.user)}
                            </span>

                            {m.permalink && (
                              <a
                                href={m.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-neutral-400 underline decoration-neutral-700 hover:text-neutral-200"
                              >
                                open
                              </a>
                            )}
                          </div>

                          <div className="mt-0.5 whitespace-pre-wrap text-white">
                            {isReply ? "↳ " : ""}
                            {m.text}
                          </div>
                        </div>
                      );
                    })}

                    {isThread && (
                      <div className="mt-2 text-xs text-neutral-500">
                        thread_ts:{" "}
                        <span className="font-mono text-neutral-400">
                          {t.thread_ts}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
          Tip: later you can highlight cited messages by matching Pinecone
          results to message <span className="font-mono">ts</span> and toggling
          a highlight class.
        </div>
      </div>
    </div>
  );
}
