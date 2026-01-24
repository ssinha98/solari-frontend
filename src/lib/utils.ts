import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ThumbRating = "up" | "down" | "" | null | undefined;

export type RatingDoc = {
  // core
  rating?: ThumbRating;

  // for source-selection accuracy
  source_provided?: boolean;

  // normalize as strings; treat missing/empty as "unknown"
  final_source?: string | null;
  suggested_source?: string | null;

  // other fields you have (ignored for stats)
  question?: string;
  answer?: string;
  notes?: string;
};

export type RatingAnalytics = {
  // 1) thumbs up/down stats
  up: number;
  down: number;
  ratedCount: number; // up+down only
  thumbsUpRate: number | null; // 0..1
  thumbsUpPercent: number | null; // 0..100 integer

  // 2) total messages (all docs, even unrated)
  messageCount: number;

  // 3) source selection accuracy where source_provided === false
  sourceEvalCount: number; // # docs with source_provided=false and both sources present
  correctSourceCount: number; // among those, final_source === suggested_source
  correctSourceRate: number | null; // 0..1
  correctSourcePercent: number | null; // 0..100 integer
};

function normStr(s: unknown): string {
  return (typeof s === "string" ? s : "").trim().toLowerCase();
}

export function computeRatingAnalytics(docs: RatingDoc[]): RatingAnalytics {
  let up = 0;
  let down = 0;

  let messageCount = 0;

  let sourceEvalCount = 0;
  let correctSourceCount = 0;

  for (const d of docs) {
    messageCount += 1;

    // (1) thumbs up/down
    if (d.rating === "up") up += 1;
    else if (d.rating === "down") down += 1;

    // (3) source selection accuracy only when source_provided === false
    if (d.source_provided === false) {
      const finalSource = normStr(d.final_source);
      const suggestedSource = normStr(d.suggested_source);

      // Only evaluate when both are present (avoid skew from missing data)
      if (finalSource && suggestedSource) {
        sourceEvalCount += 1;
        if (finalSource === suggestedSource) correctSourceCount += 1;
      }
    }
  }

  const ratedCount = up + down;
  const thumbsUpRate = ratedCount > 0 ? up / ratedCount : null;
  const thumbsUpPercent =
    thumbsUpRate == null ? null : Math.round(thumbsUpRate * 100);

  const correctSourceRate =
    sourceEvalCount > 0 ? correctSourceCount / sourceEvalCount : null;
  const correctSourcePercent =
    correctSourceRate == null ? null : Math.round(correctSourceRate * 100);

  return {
    up,
    down,
    ratedCount,
    thumbsUpRate,
    thumbsUpPercent,
    messageCount,
    sourceEvalCount,
    correctSourceCount,
    correctSourceRate,
    correctSourcePercent,
  };
}

/**
 * Optional: small helpers for display copy
 */
export function formatThumbsLabel(
  a: RatingAnalytics,
  minRatingsForPercent = 2
): string {
  if (a.ratedCount < minRatingsForPercent) {
    return `${a.ratedCount} rating${a.ratedCount === 1 ? "" : "s"}`;
  }
  return `${a.thumbsUpPercent ?? 0}% 👍 (${a.ratedCount} ratings)`;
}

export function formatCorrectSourceLabel(
  a: RatingAnalytics,
  minExamplesForPercent = 2
): string {
  if (a.sourceEvalCount < minExamplesForPercent) {
    return `${a.sourceEvalCount} source check${a.sourceEvalCount === 1 ? "" : "s"}`;
  }
  return `${a.correctSourcePercent ?? 0}% correct source (${a.sourceEvalCount} checks)`;
}
