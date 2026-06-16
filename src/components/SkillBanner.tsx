import { useState } from "react";
import type { SkillCueBanner } from "../../shared/types.ts";
import { useStore } from "../store.ts";

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
  const setView = useStore((s) => s.setView);
  const [busy, setBusy] = useState(false);

  if (banner.status === "dismissed") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface/60 px-4 py-2 text-xs text-faint">
        Skill suggestion dismissed. You won’t be asked about this workflow again.
      </div>
    );
  }

  if (banner.status === "accepted") {
    return (
      <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
        <div className="text-sm text-ink">
          ✅ Created the <span className="font-semibold">{banner.suggestedName}</span> skill.
          It’s now active.
        </div>
        <button
          onClick={() => setView("customize")}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-elevated"
        >
          View in Customize
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-lg">✨</div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">
            Turn this into a Skill: {banner.suggestedName}
          </div>
          <p className="mt-1 text-sm text-muted">{banner.rationale}</p>
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
