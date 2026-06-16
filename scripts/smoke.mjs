// Headless browser smoke test: load the SPA, log in, run a cue-triggering
// preset, confirm the assistant streams + a Create-Skill banner appears, click
// it, and confirm the skill is created. Not part of the app; a dev check.
import puppeteer from "puppeteer-core";
import { config } from "dotenv";
config();

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SMOKE_URL ?? "http://localhost:5173";
const PW = process.env.WEBSITE_DEMO_PASSWORD;

const log = (...a) => console.log("[smoke]", ...a);
const fail = (m) => {
  console.error("[smoke] FAIL:", m);
  process.exit(1);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
const errors = [];
const ignore = (t) => /Failed to load resource|favicon/i.test(t);
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !ignore(m.text())) errors.push(m.text());
});

try {
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 20000 });

  // --- Login gate ---
  await page.waitForSelector('input[type="password"]', { timeout: 8000 });
  await page.type('input[type="password"]', PW);
  await page.click("button");
  await page.waitForFunction(
    () => !!document.querySelector("select"),
    { timeout: 8000 },
  );
  log("logged in, sidebar present");

  // --- Click a cue-triggering preset (first preset on the empty state) ---
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /Bar chart from a CSV/i.test(b.textContent || "")),
    { timeout: 8000 },
  );
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Bar chart from a CSV/i.test(x.textContent || ""),
    );
    b?.click();
  });
  log("clicked preset, waiting for stream...");

  // --- Wait for assistant text to stream in ---
  await page.waitForFunction(
    () => document.body.innerText.length > 400,
    { timeout: 40000 },
  );

  // --- Wait for the Create Skill banner ---
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /Create Skill/i.test(b.textContent || "")),
    { timeout: 40000 },
  );
  log("✓ Create Skill banner appeared");

  // Check a chart rendered (recharts svg) — wait up to 15s for the stream to
  // finish emitting and parse the chart block.
  let hasChart = false;
  try {
    await page.waitForSelector("svg.recharts-surface", { timeout: 15000 });
    hasChart = true;
  } catch {}
  if (!hasChart) fail("chart did not render");
  log("✓ chart rendered");

  // --- Click Create Skill, confirm skill is created ---
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Create Skill/i.test(x.textContent || ""),
    );
    b?.click();
  });
  // Skill creation streams a narration turn, then makes a structured call —
  // two sequential model calls, so allow generous time.
  await page.waitForFunction(
    () => /Created the|now active/i.test(document.body.innerText),
    { timeout: 120000 },
  );
  log("✓ skill created (banner confirmed)");

  // --- Open Customize and verify the new skill is listed ---
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Customize/i.test(x.textContent || ""),
    );
    b?.click();
  });
  await page.waitForFunction(
    () => /from your workflow/i.test(document.body.innerText),
    { timeout: 8000 },
  );
  log("✓ new skill shown in Customize");

  if (errors.length) {
    log("page errors captured:", errors);
    fail(`${errors.length} runtime error(s)`);
  }
  log("ALL CHECKS PASSED");
  await browser.close();
  process.exit(0);
} catch (e) {
  log("page errors so far:", errors);
  await browser.close();
  fail(e.message);
}
