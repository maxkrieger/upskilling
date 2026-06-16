import { useMemo } from "react";
import { Bug } from "lucide-react";
import { useStore } from "../store.ts";
import { getProfile } from "../data/index.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog.tsx";

const cueStatusStyle: Record<string, string> = {
  none: "bg-elevated text-faint",
  cued: "bg-accent/20 text-accent",
  accepted: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-border text-faint",
};

/**
 * A behind-the-scenes view of the workflow index — the extracted summaries the
 * cueing decider checks each turn. Helps a demo viewer see how the system
 * decides when to suggest a Skill.
 */
export function DebugPanel() {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const indexOverrides = useStore((s) => s.indexOverrides);
  const skills = useStore((s) => s.skillsByProfile[s.activeProfileId] ?? s.skillsOf());

  const index = useMemo(
    () => useStore.getState().index(activeProfileId),
    [activeProfileId, indexOverrides],
  );
  const profileName = getProfile(activeProfileId)?.name ?? activeProfileId;
  const skillName = (id?: string) => skills.find((s) => s.id === id)?.name;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-faint hover:border-accent/50 hover:text-accent">
          <Bug size={14} />
          Debug · Workflow index
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow index — {profileName}</DialogTitle>
          <DialogDescription>
            These are the workflow summaries the system extracts from each conversation. The
            cueing decider checks a new message against them: a cluster with ≥2 members is
            “overdue,” so a matching request triggers a Skill suggestion (unless already
            accepted, rejected, or snoozed).
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
          {index.length === 0 ? (
            <div className="text-sm text-faint">No workflows extracted yet.</div>
          ) : (
            <div className="space-y-4">
              {index.map((set) => {
                const overdue = set.members.length >= 2;
                return (
                  <div key={set.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-ink">{set.cluster}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${cueStatusStyle[set.cueStatus] ?? "bg-elevated text-faint"}`}
                      >
                        {set.cueStatus}
                      </span>
                      {overdue && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                          overdue ({set.members.length})
                        </span>
                      )}
                      {set.skillId && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                          skill: {skillName(set.skillId) ?? "created"}
                        </span>
                      )}
                    </div>

                    <ul className="mt-3 space-y-3">
                      {set.members.map((m, i) => (
                        <li key={i} className="border-l-2 border-border pl-3">
                          <p className="text-sm text-muted">{m.summary}</p>
                          {m.quotes.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {m.quotes.map((q, qi) => (
                                <span
                                  key={qi}
                                  className="rounded bg-elevated px-1.5 py-0.5 text-xs text-faint"
                                >
                                  “{q}”
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 font-mono text-[11px] text-faint/70">
                            {m.conversationId}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
