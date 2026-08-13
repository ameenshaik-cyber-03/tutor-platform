"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBox, type UIMessage } from "@/components/chat/ChatBox";
import type { ConceptNode, QuestionType } from "@/lib/engine/types";

interface MockInterviewClientProps {
  conceptMapId: string;
  mockInterviewId: string;
  interviewType: "hr" | "technical" | "aptitude";
  nodes: ConceptNode[];
}

// Maps the URL's interview type to the node_type values that belong to it —
// a "technical" interview should only draw from dsa/core_subject nodes, not
// the HR nodes the same concept map also generated.
const TYPE_TO_NODE_TYPES: Record<string, string[]> = {
  hr: ["hr"],
  technical: ["dsa", "core_subject"],
  aptitude: ["aptitude", "mcq"],
};

interface CurrentQuestion {
  node: ConceptNode;
  questionType: QuestionType;
  questionText: string;
  options: string[] | null;
  correctOption: string | null;
}

export function MockInterviewClient({
  conceptMapId,
  mockInterviewId,
  interviewType,
  nodes,
}: MockInterviewClientProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<{ overallScore: number; questionCount: number } | null>(null);
  const [current, setCurrent] = useState<CurrentQuestion | null>(null);

  const queueRef = useRef<ConceptNode[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const relevant = interviewType in TYPE_TO_NODE_TYPES
      ? nodes.filter((n) => TYPE_TO_NODE_TYPES[interviewType].includes(n.nodeType))
      : nodes;

    queueRef.current = relevant.length > 0 ? relevant : nodes;

    appendMessage({
      role: "assistant",
      content: `Let's begin your ${interviewType} interview. I'll ask ${queueRef.current.length} question${queueRef.current.length === 1 ? "" : "s"} — answer as you would in a real interview.`,
      messageType: "general",
    });

    void askNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appendMessage(msg: Omit<UIMessage, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: crypto.randomUUID() }]);
  }

  async function askNext() {
    const node = queueRef.current.shift();
    if (!node) {
      await finishInterview();
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/concept-map/${conceptMapId}/question`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: node.id }),
    });
    const data = await res.json();

    if (!res.ok) {
      appendMessage({ role: "assistant", content: "Couldn't generate the next question — skipping ahead.", messageType: "general" });
      await askNext();
      return;
    }

    setCurrent({
      node,
      questionType: data.questionType,
      questionText: data.question,
      options: data.options ?? null,
      correctOption: data.correctOption ?? null,
    });

    const questionDisplay = data.options
      ? `${data.question}\n\n${(data.options as string[]).map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`
      : data.question;

    appendMessage({ role: "assistant", content: questionDisplay, messageType: "question" });
    setBusy(false);
  }

  async function handleSend(text: string) {
    if (!current || busy) return;

    appendMessage({ role: "user", content: text, messageType: "answer" });
    setBusy(true);

    const res = await fetch(`/api/mock-interview/${mockInterviewId}/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId: current.node.id,
        questionType: current.questionType,
        questionText: current.questionText,
        options: current.options,
        correctOption: current.correctOption,
        userAnswer: text,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      appendMessage({ role: "assistant", content: "Couldn't score that answer — moving on.", messageType: "general" });
    } else {
      const fb = data.evaluation.feedback as string;
      appendMessage({ role: "assistant", content: `Score: ${data.score}/100 — ${fb}`, messageType: "general" });
    }

    setCurrent(null);
    await askNext();
  }

  async function finishInterview() {
    setBusy(true);
    const res = await fetch(`/api/mock-interview/${mockInterviewId}/complete`, { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      setSummary(data);
      appendMessage({
        role: "assistant",
        content: `Interview complete. You scored ${data.overallScore}/100 across ${data.questionCount} questions.`,
        messageType: "general",
      });
    } else {
      appendMessage({ role: "assistant", content: "Interview finished, but couldn't compute a final score.", messageType: "general" });
    }

    setFinished(true);
    setBusy(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 min-h-0">
        <ChatBox
          messages={messages}
          onSend={handleSend}
          disabled={busy || finished}
          placeholder={finished ? "Interview finished" : "Type your answer..."}
        />
      </div>
      {finished && summary && (
        <div className="border-t border-primary/10 p-4 text-center">
          <span className="text-sm text-ink/50">
            Overall score: <span className="font-medium text-ink">{summary.overallScore}/100</span>
          </span>
        </div>
      )}
    </div>
  );
}
