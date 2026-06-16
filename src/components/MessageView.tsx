import type { Message } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { Markdown } from "./Markdown.tsx";
import { SkillBanner } from "./SkillBanner.tsx";

function AttachmentChips({ message }: { message: Message }) {
  if (!message.attachments?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {message.attachments.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2 py-1 text-xs text-muted"
        >
          {a.kind === "image" ? "🖼️" : "📄"} {a.name}
        </span>
      ))}
    </div>
  );
}

export function MessageView({
  message,
  conversationId,
  streaming,
}: {
  message: Message;
  conversationId: string;
  streaming?: boolean;
}) {
  const skills = useStore((s) => s.skills);
  const isUser = message.role === "user";
  const applied = (message.appliedSkillIds ?? [])
    .map((id) => skills.find((s) => s.id === id))
    .filter(Boolean);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-elevated px-4 py-3 text-ink">
          <AttachmentChips message={message} />
          <div className="prose-chat whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm">
        ✳
      </div>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <Markdown content={message.content} />
        ) : streaming ? (
          <div className="text-muted">
            Thinking<span className="caret">▌</span>
          </div>
        ) : null}
        {streaming && message.content && <span className="caret text-muted">▌</span>}

        {message.banner && (
          <SkillBanner
            banner={message.banner}
            conversationId={conversationId}
            messageId={message.id}
          />
        )}

        {applied.length > 0 && (
          <div className="mt-2 text-xs text-faint">
            ⚙ Applied skill{applied.length > 1 ? "s" : ""}:{" "}
            {applied.map((s) => s!.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
