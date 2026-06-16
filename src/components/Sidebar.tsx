import { useMemo, type ReactNode } from "react";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { PROFILES } from "../data/index.ts";
import { useStore } from "../store.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx";

function NavRow({
  icon,
  label,
  onClick,
  active,
  disabled,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
        active ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60 hover:text-ink"
      } ${disabled ? "cursor-default opacity-40 hover:bg-transparent hover:text-muted" : ""}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

export function Sidebar() {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const view = useStore((s) => s.view);
  const setProfile = useStore((s) => s.setProfile);
  const setView = useStore((s) => s.setView);
  const newConversation = useStore((s) => s.newConversation);
  const openConversation = useStore((s) => s.openConversation);
  const clearAllData = useStore((s) => s.clearAllData);
  const userConversations = useStore((s) => s.userConversations);
  const conversations = useMemo(
    () => useStore.getState().conversations(activeProfileId),
    [activeProfileId, userConversations],
  );
  const skills = useStore((s) => s.skills);
  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      {/* Profile selector (shadcn, non-native) */}
      <div className="border-b border-border p-3">
        <label className="mb-1 block text-xs uppercase tracking-wide text-faint">
          Demo profile
        </label>
        <Select value={activeProfileId} onValueChange={setProfile}>
          <SelectTrigger aria-label="Select demo profile">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top nav — Customize lives here, following Claude's sidebar design */}
      <nav className="space-y-0.5 p-2">
        <NavRow icon={<Plus size={18} />} label="New chat" onClick={() => newConversation()} />
        <NavRow
          icon={<SlidersHorizontal size={18} />}
          label="Customize"
          onClick={() => setView("customize")}
          active={view === "customize"}
          trailing={
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
              {enabledCount}
            </span>
          }
        />
      </nav>

      {/* Conversation list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
        <div className="px-3 py-1 text-xs uppercase tracking-wide text-faint">Recents</div>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => openConversation(c.id)}
            className={`mb-0.5 w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
              view === "chat" && c.id === activeConversationId
                ? "bg-elevated text-ink"
                : "text-muted hover:bg-elevated/60"
            }`}
            title={c.title}
          >
            {c.userCreated ? "" : "· "}
            {c.title}
          </button>
        ))}
      </div>

      {/* Bottom: clear stored data */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => {
            if (
              confirm(
                "Clear all stored data? This removes all skills, conversations, and the workflow index from this browser and signs you out.",
              )
            ) {
              clearAllData();
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-faint hover:border-accent/50 hover:text-accent"
        >
          <Trash2 size={14} />
          Clear all stored data
        </button>
      </div>
    </aside>
  );
}
