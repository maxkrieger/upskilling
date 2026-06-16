import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env.ts";

export const anthropic = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

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
 */
export async function streamChat(params: {
  system: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  handlers: StreamHandlers;
}): Promise<string> {
  let full = "";
  const stream = anthropic.messages.stream({
    model: params.model ?? ENV.MODEL_MAIN,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
  });

  stream.on("text", (delta) => {
    full += delta;
    params.handlers.onText(delta);
  });

  await stream.finalMessage();
  return full;
}
