import { useRef, useState } from "react";
import type { Attachment, AttachmentKind, PresetPrompt } from "../../shared/types.ts";
import { getProfile } from "../data/index.ts";
import { useStore } from "../store.ts";

function kindFromName(name: string): AttachmentKind {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext ?? "")) return "image";
  if (ext === "pdf") return "pdf";
  return "text";
}

export function Composer({ showPresets }: { showPresets: boolean }) {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const sending = useStore((s) => s.sending);
  const sendMessage = useStore((s) => s.sendMessage);
  const profile = getProfile(activeProfileId)!;

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (overrideText?: string, overrideAtt?: Attachment[]) => {
    const t = (overrideText ?? text).trim();
    const att = overrideAtt ?? attachments;
    if (!t || sending) return;
    setText("");
    setAttachments([]);
    await sendMessage(t, att.length ? att : undefined);
  };

  const runPreset = async (p: PresetPrompt) => {
    const refs = (p.attachmentRefs ?? [])
      .map((name) => profile.attachments.find((a) => a.name === name))
      .filter(Boolean) as Attachment[];
    await submit(p.prompt, refs);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      const kind = kindFromName(f.name);
      const content =
        kind === "image"
          ? await readAsDataURL(f)
          : await f.text();
      next.push({ id: Math.random().toString(36).slice(2), name: f.name, kind, content });
    }
    setAttachments((a) => [...a, ...next]);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      {showPresets && (
        <div className="mb-3 flex flex-wrap gap-2">
          {profile.presets.map((p) => (
            <button
              key={p.id}
              onClick={() => runPreset(p)}
              disabled={sending}
              className="group rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-accent/50 hover:bg-elevated disabled:opacity-60"
            >
              <div className="text-sm font-medium text-ink">{p.title}</div>
              {p.subtitle && (
                <div className="text-xs text-faint">{p.subtitle}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2 py-1 text-xs text-muted"
            >
              {a.kind === "image" ? "🖼️" : "📄"} {a.name}
              <button
                className="ml-1 text-faint hover:text-ink"
                onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg px-2 py-2 text-muted hover:bg-elevated"
          title="Attach a file"
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder={`Message ${profile.name}…`}
          className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-ink outline-none placeholder:text-faint"
        />
        <button
          onClick={() => submit()}
          disabled={sending || !text.trim()}
          className="rounded-lg bg-accent px-3 py-2 font-medium text-canvas hover:bg-accentSoft disabled:opacity-40"
        >
          {sending ? "…" : "↑"}
        </button>
      </div>
      <div className="mt-2 text-center text-xs text-faint">
        Demo prototype · Skills surfaced in context · {profile.name}
      </div>
    </div>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
