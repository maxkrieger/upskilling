import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { ENV } from "./env.ts";
import { jsonCall, streamChat } from "./anthropic.ts";
import { decideCue } from "./cue.ts";
import { reportError } from "./discord.ts";
import {
  deleteSkillRemote,
  ensureAgent,
  ensureSession,
  registerSkill,
  streamTurn,
} from "./managedAgents.ts";
import {
  buildExtractUser,
  buildSkillCreatorSystem,
  buildSkillCreatorUser,
  buildSkillNarrationSystem,
  cueOperatorNote,
  EXTRACT_SCHEMA,
  SKILL_SCHEMA,
} from "./prompts.ts";
import { conversationToText, id } from "./util.ts";
import type {
  ChatMeta,
  ChatRequest,
  CreateSkillRequest,
  CreateSkillResponse,
  ExtractRequest,
  ExtractResponse,
  Skill,
  WorkflowSummary,
} from "../shared/types.ts";

const app = new Hono();
app.use("/api/*", cors());

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
  return c.json({ ok });
});

// ---- Chat: cueing decider + Managed Agents session turn (streamed). ----
app.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();

  // Run the cueing decider (stateless Messages-API call) before the agent turn.
  // Skipped entirely when the user has snoozed cues.
  let cueInstruction: string | undefined;
  let banner: ChatMeta["banner"];
  if (!body.suppressCue) try {
    const decision = await decideCue({
      userMessage: body.userText ?? "",
      workflowIndex: body.workflowIndex ?? [],
      skills: body.skills ?? [],
    });
    if (decision.shouldCue && decision.workflowSetId) {
      const suggestedName = decision.suggestedName ?? "New Skill";
      // Fixed, strongly-ordered operator note (built here, not by the decider).
      cueInstruction = cueOperatorNote(suggestedName, decision.preferences ?? "the same preferences");
      banner = {
        workflowSetId: decision.workflowSetId,
        suggestedName,
        status: "pending",
      };
    }
  } catch (err) {
    console.error("[cue] failed:", err);
    void reportError(err, { source: "POST /api/chat (cue decider)" });
  }

  return streamSSE(c, async (stream) => {
    try {
      // Ensure the agent (reuses the client's cached one if its skill set is
      // unchanged) and the session, so meta can carry both back to the client.
      const agent = await ensureAgent({
        profileName: body.profileName ?? body.profileId,
        profileRole: body.profileRole ?? "",
        skills: body.skills ?? [],
        clientAgent: body.agent,
      });
      const sessionId = await ensureSession({
        agentId: agent.id,
        sessionId: body.sessionId,
        sessionAgentId: body.sessionAgentId,
      });

      const meta: ChatMeta = {
        banner,
        appliedSkillIds: (body.skills ?? []).filter((s) => s.enabled).map((s) => s.id),
        agent,
        sessionId,
      };
      await stream.writeSSE({ event: "meta", data: JSON.stringify(meta) });

      await streamTurn({
        sessionId,
        userText: body.userText ?? "",
        attachments: body.attachments,
        cueInstruction,
        onText: (delta) => {
          void stream.writeSSE({ event: "delta", data: JSON.stringify({ text: delta }) });
        },
      });
    } catch (err) {
      console.error("[chat] turn error:", err);
      void reportError(err, { source: "POST /api/chat (agent turn)", details: { profile: body.profileId } });
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: (err as Error).message }),
      });
    }
    await stream.writeSSE({ event: "done", data: "{}" });
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

// ---- Create skill: invoke the skill-creator flow over a workflow set. ----
// Streamed + interactive: first stream a conversational narration of what's
// being captured, then emit the structured SKILL.md as a `skill` event.
app.post("/api/skills/create", async (c) => {
  const body = await c.req.json<CreateSkillRequest>();
  const user = buildSkillCreatorUser({
    workflowSet: body.workflowSet,
    conversations: body.conversations ?? [],
  });

  return streamSSE(c, async (stream) => {
    try {
      // Phase 1: stream the skill-creator's narration as a chat turn.
      await streamChat({
        system: buildSkillNarrationSystem(),
        messages: [{ role: "user", content: user }],
        model: ENV.MODEL_MAIN,
        maxTokens: 700,
        handlers: {
          onText: (delta) => {
            void stream.writeSSE({ event: "delta", data: JSON.stringify({ text: delta }) });
          },
        },
      });

      // Phase 2: produce the structured SKILL.md (schema-constrained).
      const result = await jsonCall<{
        name: string;
        description: string;
        instructions: string;
      }>({
        system: buildSkillCreatorSystem(),
        user,
        schema: SKILL_SCHEMA as unknown as Record<string, unknown>,
        model: ENV.MODEL_MAIN,
        maxTokens: 2000,
      });

      // Phase 3: register the SKILL.md with the official Skills API so the
      // agent can load it natively.
      const registered = await registerSkill({
        name: result.name,
        description: result.description,
        instructions: result.instructions,
      });

      const skill: Skill = {
        id: id("skill"),
        name: result.name,
        description: result.description,
        instructions: result.instructions,
        source: "user",
        fromWorkflowSetId: body.workflowSet.id,
        enabled: true,
        createdAt: new Date().toISOString(),
        skillId: registered.skillId,
        skillVersion: registered.skillVersion,
      };
      await stream.writeSSE({ event: "skill", data: JSON.stringify({ skill } satisfies CreateSkillResponse) });
    } catch (err) {
      console.error("[skills/create] error:", err);
      void reportError(err, { source: "POST /api/skills/create" });
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: (err as Error).message }),
      });
    }
    await stream.writeSSE({ event: "done", data: "{}" });
  });
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
