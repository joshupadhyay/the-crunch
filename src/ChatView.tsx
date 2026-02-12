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

export function ChatView({ conversationId, onContextUpdate }: ChatViewProps) {
  // stores the entire conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingTool, setIsUsingTool] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  // TODO: implement sendMessage — see confusions/streaming-howto.md
  const sendMessage = async () => {
    // append latest input to messages.. modifying like this to avoid adjusting messages inplace

    const latestMsg: Message = { role: "user", content: input };

    setMessages([...messages, latestMsg]);
    setInput(""); // clear input after pushing

    // now UI is loading as we wait for response
    setIsLoading(true);

    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input,
        conversationId: conversationId,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    let assistantText = "";

    // set empty chatbot message. We'll be updating this with each chunk as they come in
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      // read chunk by chunk as it comes in
      const { done, value } = await reader?.read();

      // while (true) because we don't know how many chunks. but we know we will get done message
      if (done) break;

      // parse the stringified JSON. we also need to grab the text.text, since that's what chunks send
      const raw = decoder.decode(value);
      const lines = raw.split("\n").filter((line) => line.trim());

      // if multiple chunks, we need to split by `\n`, which the server sends as newline between chunks
      // we parse each one, then add it to the text

      for (const line of lines) {
        const parsed = JSON.parse(line);

        if (parsed.type === "text") {
          assistantText += parsed.text.text;
        } else if (parsed.type === "tool_use_start") {
          // show tool use as it happens...
          assistantText += `\n\n*Tool Use: ${parsed.name}...*\n\n`;
          setIsUsingTool(assistantText);
        } else if (parsed.type === "tool_use_stop") {
          setIsUsingTool(undefined);
        }
      }

      // replace the last message with updated text — new array, new object
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: assistantText },
      ]);
    }

    setIsLoading(false);
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
      <header className="px-6 py-4 border-b-2 border-crunch-mahogany-200 bg-crunch-cream">
        <h1 className="font-display text-3xl font-black text-crunch-mahogany-800 tracking-tight">
          The Crunch
        </h1>
        <p className="text-crunch-khaki-600 text-sm mt-0.5">
          Let's have a time!
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
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    >
                      .
                    </span>
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    >
                      .
                    </span>
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    >
                      .
                    </span>
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
