import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import type { SkillCueBanner } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

/** Inline call-to-action banner cueing the user to capture a Skill. */
export function SkillBanner({
  banner,
  conversationId,
  messageId,
}: {
  banner: SkillCueBanner;
  conversationId: string;
  messageId: string;
}) {
  const acceptCue = useStore((s) => s.acceptCue);
  const dismissCue = useStore((s) => s.dismissCue);
  const snoozeCue = useStore((s) => s.snoozeCue);
  const setView = useStore((s) => s.setView);
  const skills = useStore((s) => s.skills);
  const [busy, setBusy] = useState(false);

  // The real name is only known after the skill is created (post-consent).
  const createdName =
    skills.find((s) => s.fromWorkflowSetId === banner.workflowSetId)?.name ??
    banner.suggestedName;

  if (banner.status === "snoozed") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface/60 px-4 py-2 text-xs text-faint">
        Skill suggestions snoozed for an hour.
      </div>
    );
  }

  if (banner.status === "dismissed") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface/60 px-4 py-2 text-xs text-faint">
        Skill suggestion dismissed. You won’t be asked about this workflow again.
      </div>
    );
  }

  // Once the user commits, the banner collapses to a compact line — the
  // skill-creator itself streams as a turn in the conversation below.
  if (busy && banner.status !== "accepted") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-faint">
        <ThinkingGlyph className="text-accent" />
        Creating Skill…
      </div>
    );
  }

  if (banner.status === "accepted") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-faint">
        <CheckCircle2 size={14} className="text-accent" />
        Skill created.
        <button
          onClick={() => setView("customize")}
          className="text-faint underline underline-offset-2 hover:text-accent"
        >
          View in Customize
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
      <button
        onClick={() => snoozeCue(conversationId, messageId)}
        title="Snooze skill suggestions"
        aria-label="Snooze skill suggestions"
        className="absolute right-2 top-2 rounded-md p-1 text-faint hover:bg-elevated hover:text-ink"
      >
        <X size={15} />
      </button>
      <div className="flex items-start gap-3">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1 pr-5">
          <div className="text-sm font-semibold text-ink">
            Save this workflow as a Skill
          </div>
          <p className="mt-1 text-sm text-muted">
            Capture these steps once so a short request reproduces them next time.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await acceptCue(conversationId, messageId);
                setBusy(false);
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-canvas hover:bg-accentSoft disabled:opacity-60"
            >
              {busy ? "Creating skill…" : "Create Skill"}
            </button>
            <button
              disabled={busy}
              onClick={() => dismissCue(conversationId, messageId)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-elevated"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
