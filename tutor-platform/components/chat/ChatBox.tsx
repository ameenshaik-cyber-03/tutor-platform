"use client";

import { useState } from "react";
import { Send, Mic, Paperclip } from "lucide-react";
import { MessageBubble } from "./MessageBubble";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageType?: "explanation" | "question" | "answer" | "reteach" | "general";
}

interface ChatBoxProps {
  messages: UIMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Controlled component — the parent (e.g. LearnSessionClient) owns message
// state so it can stream assistant replies in and persist everything to
// Supabase. ChatBox only owns the draft text box.
export function ChatBox({ messages, onSend, disabled, placeholder }: ChatBoxProps) {
  const [draft, setDraft] = useState("");

  function handleSend() {
    if (!draft.trim() || disabled) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} messageType={m.messageType} />
        ))}
        {disabled && (
          <div className="flex items-center gap-1.5 text-xs text-ink/40 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Thinking...
          </div>
        )}
      </div>

      <div className="border-t border-primary/10 p-4">
        <div className="flex items-end gap-2 bg-white rounded-card border border-primary/15 px-3 py-2 focus-within:ring-2 focus-within:ring-secondary/40">
          <button aria-label="Attach a file" className="p-1.5 text-ink/40 hover:text-ink/70">
            <Paperclip size={16} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder ?? "Explain it in your own words..."}
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm py-1.5 focus:outline-none placeholder:text-ink/40 disabled:opacity-60"
          />
          <button aria-label="Voice input" className="p-1.5 text-ink/40 hover:text-ink/70">
            <Mic size={16} />
          </button>
          <button
            aria-label="Send message"
            onClick={handleSend}
            disabled={disabled}
            className="p-1.5 rounded-full bg-primary text-paper hover:bg-primary-dark disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
