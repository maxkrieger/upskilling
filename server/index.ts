import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { ENV } from "./env.ts";
import { jsonCall, streamChat } from "./anthropic.ts";
import { decideCue } from "./cue.ts";
import { reportError } from "./discord.ts";
import { startTrace } from "./trace.ts";
import {
  CODE_EXECUTION_TOOL,
  CREATE_SKILL_TOOL,
  deleteSkillRemote,
  getSkillCreatorRef,
  nameSlugBase,
  registerSkill,
  registerSkillVersion,
  skillContainer,
  SKILLS_BETAS,
  slugBase,
  UPDATE_SKILL_TOOL,
} from "./skills.ts";
import {
  buildChatSystem,
  buildExtractUser,
  cueOperatorNote,
  updateOperatorNote,
  EXTRACT_SCHEMA,
} from "./prompts.ts";
import { conversationToText, id, toAnthropicMessages } from "./util.ts";
import type {
  ChatMeta,
  ChatRequest,
  ExtractRequest,
  ExtractResponse,
  Skill,
  WorkflowSummary,
} from "../shared/types.ts";

const app = new Hono();
app.use("/api/*", cors());

// ---- Auth gate: every /api/* route requires the demo cookie that /api/auth
// sets on a correct password. Exempt only the endpoints needed to authenticate
// or probe liveness. Enforced only when a demo password is configured (so local
// dev without one stays open). See .claude/skills/authenticated-endpoints. ----
const AUTH_EXEMPT = new Set(["/api/health", "/api/auth"]);
app.use("/api/*", async (c, next) => {
  if (!ENV.WEBSITE_DEMO_PASSWORD) return next();
  if (AUTH_EXEMPT.has(c.req.path)) return next();
  if (getCookie(c, "demo_auth") === ENV.WEBSITE_DEMO_PASSWORD) return next();
  return c.json({ error: "unauthorized" }, 401);
});

// Global handler: any uncaught route error is alerted to Discord and returns 500.
app.onError((err, c) => {
  void reportError(err, {
    source: `${c.req.method} ${new URL(c.req.url).pathname}`,
  });
  console.error("[api] unhandled error:", err);
  return c.json({ error: "internal_error" }, 500);
});

app.get("/api/health", (c) =>
  c.json({ ok: true, model: ENV.MODEL_MAIN, hasKey: !!ENV.ANTHROPIC_API_KEY }),
);

// ---- Client-side runtime errors forwarded from the SPA. ----
app.post("/api/report-error", async (c) => {
  const body = await c.req.json<{
    message: string;
    stack?: string;
    url?: string;
    kind?: string;
  }>();
  const err = new Error(body.message || "Unknown client error");
  err.name = body.kind ? `ClientError(${body.kind})` : "ClientError";
  if (body.stack) err.stack = body.stack;
  await reportError(err, { source: "client", details: { url: body.url } });
  return c.json({ ok: true });
});

