import { useMemo, useState } from "react";
import {
  ChevronDown,
  Code2,
  Eye,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Skill } from "../../shared/types.ts";
import { useStore } from "../store.ts";
import { Markdown } from "./Markdown.tsx";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`}
      />
    </button>
  );
}

function addedBy(s: Skill): string {
  if (s.source === "builtin") return "Anthropic";
  return s.fromWorkflowSetId ? "Your workflow" : "You";
}
function triggerOf(s: Skill): string {
  return s.id === "skill_creator_builtin" ? "Create-skill flow" : "Automatic";
}

export function CustomizeView() {
  const skills = useStore((s) => s.skillsByProfile[s.activeProfileId] ?? s.skillsOf());
  const toggleSkill = useStore((s) => s.toggleSkill);
  const deleteSkill = useStore((s) => s.deleteSkill);
  const addManualSkill = useStore((s) => s.addManualSkill);
  const setView = useStore((s) => s.setView);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [raw, setRaw] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  const filtered = useMemo(
    () => skills.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [skills, query],
  );
  const selected = skills.find((s) => s.id === selectedId) ?? filtered[0] ?? skills[0];

  const create = async () => {
    if (!name.trim() || !description.trim()) return;
    await addManualSkill(name.trim(), description.trim(), instructions.trim());
    setName("");
    setDescription("");
    setInstructions("");
    setCreating(false);
  };

  return (
    <div className="flex h-full">
      {/* ---- List pane (master): lighter, raised, shadows over the detail ---- */}
      <div className="relative z-10 flex w-72 shrink-0 flex-col bg-canvas shadow-[6px_0_24px_-8px_rgba(41,37,31,0.14)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-lg font-medium text-ink">Skills</h2>
          <div className="flex items-center gap-1 text-faint">
            <Search size={16} className="opacity-70" />
            <button
              onClick={() => {
                setCreating(true);
                setMenuOpen(false);
              }}
              title="New skill"
              className="rounded-md p-1 hover:bg-elevated hover:text-ink"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2 py-1.5">
            <Search size={14} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-faint">
            Personal skills
          </div>
          {filtered.map((s) => {
            const active = !creating && s.id === selected?.id;
            return (
              <div key={s.id}>
                <button
                  onClick={() => {
                    setSelectedId(s.id);
                    setCreating(false);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    active ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60 hover:text-ink"
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform ${active ? "rotate-180 text-faint" : "text-faint/0"}`}
                  />
                </button>
                {active && (
                  <div className="mb-1 ml-3 border-l border-border pl-3 text-xs text-faint">
                    <div className="rounded px-2 py-1">SKILL.md</div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-sm text-faint">No skills match.</div>
          )}
        </div>
      </div>

      {/* ---- Detail pane ---- */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {creating ? (
          <div className="mx-auto max-w-3xl px-8 py-8">
            <h1 className="font-serif text-2xl text-ink">New skill</h1>
            <p className="mt-1 text-sm text-muted">
              Hand-author a skill. It’s registered so Claude can load it when relevant.
            </p>
            <div className="mt-5 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skill name"
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description — what it does and when it should trigger"
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions (the SKILL.md body)"
                rows={10}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={create}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accentSoft"
                >
                  Create skill
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-elevated"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <div className="mx-auto max-w-3xl px-8 py-7">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-medium text-ink">{selected.name}</h1>
              <div className="flex items-center gap-2">
                <Switch on={selected.enabled} onClick={() => toggleSkill(selected.id)} />
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="rounded-md p-1.5 text-faint hover:bg-elevated hover:text-ink"
                    aria-label="Skill actions"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setView("chat");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-ink"
                        >
                          <MessageCircle size={15} /> Try in chat
                        </button>
                        {selected.source !== "builtin" && (
                          <button
                            onClick={() => {
                              const id = selected.id;
                              setMenuOpen(false);
                              setSelectedId(null);
                              deleteSkill(id);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent hover:bg-elevated"
                          >
                            <Trash2 size={15} /> Uninstall
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Meta grid */}
            <div className="mt-5 flex gap-12">
              <div>
                <div className="text-xs text-faint">Added by</div>
                <div className="mt-0.5 text-sm text-ink">{addedBy(selected)}</div>
              </div>
              <div>
                <div className="text-xs text-faint">Trigger</div>
                <div className="mt-0.5 text-sm text-ink">{triggerOf(selected)}</div>
              </div>
              <div>
                <div className="text-xs text-faint">Status</div>
                <div className="mt-0.5 text-sm text-ink">
                  {selected.enabled ? "Active" : "Off"}
                  {selected.fromWorkflowSetId && " · from your workflow"}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <div className="text-xs text-faint">Description</div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{selected.description}</p>
            </div>

            {/* SKILL.md body */}
            {selected.instructions && (
              <div className="mt-5 rounded-2xl border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-xs font-medium text-faint">SKILL.md</span>
                  <div className="flex items-center gap-0.5 rounded-lg bg-elevated p-0.5">
                    <button
                      onClick={() => setRaw(false)}
                      title="Rendered"
                      className={`rounded-md p-1 ${!raw ? "bg-surface text-ink" : "text-faint"}`}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => setRaw(true)}
                      title="Source"
                      className={`rounded-md p-1 ${raw ? "bg-surface text-ink" : "text-faint"}`}
                    >
                      <Code2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="px-5 py-4">
                  {raw ? (
                    <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">
                      {selected.instructions}
                    </pre>
                  ) : (
                    <Markdown content={selected.instructions} />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-faint">
            Select a skill
          </div>
        )}
      </div>
    </div>
  );
}
