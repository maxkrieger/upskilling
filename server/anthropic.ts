import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env.ts";

export const anthropic = new Anthropic({
  apiKey: ENV.ANTHROPIC_API_KEY,
  // The demo org has a low concurrent-connection limit; retry 429s patiently.
  maxRetries: 6,
});

export interface JsonCallOptions {
  system: string;
  user: string;
  /** JSON Schema for the structured result (an `object` schema). */
  schema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
}

/**
 * Make a single-shot call that is forced to return JSON matching `schema`,
 * using a tool with `tool_choice`. Returns the parsed tool input.
 */
export async function jsonCall<T>(opts: JsonCallOptions): Promise<T> {
  const res = await anthropic.messages.create({
    model: opts.model ?? ENV.MODEL_BACKGROUND,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    tools: [
      {
        name: "respond",
        description: "Return the structured response.",
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "respond" },
    messages: [{ role: "user", content: opts.user }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return a tool_use block");
  }
  return block.input as T;
}

export type StreamHandlers = {
  onText: (delta: string) => void;
  /**
   * Handle a CLIENT tool the model called (e.g. create_skill). Return the string
   * to feed back as the tool_result; the loop then continues so the model can
   * confirm. Server tools (code_execution) run inside Anthropic and never reach
   * this. Omit to disable tool handling (single turn).
   */
  onToolUse?: (name: string, input: any, id: string) => Promise<string>;
  /** Called when the model loads a mounted skill (reads /skills/<slug>/…), with
   * the content offset where it fired so the UI can splice an indicator inline. */
  onSkillFired?: (slug: string, at: number) => void;
};

/**
 * Stream a chat completion, calling `onText` for each text delta. Returns the
 * full accumulated text.
 *
 * When `container` is passed (skills), the request goes through the beta
 * Messages API with the code-execution + skills betas, so Claude loads the
 * referenced Skills natively. Otherwise it's a plain streamed completion.
 *
 * If `handlers.onToolUse` is set, runs a small agentic loop: when the model
 * pauses on a client tool, the handler executes it, the result is fed back as a
 * tool_result, and streaming resumes until the model finishes.
 */
export async function streamChat(params: {
  system: string;
  /** May include a mid-conversation `{role:"system"}` turn (beta). */
  messages: any[];
  model?: string;
  maxTokens?: number;
  /** `{ skills: [{ type, skill_id, version }] }` to attach Skills. */
  container?: unknown;
  tools?: unknown;
  betas?: string[];
  handlers: StreamHandlers;
}): Promise<string> {
  let full = "";
  const messages = [...params.messages];
  const useBeta = !!params.container || (params.betas?.length ?? 0) > 0;
  // First turn mounts the skills; later turns reuse the warm container by id so
  // skills aren't cold-remounted (and workspace state survives) each round-trip.
  let container = params.container;

  // Bounded loop so a client tool_use can be handled and the model can resume.
  for (let turn = 0; turn < 5; turn++) {
    const turnStartLen = full.length; // content offset at the start of this turn
    const base: Record<string, unknown> = {
      model: params.model ?? ENV.MODEL_MAIN,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages,
    };
    const stream = useBeta
      ? (anthropic.beta.messages.stream as any)({
          ...base,
          ...(container ? { container } : {}),
          ...(params.tools ? { tools: params.tools } : {}),
          betas: params.betas,
        })
      : anthropic.messages.stream(base as any);

    stream.on("text", (delta: string) => {
      full += delta;
      params.handlers.onText(delta);
    });

    const finalMsg: any = await stream.finalMessage();
    // Reuse the same (warm) container on continuation turns via its id.
    if (finalMsg.container?.id) container = { id: finalMsg.container.id };

    // Detect skill firings: the model reads `/skills/<slug>/…` when it loads a
    // mounted skill. Report each with the content offset (text before the read
    // block) so the UI can splice a "using skill" indicator at that exact gap.
    if (params.handlers.onSkillFired) {
      let textLen = 0;
      for (const b of finalMsg.content ?? []) {
        if (b.type === "text") {
          textLen += (b.text ?? "").length;
          continue;
        }
        const slug = JSON.stringify(b).match(/\/skills\/([^/"\\]+)\//)?.[1];
        if (slug) params.handlers.onSkillFired(slug, turnStartLen + textLen);
      }
    }

    const clientToolUses = (finalMsg.content ?? []).filter(
      (b: any) => b.type === "tool_use",
    );
    if (
      finalMsg.stop_reason !== "tool_use" ||
      clientToolUses.length === 0 ||
      !params.handlers.onToolUse
    ) {
      break; // nothing for us to handle — done
    }

    // Execute each client tool and feed results back as the next user turn.
    messages.push({ role: "assistant", content: finalMsg.content });
    const results: any[] = [];
    for (const tu of clientToolUses) {
      let content: string;
      try {
        content = await params.handlers.onToolUse(tu.name, tu.input, tu.id);
      } catch (e) {
        content = `Error: ${(e as Error).message}`;
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content });
    }
    messages.push({ role: "user", content: results });

    // The model's post-tool confirmation streams into the same message as its
    // pre-tool text — separate them with a paragraph break so they don't glue
    // together ("…apply automatically.Saved!").
    if (full && !full.endsWith("\n")) {
      full += "\n\n";
      params.handlers.onText("\n\n");
    }
  }

  return full;
}
