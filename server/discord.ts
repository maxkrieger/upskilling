import { ENV } from "./env.ts";

export interface ErrorContext {
  /** Where the error originated, e.g. "POST /api/chat" or "client". */
  source: string;
  /** Optional extra key/value details surfaced as embed fields. */
  details?: Record<string, string | undefined>;
}

const RED = 0xe74c3c;
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Simple dedupe so a hot error loop doesn't flood the channel. */
const recent = new Map<string, number>();
const DEDUPE_MS = 60_000;

/**
 * Report a runtime error to Discord via webhook. Fire-and-forget: never throws
 * and never blocks the request path. No-ops unless alerting is enabled
 * (production, or DISCORD_ALERTS=true) and a webhook URL is configured.
 *
 * Uses only global `fetch`, so it works in Node and Cloudflare Pages Functions.
 */
export async function reportError(
  error: unknown,
  ctx: ErrorContext,
  opts: { force?: boolean } = {},
): Promise<void> {
  const enabled = opts.force || (ENV.DISCORD_ALERTS && !!ENV.DISCORD_WEBHOOK_URL);
  if (!ENV.DISCORD_WEBHOOK_URL || !enabled) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const fingerprint = `${ctx.source}:${err.message}`;
  const now = Date.now();
  const last = recent.get(fingerprint);
  if (!opts.force && last && now - last < DEDUPE_MS) return;
  recent.set(fingerprint, now);

  const fields = [
    { name: "Environment", value: ENV.ENVIRONMENT, inline: true },
    { name: "Source", value: ctx.source, inline: true },
    ...Object.entries(ctx.details ?? {})
      .filter(([, v]) => v != null && v !== "")
      .map(([name, value]) => ({ name, value: truncate(String(value), 1024), inline: true })),
  ];

  const body = {
    username: "Upskilling Alerts",
    embeds: [
      {
        title: truncate(`🛑 ${err.name}: ${err.message}`, 256),
        description: err.stack ? "```\n" + truncate(err.stack, 1800) + "\n```" : undefined,
        color: RED,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(ENV.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[discord] webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    // Last resort: don't let alerting failures affect anything.
    console.error("[discord] failed to deliver alert:", e);
  }
}
