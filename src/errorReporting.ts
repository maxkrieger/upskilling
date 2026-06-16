// Forwards browser runtime errors to the backend, which alerts Discord (when
// alerting is enabled for the deployment). Best-effort and deduped.

const seen = new Map<string, number>();
const DEDUPE_MS = 60_000;

export function reportClientError(input: {
  message: string;
  stack?: string;
  kind?: string;
}): void {
  const key = `${input.kind}:${input.message}`;
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < DEDUPE_MS) return;
  seen.set(key, now);

  try {
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ ...input, url: window.location.href }),
    });
  } catch {
    /* never let reporting throw */
  }
}

/** Install global handlers for uncaught errors and promise rejections. */
export function installClientErrorReporting(): void {
  window.addEventListener("error", (e) => {
    reportClientError({
      kind: "window.error",
      message: e.message || String(e.error),
      stack: e.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    reportClientError({
      kind: "unhandledrejection",
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
    });
  });
}
