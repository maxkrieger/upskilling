#!/usr/bin/env node
/**
 * Uptime probe for the deployed app. Runs the REAL critical path end-to-end:
 * health -> auth -> one example chat prompt that must stream back real text.
 * Posts to Discord ONLY on failure. No repo dependencies (global fetch) so it
 * runs standalone in CI (see .github/workflows/probe.yml, hourly).
 *
 *   node scripts/probe.mjs            # run the probe (exit 1 + Discord on fail)
 *   node scripts/probe.mjs --selftest # send a test Discord alert (verify wiring)
 *
 * Env: PROBE_URL (default prod), WEBSITE_DEMO_PASSWORD, DISCORD_WEBHOOK_URL.
 */

const BASE = (process.env.PROBE_URL || "https://upskilling-907f60f048.pages.dev").replace(/\/+$/, "");
const PASSWORD = process.env.WEBSITE_DEMO_PASSWORD || "";
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";
const PROMPT = "Reply with exactly: probe ok";
const RED = 0xe74c3c;
const GREEN = 0x2ecc71;

/** Post an embed to the Discord webhook (best-effort, never throws). */
async function discord(title, color, fields) {
  if (!WEBHOOK) {
    console.error("[probe] DISCORD_WEBHOOK_URL not set — cannot alert");
    return;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Upskilling Probe",
        embeds: [{ title, color, fields, timestamp: new Date().toISOString() }],
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("[probe] failed to post Discord alert:", e?.message || e);
  } finally {
    clearTimeout(t);
  }
}

/** AbortSignal that trips after `ms`, with a cleanup fn. */
function deadline(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

const fail = (step, detail) => ({ step, detail: String(detail).slice(0, 600) });

/** Returns a {step, detail} failure object, or null on success. */
async function run() {
  // 1) Health — server up, API key present.
  {
    const d = deadline(15000);
    let res;
    try {
      res = await fetch(`${BASE}/api/health`, { signal: d.signal });
    } catch (e) {
      return fail("health", `request error: ${e?.message || e}`);
    } finally {
      d.clear();
    }
    if (!res.ok) return fail("health", `HTTP ${res.status}`);
    const j = await res.json().catch(() => ({}));
    if (!j.ok) return fail("health", `not ok: ${JSON.stringify(j)}`);
    if (!j.hasKey) return fail("health", "server has no ANTHROPIC_API_KEY");
  }

  // 2) Auth — password accepted, session cookie issued.
  let cookie = "";
  {
    const d = deadline(15000);
    let res;
    try {
      res = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
        signal: d.signal,
      });
    } catch (e) {
      return fail("auth", `request error: ${e?.message || e}`);
    } finally {
      d.clear();
    }
    if (!res.ok) return fail("auth", `HTTP ${res.status}`);
    const j = await res.json().catch(() => ({}));
    if (!j.ok) return fail("auth", "password rejected (ok:false)");
    const m = (res.headers.get("set-cookie") || "").match(/demo_auth=[^;]+/);
    if (!m) return fail("auth", "no demo_auth cookie set");
    cookie = m[0];
  }

  // 3) Chat — one real prompt must stream back text with no error event.
  {
    const d = deadline(90000);
    let res;
    try {
      res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          profileId: "analyst",
          profileName: "Data Analyst",
          profileRole: "probe",
          messages: [{ role: "user", content: PROMPT }],
          skills: [],
          workflowIndex: [],
          suppressCue: true,
        }),
        signal: d.signal,
      });
    } catch (e) {
      d.clear();
      return fail("chat", `request error: ${e?.message || e}`);
    }
    if (!res.ok) {
      d.clear();
      return fail("chat", `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let errMsg = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /event:\s*(.*)/.exec(frame)?.[1]?.trim();
          const data = /data:\s*([\s\S]*)/.exec(frame)?.[1] ?? "";
          if (ev === "delta") {
            try {
              text += JSON.parse(data).text || "";
            } catch {
              /* ignore partial */
            }
          } else if (ev === "error") {
            try {
              errMsg = JSON.parse(data).message || "error";
            } catch {
              errMsg = "error";
            }
          }
        }
      }
    } catch (e) {
      return fail("chat", `stream error: ${e?.message || e}`);
    } finally {
      d.clear();
    }
    if (errMsg) return fail("chat", `stream error event: ${errMsg}`);
    if (!text.trim()) return fail("chat", "no text streamed back");
  }

  return null;
}

async function main() {
  if (process.argv.includes("--selftest")) {
    await discord("🧪 Upskilling probe self-test", GREEN, [
      { name: "Target", value: BASE, inline: true },
      { name: "Status", value: "Discord wiring OK — not a real outage", inline: false },
    ]);
    console.log("[probe] self-test alert sent");
    return;
  }
  const failure = await run();
  if (failure) {
    console.error(`[probe] FAIL at ${failure.step}: ${failure.detail}`);
    await discord("🔴 Upskilling app probe failed", RED, [
      { name: "Target", value: BASE, inline: true },
      { name: "Failed step", value: failure.step, inline: true },
      { name: "Detail", value: failure.detail || "(none)", inline: false },
    ]);
    process.exit(1);
  }
  console.log(`[probe] OK — ${BASE} chat responded`);
}

main().catch(async (e) => {
  console.error("[probe] unexpected error:", e?.message || e);
  await discord("🔴 Upskilling probe crashed", RED, [
    { name: "Target", value: BASE, inline: true },
    { name: "Error", value: String(e?.message || e).slice(0, 600), inline: false },
  ]);
  process.exit(1);
});
