import { useEffect, useMemo, useRef } from "react";
import { getProfile } from "../data/index.ts";
import { useStore } from "../store.ts";
import { Composer } from "./Composer.tsx";
import { MessageView } from "./MessageView.tsx";

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
            <div className="mb-3 text-5xl">{profile.emoji}</div>
            <h1 className="font-serif text-3xl text-ink">
              How can I help, {profile.name}?
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted">{profile.blurb}</p>
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
