import type {
  ChatMeta,
  ChatRequest,
  CreateSkillRequest,
  CreateSkillResponse,
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

export interface CreateSkillStreamHandlers {
  onDelta?: (text: string) => void;
  onSkill?: (skill: Skill) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/**
 * POST /api/skills/create and parse the SSE stream: narration `delta` events
 * followed by a single `skill` event with the finished SKILL.md.
 */
export async function streamCreateSkill(
  req: CreateSkillRequest,
  handlers: CreateSkillStreamHandlers,
): Promise<void> {
  const res = await fetch("/api/skills/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`create-skill request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === "delta") handlers.onDelta?.((parsed as { text: string }).text);
        else if (event === "skill") handlers.onSkill?.((parsed as CreateSkillResponse).skill);
        else if (event === "error") handlers.onError?.((parsed as { message: string }).message);
      } catch {
        /* ignore malformed event */
      }
    }
  }
  handlers.onDone?.();
}
