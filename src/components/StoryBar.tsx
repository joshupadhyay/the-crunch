import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

interface ConversationPreview {
  id: string;
  createdAt: string;
  preview: string;
  messageCount: number;
}

export function StoryBar() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const { conversationId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchConversations() {
      const resp = await fetch("/api/chat/conversations");
      if (resp.ok) {
        const data: ConversationPreview[] = await resp.json();
        // newest first
        setConversations(data);
      }
    }
    fetchConversations();
  }, [conversationId]);

  if (conversations.length === 0) return null;

  return (
    <div className="story-bar flex gap-4 px-2 py-3 overflow-x-auto">
      {conversations.map((conv) => {
        const isActive = conv.id === conversationId;
        const initial = conv.preview.charAt(0).toUpperCase();
        // First word of preview, truncated
        const firstWord = conv.preview.split(/\s+/)[0] ?? "";
        const label = firstWord.slice(0, 8) + (firstWord.length > 8 ? "…" : "");

        return (
          <button
            key={conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            {/* Circle */}
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center font-display text-lg font-bold transition-all ${
                isActive
                  ? "border-3 border-crunch-walnut-600 bg-crunch-walnut-100 text-crunch-walnut-700"
                  : "border-[1.5px] border-crunch-khaki-300 bg-crunch-cream text-crunch-khaki-600 group-hover:border-crunch-walnut-400"
              }`}
            >
              {initial}
            </div>
            {/* Label */}
            <span
              className={`text-xs max-w-14 truncate ${
                isActive
                  ? "text-crunch-walnut-700 font-semibold"
                  : "text-crunch-khaki-500"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
