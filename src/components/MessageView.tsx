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

  // The streaming cursor trails the END of the live text. It's hosted INLINE on
  // the last text segment (see Markdown `cursor`) so it stays at the end of the
  // line — including across a spliced "using skill" chip — instead of dropping
  // to its own line or vanishing below the chip until streaming finishes.
  const cursor = streaming ? (
    <ThinkingGlyph fixedWidth={false} className="align-middle text-accent" />
  ) : null;

  // Ordered parts: text segments split by inline inserts (skill chips, result card).
  type Part =
    | { kind: "text"; text: string; key: string }
    | { kind: "node"; node: ReactNode; key: string };
  const parts: Part[] = [];
  if (inserts.length) {
    let pos = 0;
    inserts.forEach((ins, i) => {
      const seg = message.content.slice(pos, ins.at);
      if (seg.trim()) parts.push({ kind: "text", text: seg, key: `s${i}` });
      parts.push({ kind: "node", node: ins.node, key: `i${i}` });
      pos = ins.at;
    });
    const tail = message.content.slice(pos);
    if (tail.trim()) parts.push({ kind: "text", text: tail, key: "tail" });
  } else if (message.content) {
    parts.push({ kind: "text", text: message.content, key: "c" });
  }
  // Host the cursor on the last TEXT part (not a trailing chip), so it keeps
  // trailing the most recent text even before the post-chip text arrives.
  let lastTextIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].kind === "text") {
      lastTextIdx = i;
      break;
    }
  }

  const body: ReactNode[] =
    parts.length > 0
      ? parts.map((p, i) =>
          p.kind === "text" ? (
            <Markdown key={p.key} content={p.text} cursor={i === lastTextIdx ? cursor : undefined} />
          ) : (
            <div key={p.key}>{p.node}</div>
          ),
        )
      : streaming
        ? [
            <div key="w" className="flex items-center gap-2 text-muted">
              <ThinkingGlyph className="text-lg text-accent" />
              <span>Working…</span>
            </div>,
          ]
        : [];

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        {body}
        {showBanner && !isCard && card}
      </div>
    </div>
  );
}
