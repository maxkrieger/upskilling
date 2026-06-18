import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useStore } from "./store.ts";
import { Gate } from "./components/Gate.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { ChatView } from "./components/ChatView.tsx";
import { CustomizeView } from "./components/CustomizeView.tsx";
import { AttachmentPanel } from "./components/AttachmentPanel.tsx";

/**
 * Chat page. Syncs the URL (`/` or `/c/:conversationId`) into the store's
 * activeConversationId (sidebar click, deep link, "New chat" -> `/`). The
 * reverse direction — a brand-new conversation getting its own `/c/:id` URL —
 * is handled at the send site (Composer), NOT here: doing it as an effect raced
 * with this one, so navigating to `/` for a new chat bounced back to the old
 * conversation (the store hadn't reset to null yet).
 */
function ChatRoute() {
  const { conversationId } = useParams();
  const openConversation = useStore((s) => s.openConversation);

  useEffect(() => {
    openConversation(conversationId ?? null);
  }, [conversationId, openConversation]);

  return <ChatView />;
}

export default function App() {
  const authed = useStore((s) => s.authed);

  if (!authed) return <Gate />;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<ChatRoute />} />
            <Route path="/c/:conversationId" element={<ChatRoute />} />
            <Route path="/customize" element={<CustomizeView />} />
            <Route path="/customize/:skillId" element={<CustomizeView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <AttachmentPanel />
      </main>
    </div>
  );
}
