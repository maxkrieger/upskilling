import { useState } from "react";
import { useStore } from "../store.ts";

export function CustomizeView() {
  const skills = useStore((s) => s.skills);
  const toggleSkill = useStore((s) => s.toggleSkill);
  const deleteSkill = useStore((s) => s.deleteSkill);
  const addManualSkill = useStore((s) => s.addManualSkill);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const create = () => {
    if (!name.trim() || !description.trim()) return;
    addManualSkill(name.trim(), description.trim(), instructions.trim());
    setName("");
    setDescription("");
    setInstructions("");
    setOpen(false);
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-ink">Customize · Skills</h1>
            <p className="mt-1 text-sm text-muted">
              Skills capture your repeated workflows so a short request reproduces your
              preferences. They’re stored in this browser.
            </p>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-canvas hover:bg-accentSoft"
          >
            {open ? "Cancel" : "+ New skill"}
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Skill name"
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (when should this skill trigger?)"
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions (the SKILL.md body)"
              rows={5}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              onClick={create}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-canvas hover:bg-accentSoft"
            >
              Create skill
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {skills.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{s.name}</span>
                    {s.source === "builtin" && (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-faint">
                        built-in
                      </span>
                    )}
                    {s.fromWorkflowSetId && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                        from your workflow
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={() => toggleSkill(s.id)}
                    />
                    {s.enabled ? "On" : "Off"}
                  </label>
                  {s.source !== "builtin" && (
                    <button
                      onClick={() => deleteSkill(s.id)}
                      className="text-xs text-faint hover:text-accent"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {s.instructions && (
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="mt-2 text-xs text-faint hover:text-muted"
                >
                  {expanded === s.id ? "Hide" : "View"} instructions
                </button>
              )}
              {expanded === s.id && (
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-elevated p-3 text-xs text-muted">
                  {s.instructions}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
