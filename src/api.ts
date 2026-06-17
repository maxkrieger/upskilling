import type {
  ChatMeta,
  ChatRequest,
  ExtractRequest,
  Skill,
  WorkflowSummary,
} from "../shared/types.ts";

export async function checkPassword(password: string): Promise<boolean> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { ok: boolean };
  return json.ok;
}

export interface ChatStreamHandlers {
  onMeta?: (meta: ChatMeta) => void;
  onDelta?: (text: string) => void;
  /** A skill the model just created/updated via tool call (persist it locally). */
  onSkill?: (payload: { skill: Skill; kind: "create" | "update"; replacesLocalId?: string }) => void;
  /** A mounted skill fired at content offset `at` — splice an inline indicator. */
  onSkillUsed?: (use: { id: string; name: string; at: number }) => void;
  /** The session cookie was missing/expired (401) — re-show the gate. */
  onUnauthorized?: () => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/** POST /api/chat and parse the SSE stream of meta/delta/done events. */
export async function streamChat(
  req: ChatRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (res.status === 401) {
    handlers.onUnauthorized?.();
    handlers.onError?.("Session expired — please log in again.");
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError?.(`chat request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      parseEvent(raw, handlers);
    }
  }
  handlers.onDone?.();
}

function parseEvent(raw: string, handlers: ChatStreamHandlers) {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    if (event === "meta") handlers.onMeta?.(parsed as ChatMeta);
    else if (event === "delta") handlers.onDelta?.((parsed as { text: string }).text);
    else if (event === "skill")
      handlers.onSkill?.(parsed as { skill: Skill; kind: "create" | "update"; replacesLocalId?: string });
    else if (event === "skill-used")
      handlers.onSkillUsed?.(parsed as { id: string; name: string; at: number });
    else if (event === "error") handlers.onError?.((parsed as { message: string }).message);
  } catch {
    /* ignore malformed event */
  }
}

export async function extractWorkflow(
  req: ExtractRequest,
): Promise<{ isWorkflow: boolean; summary: WorkflowSummary }> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

/** Register a hand-authored skill with the official Skills API. */
export async function registerSkillRemote(skill: {
  name: string;
  description: string;
  instructions: string;
}): Promise<{ skillId: string; skillVersion: string } | null> {
  try {
    const res = await fetch("/api/skills/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(skill),
    });
    if (!res.ok) return null;
    return (await res.json()) as { skillId: string; skillVersion: string };
  } catch {
    return null;
  }
}

/** Best-effort: delete the registered skill from the official Skills API. */
export async function deleteSkillRemote(skillId: string): Promise<void> {
  try {
    await fetch("/api/skills/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
  } catch {
    /* ignore */
  }
}

