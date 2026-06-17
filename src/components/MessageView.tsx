import type { ReactNode } from "react";
import { BookOpen, FileText, Image as ImageIcon } from "lucide-react";
import type { Message } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { Markdown } from "./Markdown.tsx";
import { SkillBanner } from "./SkillBanner.tsx";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

/** Inline indicator spliced where a skill fired mid-reply. */
function UsingChip({ name }: { name: string }) {
  return (
    <div className="my-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-muted">
        <BookOpen size={12} className="text-accent" /> Using <span className="font-medium text-ink">{name}</span>
      </span>
    </div>
  );
}

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
  const isUser = message.role === "user";

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

  const showBanner = !!message.banner && !streaming;
  const isCard = showBanner && message.banner!.status === "accepted";
  const card = showBanner ? (
    <SkillBanner banner={message.banner!} conversationId={conversationId} messageId={message.id} />
  ) : null;

  // After the reply finishes, splice inline elements at the content offsets where
  // they belong: a "using skill" chip wherever a skill fired, and the
  // created/updated result card at the tool-use point.
  const inserts: Array<{ at: number; node: ReactNode }> = [];
  // "Using <skill>" chips splice in during streaming too, as soon as the firing
  // event arrives — so the chip shows at its gap live, not only once the reply ends.
  for (const u of message.skillUses ?? []) {
    inserts.push({ at: Math.min(u.at, message.content.length), node: <UsingChip name={u.name} /> });
  }
  // The created/updated result card only belongs once the reply (and its banner)
  // has settled, so keep it out of the streaming pass.
  if (!streaming && isCard) {
    inserts.push({ at: Math.min(message.cardSplitAt ?? 0, message.content.length), node: card });
  }
  inserts.sort((a, b) => a.at - b.at);

  const body: ReactNode[] = [];
  if (inserts.length) {
    let cursor = 0;
    inserts.forEach((ins, i) => {
      const seg = message.content.slice(cursor, ins.at);
      if (seg.trim()) body.push(<Markdown key={`s${i}`} content={seg} />);
      body.push(<div key={`i${i}`}>{ins.node}</div>);
      cursor = ins.at;
    });
    const tail = message.content.slice(cursor);
    if (tail.trim()) body.push(<Markdown key="tail" content={tail} />);
  } else if (message.content) {
    body.push(<Markdown key="c" content={message.content} />);
  } else if (streaming) {
    body.push(
      <div key="w" className="flex items-center gap-2 text-muted">
        <ThinkingGlyph className="text-lg text-accent" />
        <span>Working…</span>
      </div>,
    );
  }

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        {body}
        {streaming && message.content && (
          <ThinkingGlyph fixedWidth={false} className="align-middle text-accent" />
        )}
        {showBanner && !isCard && card}
      </div>
    </div>
  );
}