// ---- Auth: simple shared-password check for the demo gate. ----
app.post("/api/auth", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  const ok = !!ENV.WEBSITE_DEMO_PASSWORD && password === ENV.WEBSITE_DEMO_PASSWORD;
  if (ok) {
    // Set the cookie the requireAuth middleware checks. HttpOnly so XSS can't
    // read it; the browser auto-sends it on every same-origin /api request.
    setCookie(c, "demo_auth", ENV.WEBSITE_DEMO_PASSWORD, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: ENV.ENVIRONMENT === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return c.json({ ok });
});

// ---- Chat: cueing decider + streamed completion with Skills attached. ----
app.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
  const tr = startTrace("chat");
  tr.log("request", {
    profile: body.profileId,
    lastUser: lastUser?.content,
    enabledSkills: (body.skills ?? []).filter((s) => s.enabled).map((s) => s.name),
  });

  // Run the cueing decider (stateless) before the response. Skipped when snoozed.
  let cueInstruction: string | undefined;
  let banner: ChatMeta["banner"];
  if (!body.suppressCue && lastUser) try {
    const decision = await decideCue({
      userMessage: lastUser.content,
      workflowIndex: body.workflowIndex ?? [],
      skills: body.skills ?? [],
    });
    tr.log("cue.decision", decision);
    if (decision.shouldCue && decision.kind === "update" && decision.targetSkillId) {
      const sk = (body.skills ?? []).find((s) => s.id === decision.targetSkillId);
      cueInstruction = updateOperatorNote({
        skillName: sk?.name ?? "your skill",
        newCriterion: decision.newCriterion ?? "this new preference",
      });
      banner = {
        kind: "update",
        targetSkillId: decision.targetSkillId,
        suggestedName: sk?.name ?? "Skill",
        summary: decision.newCriterion,
        status: "pending",
      };
    } else if (decision.shouldCue && decision.workflowSetId) {
      // Fixed, strongly-ordered operator note (built here, not by the decider).
      // It does not name the skill — the name is revealed only after creation.
      cueInstruction = cueOperatorNote({
        preferences: decision.preferences ?? "the same preferences",
        trigger: decision.trigger ?? "this kind of task",
      });
      banner = {
        kind: "create",
        workflowSetId: decision.workflowSetId,
        suggestedName: decision.suggestedName ?? "New Skill",
        summary: decision.preferences,
        trigger: decision.trigger,
        status: "pending",
      };
    }
  } catch (err) {
    console.error("[cue] failed:", err);
    void reportError(err, { source: "POST /api/chat (cue decider)" });
  }

  const meta: ChatMeta = {
    banner,
    // Actual firings are detected during streaming and sent via an `applied`
    // event — start empty rather than guessing from the enabled set.
    appliedSkillIds: [],
    traceId: tr.id,
  };

  // Build the message history. Deliver any cue as a mid-conversation system
  // turn after the latest user message (beta), not appended to the user's text.
  const messages: any[] = toAnthropicMessages(body.messages ?? []);
  const betas: string[] = [...SKILLS_BETAS];

  // Always mount the skill-creator (authoring methodology) plus the user's
  // enabled, registered skills (so they trigger natively). The model persists
  // new/updated skills by calling create_skill / update_skill.
  let creatorRef: { skill_id: string; version: string; slug: string } | undefined;
  try {
    creatorRef = await getSkillCreatorRef();
  } catch (err) {
    console.error("[chat] skill-creator registration failed:", err);
    void reportError(err, { source: "POST /api/chat (skill-creator register)" });
  }
  const container = skillContainer(body.skills ?? [], creatorRef);
  const tools: any[] = [CODE_EXECUTION_TOOL, CREATE_SKILL_TOOL, UPDATE_SKILL_TOOL];

  // Map a fired skill's directory slug back to a local skill id, so the UI can
  // show which skills actually fired. Prefer the exact stored slug; fall back to
  // matching the slug's name-base (for skills registered before slugs were kept).
  const slugToLocalId = new Map<string, string>();
  const baseToLocalId = new Map<string, string>();
  if (creatorRef?.slug) slugToLocalId.set(creatorRef.slug, "skill_creator_builtin");
  baseToLocalId.set("skill-creator", "skill_creator_builtin");
  for (const s of body.skills ?? []) {
    if (!s.skillId) continue;
    if (s.slug) slugToLocalId.set(s.slug, s.id);
    baseToLocalId.set(nameSlugBase(s.name), s.id);
  }
  const firedIds = new Set<string>();

  if (cueInstruction) {
    messages.push({ role: "system", content: cueInstruction });
    betas.push("mid-conversation-system-2026-04-07");
  }

  const system = buildChatSystem({
    profileName: body.profileName ?? body.profileId,
    profileRole: body.profileRole ?? "",
  });

  tr.log("attached", { container, tools: tools.map((t: any) => t.name), betas, operatorNote: !!cueInstruction });

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "meta", data: JSON.stringify(meta) });
    let fullText = "";
    try {
      await streamChat({
        system,
        messages,
        maxTokens: 8192, // headroom for long outputs — we stream
        container,
        tools,
        betas,
        handlers: {
          onText: (delta) => {
            fullText += delta;
            void stream.writeSSE({ event: "delta", data: JSON.stringify({ text: delta }) });
          },
          // A mounted skill was loaded (it fired) — map its slug to a local id.
          onSkillFired: (slug) => {
            const localId = slugToLocalId.get(slug) ?? baseToLocalId.get(slugBase(slug));
            tr.log("skill.fired", { slug, mappedTo: localId ?? "(unmapped)" });
            if (localId) firedIds.add(localId);
          },
          // The model persists skills by calling these tools; we register with
          // the Skills API and push the saved skill to the client (localStorage).
          onToolUse: async (name, input) => {
            tr.log("tool.call", { name, skillName: input?.name });
            tr.log("text.before-tool", fullText);
            try {
              if (name === "create_skill") {
                const reg = await registerSkill(input);
                const skill: Skill = {
                  id: id("skill"),
                  name: input.name,
                  description: input.description,
                  instructions: input.instructions,
                  source: "user",
                  enabled: true,
                  createdAt: new Date().toISOString(),
                  skillId: reg.skillId,
                  skillVersion: reg.skillVersion,
                };
                skill.slug = reg.slug;
                await stream.writeSSE({ event: "skill", data: JSON.stringify({ skill, kind: "create" }) });
                tr.log("tool.created", { localId: skill.id, skillId: reg.skillId, slug: reg.slug, name: skill.name });
                return `Saved. The "${input.name}" skill is now active and will apply automatically next time.`;
              }
              if (name === "update_skill") {
                const target = (body.skills ?? []).find(
                  (s) => s.skillId && s.name.toLowerCase() === String(input.name).toLowerCase(),
                );
                if (!target?.skillId) {
                  tr.log("tool.update-no-match", { name: input?.name });
                  return `No existing skill named "${input.name}" was found — call create_skill to make a new one instead.`;
                }
                const reg = await registerSkillVersion(target.skillId, input);
                const skill: Skill = {
                  ...target,
                  description: input.description,
                  instructions: input.instructions,
                  skillVersion: reg.skillVersion,
                };
                await stream.writeSSE({
                  event: "skill",
                  data: JSON.stringify({ skill, kind: "update", replacesLocalId: target.id }),
                });
                tr.log("tool.updated", { localId: target.id, skillId: target.skillId, version: reg.skillVersion });
                return `Updated the "${input.name}" skill.`;
              }
              return `Unknown tool: ${name}`;
            } catch (e) {
              console.error(`[chat] ${name} failed:`, e);
              tr.log("tool.error", { name, message: (e as Error).message });
              void reportError(e, { source: `POST /api/chat (${name})` });
              return `Failed to save the skill: ${(e as Error).message}`;
            }
          },
        },
      });
      // Report which skills actually fired so the client can mark them + count.
      await stream.writeSSE({ event: "applied", data: JSON.stringify({ ids: [...firedIds] }) });
      tr.log("applied", [...firedIds]);
      tr.log("text.final", fullText);
    } catch (err) {
      console.error("[chat] stream error:", err);
      tr.log("stream.error", { message: (err as Error).message });
      void reportError(err, { source: "POST /api/chat (stream)", details: { profile: body.profileId } });
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: (err as Error).message }),
      });
    }
    await stream.writeSSE({ event: "done", data: "{}" });
    await tr.end();
  });
});

