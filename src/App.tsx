import { useCallback, useEffect, useState } from "react";
import { ChatView } from "./ChatView";
import { CorkBoard } from "./CorkBoard";
import "./index.css";

export interface Preference {
  label: string;
  value: string;
}

export interface Restaurant {
  name: string;
  cuisine: string;
  neighborhood: string;
  priceRange: string;
  reason: string;
}

export function App() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/chat/create", { method: "POST" });
      const id: string = await res.json();
      setConversationId(id);
    }
    init();
  }, []);

  const handleContextUpdate = useCallback(
    (ctx: { preferences?: Preference[]; restaurants?: Restaurant[] }) => {
      if (ctx.preferences) {
        setPreferences((prev) => {
          const merged = [...prev];
          for (const p of ctx.preferences!) {
            const existing = merged.findIndex(
              (m) => m.label.toLowerCase() === p.label.toLowerCase()
            );
            if (existing >= 0) {
              merged[existing] = p;
            } else {
              merged.push(p);
            }
          }
          return merged;
        });
      }
      if (ctx.restaurants) {
        setRestaurants((prev) => {
          const merged = [...prev];
          for (const r of ctx.restaurants!) {
            if (!merged.some((m) => m.name === r.name)) {
              merged.push(r);
            }
          }
          return merged;
        });
      }
    },
    []
  );

  return (
    <div className="h-screen flex bg-crunch-cream font-body">
      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatView
          conversationId={conversationId}
          onContextUpdate={handleContextUpdate}
        />
      </main>

      {/* Corkboard sidebar */}
      <CorkBoard preferences={preferences} restaurants={restaurants} />
    </div>
  );
}

export default App;
