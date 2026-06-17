import { useState } from "react";
import { BookOpen, Check, CheckCircle2 } from "lucide-react";
import type { SkillCueBanner } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { ThinkingGlyph } from "./ThinkingGlyph.tsx";

/** Inline call-to-action banner: cue to create a new Skill or update an existing one. */
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
  const acceptUpdate = useStore((s) => s.acceptUpdate);
  const dismissCue = useStore((s) => s.dismissCue);
  const setView = useStore((s) => s.setView);
  const skills = useStore((s) => s.skillsByProfile[s.activeProfileId] ?? s.skillsOf());
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const isUpdate = banner.kind === "update";
  // The skill that was created/updated (linked when the banner was accepted).
  const created = skills.find((s) => s.id === banner.createdSkillId);
  const createdName = created?.name ?? banner.suggestedName;

  if (banner.status === "snoozed") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface/60 px-4 py-2 text-xs text-faint">
        Skill suggestions snoozed for an hour.
      </div>
    );
  }

  // Dismissed: nothing remains — the "Not now" click shrinks the card away (below)
  // and then persists this status, so on any later render we render nothing.
  if (banner.status === "dismissed") return null;

  // Once committed, collapse to a compact line — the skill-creator streams below.
  if (busy && banner.status !== "accepted") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-faint">
        <ThinkingGlyph className="text-accent" />
        {isUpdate ? "Updating Skill…" : "Creating Skill…"}
      </div>
    );
  }

  if (banner.status === "accepted") {
    // Compact fallback if we couldn't link the created skill.
    if (!created) {
      return (
        <div className="mt-3 flex items-center gap-2 text-xs text-faint">
          <CheckCircle2 size={14} className="text-accent" />
          {isUpdate ? `Updated ${createdName}.` : "Skill created."}
          <button
            onClick={() => setView("customize")}
            className="text-faint underline underline-offset-2 hover:text-accent"
          >
            View in Customize
          </button>
        </div>
      );
    }
    const highlights = created.highlights ?? [];
    return (
      <div className="mt-3 animate-rise-in overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-peach text-accent">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{created.name}</div>
            <p className="mt-0.5 text-sm text-muted">{created.description}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-peach px-2 py-0.5 text-xs font-medium text-accent">
            <Check size={12} /> {isUpdate ? "Updated" : "Created"}
          </span>
        </div>
        {highlights.length > 0 && (
          <div className="space-y-2 px-4 pb-1">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-ink">
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={11} strokeWidth={3} />
                </span>
                {h}
              </div>
            ))}
          </div>
        )}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={() => setView("customize")}
            className="text-xs text-faint underline underline-offset-2 hover:text-accent"
          >
            View in Customize
          </button>
        </div>
      </div>
    );
  }

  const onAccept = async () => {
    setBusy(true);
    if (isUpdate) await acceptUpdate(conversationId, messageId);
    else await acceptCue(conversationId, messageId);
    setBusy(false);
  };

  return (
    <div
      onTransitionEnd={(e) => {
        if (dismissing && e.propertyName === "grid-template-rows")
          dismissCue(conversationId, messageId);
      }}
      className={`grid transition-all duration-300 ease-in ${
        dismissing ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-3 grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="overflow-hidden">
        <div className="animate-rise-in rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-peach text-accent">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">
                {isUpdate ? `Update your ${createdName} skill` : "Save this workflow as a Skill"}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {isUpdate
                  ? "Fold your new preference into this skill"
                  : "Reuse this workflow without repeating yourself"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                disabled={busy || dismissing}
                onClick={() => setDismissing(true)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-elevated disabled:opacity-60"
              >
                Not now
              </button>
              <button
                disabled={busy || dismissing}
                onClick={onAccept}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accentSoft disabled:opacity-60"
              >
                {isUpdate ? "Update Skill" : "Create Skill"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
