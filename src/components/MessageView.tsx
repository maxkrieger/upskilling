import { Asterisk, FileText, Image as ImageIcon, Wand2 } from "lucide-react";
import type { Message } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { Markdown } from "./Markdown.tsx";
import { SkillBanner } from "./SkillBanner.tsx";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

function AttachmentChips({ message }: { message: Message }) {
  const openAttachment = useStore((s) => s.openAttachment);
  if (!message.attachments?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {message.attachments.map((a) => (
        <button
          key={a.id}
          onClick={() => openAttachment(a)}
          title={`View ${a.name}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2 py-1 text-xs text-muted hover:border-accent/50 hover:text-ink"
        >
          {a.kind === "image" ? <ImageIcon size={13} /> : <FileText size={13} />}
          {a.name}
        </button>
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
  const skills = useStore((s) => s.skillsByProfile[s.activeProfileId] ?? s.skillsOf());
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
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-canvas">
        <Asterisk size={16} />
      </div>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <Markdown content={message.content} />
        ) : streaming ? (
          <div className="flex items-center gap-2 text-muted">
            <ThinkingGlyph className="text-lg text-accent" />
            <span>Working…</span>
          </div>
        ) : null}
        {streaming && message.content && (
          <ThinkingGlyph className="ml-1 align-middle text-accent" />
        )}

        {message.banner && (
          <SkillBanner
            banner={message.banner}
            conversationId={conversationId}
            messageId={message.id}
          />
        )}

        {applied.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-faint">
            <Wand2 size={12} />
            Applied skill{applied.length > 1 ? "s" : ""}:{" "}
            {applied.map((s) => s!.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
