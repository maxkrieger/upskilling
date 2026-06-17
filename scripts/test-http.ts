/**
 * HTTP integration test for the dynamic chat path: drives the REAL Hono app via
 * `app.fetch` (full middleware stack — cookie auth, the cue decider, the skills
 * container + tool loop, SSE encoding), rather than calling streamChat directly.
 *
 * Covers: the auth gate (401 without the demo cookie), /api/auth issuing the
 * cookie, and a cue-assent turn producing meta + delta + a create_skill `skill`
 * event + an `applied` event over SSE. Cleans up the skills it registers.
 *
 * Run: `npm run test:http`.
 */
import app from "../server/index.ts";
import { ENV } from "../server/env.ts";
import { deleteSkillRemote, getSkillCreatorRef } from "../server/skills.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${detail}`}`);
  ok ? passed++ : failed++;
}

function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  return app.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}

async function readSSE(res: Response): Promise<Array<{ event: string; data: any }>> {
  const events: Array<{ event: string; data: any }> = [];
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        try {
          events.push({ event, data: JSON.parse(data) });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return events;
}

const CHAT_BODY = {
  profileId: "analyst",
  profileName: "Maya",
  profileRole: "Data analyst",
  skills: [],
  suppressCue: false,
  workflowIndex: [
    {
      id: "wf_deck",
      cluster: "deck-bar-charts",
      cueStatus: "none",
      updatedAt: "2026-06-15T00:00:00.000Z",
      members: [
        { conversationId: "c1", cluster: "deck-bar-charts", summary: "bar chart, company palette, no gridlines/legend, sorted desc", quotes: ["no gridlines", "sorted descending"] },
        { conversationId: "c2", cluster: "deck-bar-charts", summary: "another bar chart, same style", quotes: ["usual style"] },
      ],
    },
  ],
  messages: [
    { role: "user", content: "Bar chart of revenue by product for the board deck, usual style." },
    {
      role: "assistant",
      content:
        "Here's the chart in your usual style — company palette starting #d97757, no gridlines, no legend, sorted descending.\n\nI've noticed you ask for these with the same preferences every time. I can capture it as a reusable Skill. Want me to?",
    },
    { role: "user", content: "Yes — go ahead and capture that workflow as a Skill." },
  ],
};

async function main() {
  if (!ENV.WEBSITE_DEMO_PASSWORD) {
    console.error("WEBSITE_DEMO_PASSWORD not set — cannot test the auth gate.");
    process.exit(1);
  }
  let createdSkillId: string | undefined;

  try {
    console.log("\n=== HTTP integration (app.fetch) ===");

    // 1) Auth gate.
    check("GET /api/health is public (200)", (await call("/api/health")).status === 200);
    check("POST /api/chat without cookie → 401", (await call("/api/chat", { method: "POST", body: "{}" })).status === 401);
    check("POST /api/extract without cookie → 401", (await call("/api/extract", { method: "POST", body: "{}" })).status === 401);

    // 2) Authenticate.
    const wrong = await call("/api/auth", { method: "POST", body: JSON.stringify({ password: "nope" }) });
    check("POST /api/auth wrong password → ok:false", (await wrong.json()).ok === false && !wrong.headers.get("set-cookie"));

    const authRes = await call("/api/auth", { method: "POST", body: JSON.stringify({ password: ENV.WEBSITE_DEMO_PASSWORD }) });
    const setCookie = authRes.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0]; // demo_auth=...
    check("POST /api/auth correct password → ok:true + Set-Cookie", (await authRes.json()).ok === true && /^demo_auth=/.test(cookie));

    // 3) Cue-assent chat turn over SSE, authenticated.
    const chatRes = await call("/api/chat", { method: "POST", cookie, body: JSON.stringify(CHAT_BODY) });
    check("POST /api/chat with cookie → 200", chatRes.status === 200);
    const events = await readSSE(chatRes);
    const meta = events.find((e) => e.event === "meta");
    const deltas = events.filter((e) => e.event === "delta");
    const skillEv = events.find((e) => e.event === "skill");
    const applied = events.find((e) => e.event === "applied");

    check("SSE: meta event carries a traceId", !!meta?.data?.traceId, JSON.stringify(meta?.data));
    check("SSE: streamed at least one delta", deltas.length > 0);
    check(
      "SSE: create_skill produced a skill event with a registered skillId",
      skillEv?.data?.kind === "create" && !!skillEv?.data?.skill?.skillId,
      JSON.stringify(skillEv?.data?.skill ?? null).slice(0, 200),
    );
    check(
      "SSE: applied event reports the skill-creator as used (shown in the UI)",
      Array.isArray(applied?.data?.ids) && applied.data.ids.includes("skill_creator_builtin"),
      JSON.stringify(applied?.data),
    );
    createdSkillId = skillEv?.data?.skill?.skillId;
  } finally {
    // Clean up everything this run registered with the Skills API.
    if (createdSkillId) await deleteSkillRemote(createdSkillId);
    try {
      const ref = await getSkillCreatorRef();
      await deleteSkillRemote(ref.skill_id);
    } catch {
      /* ignore */
    }
  }

  console.log(`\n==== HTTP integration: ${passed}/${passed + failed} checks passed ====`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});
