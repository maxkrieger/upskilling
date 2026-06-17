import { mkdir, writeFile } from "node:fs/promises";
import { ENV } from "./env.ts";

/**
 * Lightweight per-request tracing for dev. Each trace gets a short id that's
 * logged to the console and written to `traces/<id>.json` so a turn can be
 * inspected after the fact (e.g. "did create_skill fire?"). No-op in production.
 */
const DEV = ENV.ENVIRONMENT !== "production";
let counter = 0;

function truncate(v: unknown): unknown {
  if (typeof v === "string") return v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (Array.isArray(v)) return v.slice(0, 12).map(truncate);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = truncate(val);
    return out;
  }
  return v;
}

export interface Trace {
  id: string;
  log: (event: string, data?: unknown) => void;
  end: () => Promise<void>;
}

export function startTrace(kind: string): Trace {
  const id = `${kind}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
  const events: Array<{ at: string; event: string; data?: unknown }> = [];
  const log = (event: string, data?: unknown) => {
    events.push({ at: new Date().toISOString(), event, data: data === undefined ? undefined : truncate(data) });
    if (DEV) console.log(`[trace ${id}] ${event}`, data === undefined ? "" : truncate(data));
  };
  const end = async () => {
    if (!DEV) return;
    try {
      await mkdir("traces", { recursive: true });
      await writeFile(`traces/${id}.json`, JSON.stringify({ id, kind, events }, null, 2));
    } catch (e) {
      console.warn(`[trace ${id}] failed to persist:`, (e as Error).message);
    }
  };
  return { id, log, end };
}
