import type Anthropic from "@anthropic-ai/sdk";
import type { Attachment, Conversation, Message } from "../shared/types.ts";

export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Render attachments as appended text content for a user turn. */
function attachmentsToText(attachments?: Attachment[]): string {
  if (!attachments?.length) return "";
  return (
    "\n\n" +
    attachments
      .map((a) => {
        if (a.kind === "image") {
          return `[Attached image: ${a.name}]`;
        }
        return `[Attached ${a.kind}: ${a.name}]\n\`\`\`\n${a.content}\n\`\`\``;
      })
      .join("\n\n")
  );
}

/** Convert our message history to Anthropic message params. */
export function toAnthropicMessages(
  messages: Array<Pick<Message, "role" | "content" | "attachments">>,
): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.content.trim() || m.attachments?.length)
    .map((m) => ({
      role: m.role,
      content: m.content + (m.role === "user" ? attachmentsToText(m.attachments) : ""),
    }));
}

/** Flatten a conversation into a readable transcript for extraction. */
export function conversationToText(
  conversation: Pick<Conversation, "messages">,
): string {
  return conversation.messages
    .map((m) => {
      const att = m.attachments?.length
        ? ` ${attachmentsToText(m.attachments)}`
        : "";
      return `${m.role.toUpperCase()}: ${m.content}${att}`;
    })
    .join("\n\n");
}

/** SSE event encoder. */
export function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
