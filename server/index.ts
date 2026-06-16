import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { ENV } from "./env.ts";
import { jsonCall, streamChat } from "./anthropic.ts";
import { decideCue } from "./cue.ts";
import {
  buildChatSystem,
  buildExtractUser,
  buildSkillCreatorSystem,
  buildSkillCreatorUser,
  EXTRACT_SCHEMA,
  SKILL_SCHEMA,
} from "./prompts.ts";
import { conversationToText, id, toAnthropicMessages } from "./util.ts";
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

app.get("/api/health", (c) =>
  c.json({ ok: true, model: ENV.MODEL_MAIN, hasKey: !!ENV.ANTHROPIC_API_KEY }),
);

// ---- Auth: simple shared-password check for the demo gate. ----
app.post("/api/auth", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  const ok = !!ENV.WEBSITE_DEMO_PASSWORD && password === ENV.WEBSITE_DEMO_PASSWORD;
  return c.json({ ok });
});

// ---- Chat: cueing decider + streamed response. ----
app.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

  // Run the cueing decider before the response model sees the message.
  let cueInstruction: string | undefined;
  const meta: ChatMeta = { appliedSkillIds: [] };
  if (lastUser) {
    try {
      const decision = await decideCue({
        userMessage: lastUser.content,
        workflowIndex: body.workflowIndex ?? [],
        skills: body.skills ?? [],
      });
      if (decision.shouldCue && decision.workflowSetId) {
        cueInstruction = decision.modelInstruction;
        meta.banner = {
          workflowSetId: decision.workflowSetId,
          suggestedName: decision.suggestedName ?? "New Skill",
          rationale: decision.rationale ?? "",
          status: "pending",
        };
      }
    } catch (err) {
      console.error("[cue] failed:", err);
    }
  }

  meta.appliedSkillIds = (body.skills ?? []).filter((s) => s.enabled).map((s) => s.id);

  const system = buildChatSystem({
    profileName: body.profileName ?? body.profileId,
    profileRole: body.profileRole ?? "",
    skills: body.skills ?? [],
    cueInstruction,
  });

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "meta", data: JSON.stringify(meta) });
    try {
      await streamChat({
        system,
        messages: toAnthropicMessages(body.messages),
        handlers: {
          onText: (delta) => {
            void stream.writeSSE({ event: "delta", data: JSON.stringify({ text: delta }) });
          },
        },
      });
    } catch (err) {
      console.error("[chat] stream error:", err);
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
app.post("/api/skills/create", async (c) => {
  const body = await c.req.json<CreateSkillRequest>();
  const result = await jsonCall<{
    name: string;
    description: string;
    instructions: string;
  }>({
    system: buildSkillCreatorSystem(),
    user: buildSkillCreatorUser({
      workflowSet: body.workflowSet,
      conversations: body.conversations ?? [],
    }),
    schema: SKILL_SCHEMA as unknown as Record<string, unknown>,
    model: ENV.MODEL_MAIN,
    maxTokens: 2000,
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
  };
  const resp: CreateSkillResponse = { skill };
  return c.json(resp);
});

serve({ fetch: app.fetch, port: ENV.API_PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (model: ${ENV.MODEL_MAIN})`);
});

export default app;
