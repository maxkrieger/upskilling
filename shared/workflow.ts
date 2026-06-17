import type { WorkflowSet, WorkflowSummary } from "./types.ts";

/** Normalize a cluster label so case / punctuation drift doesn't fork a set. */
export function normalizeCluster(c: string): string {
  return (c ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Upsert a conversation's extracted summary into the workflow index, returning a
 * NEW array (inputs are not mutated). Join order — most stable first:
 *   1. the set this conversation is ALREADY a member of — survives cluster-label
 *      drift on re-extraction and PRESERVES the set's cueStatus/skillId (so an
 *      accepted/rejected workflow is never silently re-cued),
 *   2. a set whose cluster matches after normalization (case/punctuation drift),
 *   3. otherwise a new "none" set.
 * The conversation's prior member (if any) is replaced in place — one per convo,
 * so re-extraction updates rather than duplicating (which would inflate the
 * ">= 2 members = overdue" count).
 */
export function upsertSummary(
  base: WorkflowSet[],
  summary: WorkflowSummary,
  conversationId: string,
  newId: () => string,
  nowIso: string,
): WorkflowSet[] {
  const next = base.map((s) => ({ ...s, members: [...s.members] }));
  let target =
    next.find((s) => s.members.some((m) => m.conversationId === conversationId)) ??
    next.find((s) => normalizeCluster(s.cluster) === normalizeCluster(summary.cluster));
  if (!target) {
    target = { id: newId(), cluster: summary.cluster, members: [], cueStatus: "none", updatedAt: nowIso };
    next.unshift(target);
  }
  // One member per conversation: replace the prior summary in place.
  target.members = target.members.filter((m) => m.conversationId !== conversationId);
  target.members.unshift(summary);
  target.updatedAt = nowIso;
  return next;
}
