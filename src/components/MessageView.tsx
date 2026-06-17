import { BookOpen, FileText, Image as ImageIcon } from "lucide-react";
import type { Message } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { Markdown } from "./Markdown.tsx";
import { SkillBanner } from "./SkillBanner.tsx";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

function AttachmentChips({ message }: { message: Message }) {
  const openAttachment = useStore((s) => s.openAttachment);
  if (!message.attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      {message.attachments.map((a) => (
        <button
          key={a.id}
          onClick={() => openAttachment(a)}
          title={`View ${a.name}`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted shadow-sm hover:border-accent/50 hover:text-ink"
        >
          {a.kind === "image" ? <ImageIcon size={14} /> : <FileText size={14} />}
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
      <div className="flex flex-col items-end">
        {message.content && (
          <div className="max-w-[80%] rounded-2xl bg-elevated px-4 py-3 text-ink">
            <div className="prose-chat whitespace-pre-wrap">{message.content}</div>
          </div>
        )}
        <AttachmentChips message={message} />
      </div>
    );
  }

  // An accepted result card is spliced inline at the tool-use point; a pending
  // cue CTA sits below the deliverable.
  const showBanner = message.banner && !streaming;
  const isCard = showBanner && message.banner!.status === "accepted";
  const splitAt = isCard ? Math.min(message.cardSplitAt ?? 0, message.content.length) : 0;
  const card = (
    <SkillBanner banner={message.banner!} conversationId={conversationId} messageId={message.id} />
  );

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        {isCard ? (
          <>
            {message.content.slice(0, splitAt).trim() && (
              <Markdown content={message.content.slice(0, splitAt)} />
            )}
            {card}
            {message.content.slice(splitAt).trim() && (
              <Markdown content={message.content.slice(splitAt)} />
            )}
          </>
        ) : (
          <>
            {message.content ? (
              <Markdown content={message.content} />
            ) : streaming ? (
              <div className="flex items-center gap-2 text-muted">
                <ThinkingGlyph className="text-lg text-accent" />
                <span>Working…</span>
              </div>
            ) : null}
            {streaming && message.content && (
              <ThinkingGlyph fixedWidth={false} className="align-middle text-accent" />
            )}
            {showBanner && card}
          </>
        )}

        {applied.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-faint">
            <BookOpen size={12} />
            Applied skill{applied.length > 1 ? "s" : ""}:{" "}
            {applied.map((s) => s!.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
