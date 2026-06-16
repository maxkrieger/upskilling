import { useEffect, useMemo, useRef } from "react";
import { getProfile } from "../data/index.ts";
import { useStore } from "../store.ts";
import { Composer } from "./Composer.tsx";
import { MessageView } from "./MessageView.tsx";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** An 8-spoke starburst, echoing Claude's sparkle mark. */
function SparkBurst({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
      </g>
    </svg>
  );
}

export function ChatView() {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const sending = useStore((s) => s.sending);
  // Subscribe to the conversation store (stable ref) and derive the active
  // conversation with useMemo, rather than via a fresh-array selector.
  const userConversations = useStore((s) => s.userConversations);
  const convo = useMemo(
    () => useStore.getState().activeConversation(),
    [activeConversationId, activeProfileId, userConversations],
  );
  const profile = getProfile(activeProfileId)!;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [convo?.messages, sending]);

  const isEmpty = !convo || convo.messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 text-center">
            <div className="flex items-center gap-3">
              <SparkBurst className="h-9 w-9 text-accent" />
              <h1 className="font-serif text-4xl text-ink">{greeting()}</h1>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted">{profile.blurb}</p>
            <p className="mt-6 text-xs text-faint">
              Try a starter below — repeating a familiar workflow will surface a Skill suggestion.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {convo!.messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                conversationId={convo!.id}
                streaming={
                  sending &&
                  i === convo!.messages.length - 1 &&
                  m.role === "assistant"
                }
              />
            ))}
          </div>
        )}
      </div>
      <Composer showPresets={isEmpty} />
    </div>
  );
}
