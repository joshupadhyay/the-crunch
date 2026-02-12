import type { RefObject } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Andrew I don't really care much for styling
 * @param param0
 * @returns
 */

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  inputRef,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="px-4 py-3 bg-crunch-cream border-t-2 border-crunch-walnut-200">
      <div className="max-w-2xl mx-auto flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are you in the mood for?"
          rows={1}
          className="flex-1 resize-none rounded-xl border-2 border-crunch-walnut-200 bg-white px-4 py-2.5 text-[15px] text-crunch-walnut-900 placeholder:text-crunch-khaki-400 focus:outline-none focus:border-crunch-walnut-500 transition-colors min-h-10 max-h-32 font-body"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
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
  );
}
