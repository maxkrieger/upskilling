import { useStore } from "./store.ts";
import { Gate } from "./components/Gate.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { ChatView } from "./components/ChatView.tsx";
import { CustomizeView } from "./components/CustomizeView.tsx";

export default function App() {
  const authed = useStore((s) => s.authed);
  const view = useStore((s) => s.view);

  if (!authed) return <Gate />;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1">
        {view === "customize" ? <CustomizeView /> : <ChatView />}
      </main>
    </div>
  );
}
