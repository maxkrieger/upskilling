import { useMemo } from "react";
import { PROFILES } from "../data/index.ts";
import { useStore } from "../store.ts";

export function Sidebar() {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const view = useStore((s) => s.view);
  const setProfile = useStore((s) => s.setProfile);
  const setView = useStore((s) => s.setView);
  const newConversation = useStore((s) => s.newConversation);
  const openConversation = useStore((s) => s.openConversation);
  // Derive the (sorted) conversation list from stable state slices, so we don't
  // pass a freshly-allocated array through a zustand selector (infinite loop).
  const userConversations = useStore((s) => s.userConversations);
  const conversations = useMemo(
    () => useStore.getState().conversations(activeProfileId),
    [activeProfileId, userConversations],
  );
  const skills = useStore((s) => s.skills);
  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      {/* Profile selector */}
      <div className="border-b border-border p-3">
        <label className="mb-1 block text-xs uppercase tracking-wide text-faint">
          Demo profile
        </label>
        <select
          value={activeProfileId}
          onChange={(e) => setProfile(e.target.value)}
          className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-3">
        <button
          onClick={() => newConversation()}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-canvas hover:bg-accentSoft"
        >
          + New chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
        <div className="px-1 py-1 text-xs uppercase tracking-wide text-faint">
          Recents
        </div>
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

      {/* Customize */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => setView("customize")}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
            view === "customize" ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60"
          }`}
        >
          <span>⚙ Customize · Skills</span>
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
            {enabledCount}
          </span>
        </button>
      </div>
    </aside>
  );
}
