import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Preference, Restaurant } from "./App";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatViewProps {
  conversationId: string | null;
  onContextUpdate: (ctx: {
    preferences?: Preference[];
    restaurants?: Restaurant[];
  }) => void;
}

function extractContext(text: string): {
  cleanText: string;
  context: { preferences?: Preference[]; restaurants?: Restaurant[] } | null;
} {
  const contextMatch = text.match(/<!--context\s*([\s\S]*?)-->/);
  if (!contextMatch) return { cleanText: text, context: null };

  const cleanText = text.replace(/<!--context\s*[\s\S]*?-->/, "").trim();
  try {
    const context = JSON.parse(contextMatch[1]);
    return { cleanText, context };
  } catch {
    return { cleanText, context: null };
  }
}

function cleanStreamingText(text: string): string {
  // Hide incomplete <!--context blocks while streaming
  const idx = text.lastIndexOf("<!--context");
  if (idx !== -1 && !text.includes("-->", idx)) {
    return text.substring(0, idx).trim();
  }
  // Clean any complete context blocks too
  return text.replace(/<!--context\s*[\s\S]*?-->/g, "").trim();
}

export function ChatView({ conversationId, onContextUpdate }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Add empty assistant message to fill progressively
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (separated by double newlines)
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));

            if (event.type === "text") {
              fullText += event.text;
              // Hide partial <!--context blocks during streaming
              const display = cleanStreamingText(fullText);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: display,
                };
                return updated;
              });
            } else if (event.type === "done") {
              // Final extraction with context
              const { cleanText, context } = extractContext(fullText);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: cleanText,
                };
                return updated;
              });
              if (context) onContextUpdate(context);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Bummer — couldn't reach the kitchen. Try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-crunch-khaki-600">
        <p className="font-display text-xl">Warming up the kitchen...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="px-6 py-4 border-b-2 border-crunch-walnut-200 bg-crunch-cream">
        <h1 className="font-display text-3xl font-black text-crunch-mahogany-700 tracking-tight">
          The Crunch
        </h1>
        <p className="text-crunch-khaki-600 text-sm mt-0.5">
          Your groovy dining concierge
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-crunch-cream">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <h2 className="font-display text-4xl font-black text-crunch-walnut-700 mb-3">
                Hey there, hungry?
              </h2>
              <p className="text-crunch-khaki-600 text-lg leading-relaxed">
                Tell me what kind of night you're planning and I'll find you the
                perfect spot. Restaurants, bars, the whole deal.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "Date night in the West Village",
                  "Best tacos in Manhattan",
                  "Group dinner, $$$, Italian",
                  "Speakeasy cocktail bars",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-full bg-crunch-walnut-100 text-crunch-walnut-700 text-sm hover:bg-crunch-walnut-200 transition-colors cursor-pointer border border-crunch-walnut-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 text-[15px] leading-relaxed ${
                      isUser
                        ? "bg-crunch-walnut-600 text-white rounded-2xl rounded-br-sm"
                        : "bg-white text-crunch-walnut-900 rounded-2xl rounded-bl-sm border border-crunch-walnut-100 shadow-sm"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm prose-stone max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-crunch-walnut-600 rounded-2xl rounded-bl-sm border border-crunch-walnut-100 shadow-sm px-4 py-3">
                  <span className="inline-flex gap-1 text-lg">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-crunch-cream border-t-2 border-crunch-walnut-200">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you in the mood for?"
            rows={1}
            className="flex-1 resize-none rounded-xl border-2 border-crunch-walnut-200 bg-white px-4 py-2.5 text-[15px] text-crunch-walnut-900 placeholder:text-crunch-khaki-400 focus:outline-none focus:border-crunch-walnut-500 transition-colors min-h-10 max-h-32 font-body"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-10 h-10 rounded-xl bg-crunch-walnut-600 text-white flex items-center justify-center hover:bg-crunch-walnut-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
