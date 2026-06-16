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
    model: opts.model ?? ENV.MODEL_FAST,
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
};

/**
 * Stream a chat completion, calling `onText` for each text delta. Returns the
 * full accumulated text.
 *
 * When `container` is passed (skills), the request goes through the beta
 * Messages API with the code-execution + skills betas, so Claude loads the
 * referenced Skills natively. Otherwise it's a plain streamed completion.
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
  const base: Record<string, unknown> = {
    model: params.model ?? ENV.MODEL_MAIN,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
  };

  const useBeta = !!params.container || (params.betas?.length ?? 0) > 0;
  const stream = useBeta
    ? (anthropic.beta.messages.stream as any)({
        ...base,
        ...(params.container ? { container: params.container } : {}),
        ...(params.tools ? { tools: params.tools } : {}),
        betas: params.betas,
      })
    : anthropic.messages.stream(base as any);

  stream.on("text", (delta: string) => {
    full += delta;
    params.handlers.onText(delta);
  });

  await stream.finalMessage();
  return full;
}
