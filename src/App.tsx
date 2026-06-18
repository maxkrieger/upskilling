import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useStore } from "./store.ts";
import { Gate } from "./components/Gate.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { ChatView } from "./components/ChatView.tsx";
import { CustomizeView } from "./components/CustomizeView.tsx";
import { AttachmentPanel } from "./components/AttachmentPanel.tsx";

/**
 * Chat page. Keeps the URL (`/` or `/c/:conversationId`) and the store's
 * activeConversationId in sync in both directions:
 *  - route -> store: opening a conversation by URL (sidebar click, deep link),
 *  - store -> route: a brand-new conversation created by sending a message on
 *    `/` gets its own URL so it's refreshable / shareable.
 */
function ChatRoute() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const activeConversationId = useStore((s) => s.activeConversationId);
  const openConversation = useStore((s) => s.openConversation);

  useEffect(() => {
    openConversation(conversationId ?? null);
  }, [conversationId, openConversation]);

  useEffect(() => {
    if (activeConversationId && activeConversationId !== conversationId) {
      navigate(`/c/${activeConversationId}`, { replace: true });
    }
  }, [activeConversationId, conversationId, navigate]);

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
