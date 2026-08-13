import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  messageType?: "explanation" | "question" | "answer" | "reteach" | "general";
}

const TYPE_LABELS: Record<string, string> = {
  question: "Checkpoint",
  reteach: "Let's revisit this",
};

export function MessageBubble({ role, content, messageType }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-card px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-paper"
            : "bg-white border border-primary/10 text-ink"
        )}
      >
        {messageType && TYPE_LABELS[messageType] && (
          <p className="text-xs font-medium text-secondary mb-1 uppercase tracking-wide">
            {TYPE_LABELS[messageType]}
          </p>
        )}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
