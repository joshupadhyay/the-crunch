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
  const [isExpanded, setIsExpanded] = useState(true);
  const { conversationId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchConversations() {
      const resp = await fetch("/api/chat/conversations");
      if (resp.ok) {
        const data: ConversationPreview[] = await resp.json();
        setConversations(data);
      }
    }
    fetchConversations();
  }, [conversationId]);

  if (conversations.length === 0) return null;

  return (
    <div className="mt-2">
      {/* Toggle */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs text-crunch-khaki-500 hover:text-crunch-walnut-600 transition-colors cursor-pointer mb-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        Recent chats
      </button>

      {/* Scrollable circles */}
      {isExpanded && (
        <div className="story-bar flex gap-4 px-2 py-2 overflow-x-auto">
          {conversations.map((conv) => {
            const isActive = conv.id === conversationId;
            const initial = conv.preview.charAt(0).toUpperCase();
            const firstWord = conv.preview.split(/\s+/)[0] ?? "";
            const label =
              firstWord.slice(0, 8) + (firstWord.length > 8 ? "…" : "");

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-display text-lg font-bold transition-all ${
                    isActive
                      ? "border-3 border-crunch-walnut-600 bg-crunch-walnut-100 text-crunch-walnut-700"
                      : "border-[1.5px] border-crunch-khaki-300 bg-crunch-cream text-crunch-khaki-600 group-hover:border-crunch-walnut-400"
                  }`}
                >
                  {initial}
                </div>
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
      )}
    </div>
  );
}
