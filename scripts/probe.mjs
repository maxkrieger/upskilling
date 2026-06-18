#!/usr/bin/env node
/**
 * End-to-end BROWSER uptime probe. Drives the REAL deployed UI in headless
 * Chrome: load -> log in at the gate -> type one example prompt -> confirm the
 * assistant streams a reply into the page. Posts to Discord ONLY on failure.
 * Runs hourly via .github/workflows/probe.yml; `npm run probe` runs it locally.
 *
 *   node scripts/probe.mjs            # browser e2e (exit 1 + Discord on fail)
 *   node scripts/probe.mjs --selftest # send a test Discord alert (verify wiring)
 *
 * Env: PROBE_URL (default prod), WEBSITE_DEMO_PASSWORD, DISCORD_WEBHOOK_URL,
 *      PUPPETEER_EXECUTABLE_PATH or CHROME_PATH (Chrome binary location).
 */
import puppeteer from "puppeteer-core";

const BASE = (process.env.PROBE_URL || "https://upskilling-907f60f048.pages.dev").replace(/\/+$/, "");
const PASSWORD = process.env.WEBSITE_DEMO_PASSWORD || "";
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";
const PROMPT = "Reply with exactly: probe ok";
const RED = 0xe74c3c;
const GREEN = 0x2ecc71;

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

/** Drive the real UI; returns {step, detail} on failure or null on success. */
async function runBrowser() {
  let step = "launch-browser";
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    step = "load-page";
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });

    step = "login";
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.type('input[type="password"]', PASSWORD);
    await page.keyboard.press("Enter");

    step = "wait-for-composer";
    await page.waitForSelector('[data-testid="composer-input"]', { timeout: 15000 });

    step = "send-prompt";
    await page.type('[data-testid="composer-input"]', PROMPT);
    await page.keyboard.press("Enter");

    step = "await-assistant-reply";
    // Wait for an assistant message whose text is real content — not the
    // "Working…" placeholder or the animated streaming glyph frames.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="assistant-msg"]');
        if (!el) return false;
        const t = (el.innerText || "")
          .replace(/Working…/g, "")
          .replace(/[·✢✳∗✻✽]/g, "")
          .trim();
        return t.length >= 5;
      },
      { timeout: 90000 },
    );

    if (pageErrors.length) {
      return { step: "runtime-error", detail: `page error: ${pageErrors[0]}`.slice(0, 600) };
    }
    return null;
  } catch (e) {
    return { step, detail: String(e?.message || e).slice(0, 600) };
  } finally {
    await browser.close().catch(() => {});
  }
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
  const failure = await runBrowser();
  if (failure) {
    console.error(`[probe] FAIL at ${failure.step}: ${failure.detail}`);
    await discord("🔴 Upskilling app probe failed (browser e2e)", RED, [
      { name: "Target", value: BASE, inline: true },
      { name: "Failed step", value: failure.step, inline: true },
      { name: "Detail", value: failure.detail || "(none)", inline: false },
    ]);
    process.exit(1);
  }
  console.log(`[probe] OK — ${BASE} rendered an assistant reply`);
}

main().catch(async (e) => {
  console.error("[probe] unexpected error:", e?.message || e);
  await discord("🔴 Upskilling probe crashed", RED, [
    { name: "Target", value: BASE, inline: true },
    { name: "Error", value: String(e?.message || e).slice(0, 600), inline: false },
  ]);
  process.exit(1);
});