// ---- Extract: derive a workflow summary from a (finished) conversation. ----
app.post("/api/extract", async (c) => {
  const body = await c.req.json<ExtractRequest>();
  const existingClusters = [
    ...new Set((body.existingIndex ?? []).map((s) => s.cluster)),
  ];

  const result = await jsonCall<{
    summary: string;
    quotes: string[];
    cluster: string;
    isWorkflow: boolean;
  }>({
    system:
      "You extract reusable workflow descriptions from conversations, quoting the user's specific preferences verbatim.",
    user: buildExtractUser({
      conversationText: conversationToText(body.conversation),
      existingClusters,
    }),
    schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
  });

  const summary: WorkflowSummary | null = result.isWorkflow
    ? {
        conversationId: body.conversation.id,
        summary: result.summary,
        quotes: result.quotes ?? [],
        cluster: result.cluster,
      }
    : null;

  const resp: ExtractResponse & { isWorkflow: boolean } = {
    isWorkflow: result.isWorkflow,
    summary: summary as WorkflowSummary,
  };
  return c.json(resp);
});

// ---- Register a hand-authored skill with the official Skills API. ----
app.post("/api/skills/register", async (c) => {
  const body = await c.req.json<{ name: string; description: string; instructions: string }>();
  const registered = await registerSkill(body);
  return c.json(registered);
});

// ---- Delete a registered skill from the official Skills API. ----
app.post("/api/skills/delete", async (c) => {
  const { skillId } = await c.req.json<{ skillId?: string }>();
  if (skillId) await deleteSkillRemote(skillId);
  return c.json({ ok: true });
});

// Process-level crash alerting (Node runtime only; CF Pages uses app.onError).
process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandledRejection:", reason);
  void reportError(reason, { source: "process.unhandledRejection" });
});
process.on("uncaughtException", (err) => {
  console.error("[api] uncaughtException:", err);
  void reportError(err, { source: "process.uncaughtException" });
});

serve({ fetch: app.fetch, port: ENV.API_PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (model: ${ENV.MODEL_MAIN})`);
});

export default app;
