"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatBox, type UIMessage } from "@/components/chat/ChatBox";
import { ConceptMapPanel } from "@/components/concept-map/ConceptMapPanel";
import type { ConceptNode } from "@/lib/engine/types";

interface LearnSessionClientProps {
  conceptMapId: string;
  rootTopic: string;
  initialNodes: ConceptNode[];
  userId: string;
  personaId: string | null;
}

interface GapResult {
  coveredCorrectly: string[];
  missing: string[];
  misunderstood: string[];
  overallStatus: "mastered" | "weak" | "not_understood";
  encouragingSummary: string;
}

// Picks the next node to teach. Deliberately simple for now — walks nodes
// in stored order and returns the first one that isn't mastered yet.
// TODO: respect node.dependsOn so prerequisites are always taught first.
function getNextNode(nodes: ConceptNode[]): ConceptNode | null {
  return nodes.find((n) => n.status !== "mastered") ?? null;
}

export function LearnSessionClient({
  conceptMapId,
  rootTopic,
  initialNodes,
  userId,
  personaId,
}: LearnSessionClientProps) {
  const supabase = createClient();

  const [nodes, setNodes] = useState<ConceptNode[]>(initialNodes);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<ConceptNode | null>(null);

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startSession() {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        concept_map_id: conceptMapId,
        persona_id: personaId,
        session_type: "learn",
        title: rootTopic,
      })
      .select()
      .single();

    if (error || !data) {
      appendMessage({ role: "assistant", content: "Couldn't start a session — please refresh and try again.", messageType: "general" });
      return;
    }

    setSessionId(data.id);
    const firstNode = getNextNode(nodes);
    if (firstNode) {
      await teachNode(firstNode, data.id);
    } else {
      appendMessage({ role: "assistant", content: "This concept map has no topics yet.", messageType: "general" });
    }
  }

  function appendMessage(msg: Omit<UIMessage, "id">): string {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }

  function updateMessage(id: string, content: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  }

  async function persistMessage(sid: string, params: {
    role: "user" | "assistant";
    content: string;
    nodeId?: string;
    messageType?: UIMessage["messageType"];
  }) {
    await supabase.from("messages").insert({
      session_id: sid,
      node_id: params.nodeId ?? null,
      role: params.role,
      message_type: params.messageType ?? "general",
      content: params.content,
    });
  }

  // Streams a Route Handler's plain-text response into a single message bubble.
  async function streamInto(url: string, body: object, messageType: UIMessage["messageType"]): Promise<string> {
    const msgId = appendMessage({ role: "assistant", content: "", messageType });
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "Something went wrong.");
      updateMessage(msgId, text);
      return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      updateMessage(msgId, full);
    }

    return full;
  }

  async function teachNode(node: ConceptNode, sid: string) {
    setBusy(true);
    setCurrentNode(node);

    const explanation = await streamInto(
      `/api/concept-map/${conceptMapId}/explain`,
      { nodeId: node.id, personaId },
      "explanation"
    );
    await persistMessage(sid, { role: "assistant", content: explanation, nodeId: node.id, messageType: "explanation" });

    await askQuestion(node, sid);
  }

  async function askQuestion(node: ConceptNode, sid: string) {
    const res = await fetch(`/api/concept-map/${conceptMapId}/question`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: node.id }),
    });
    const data = await res.json();

    if (!res.ok) {
      appendMessage({ role: "assistant", content: "Couldn't generate a question — try sending a message to retry.", messageType: "general" });
      setBusy(false);
      return;
    }

    appendMessage({ role: "assistant", content: data.question, messageType: "question" });
    await persistMessage(sid, { role: "assistant", content: data.question, nodeId: node.id, messageType: "question" });
    setBusy(false);
  }

  async function handleSend(text: string) {
    if (!sessionId || !currentNode || busy) return;

    appendMessage({ role: "user", content: text, messageType: "answer" });
    await persistMessage(sessionId, { role: "user", content: text, nodeId: currentNode.id, messageType: "answer" });

    setBusy(true);

    const res = await fetch(`/api/concept-map/${conceptMapId}/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: currentNode.id, sessionId, userAnswer: text }),
    });
    const gapResult: GapResult | { error: string } = await res.json();

    if (!res.ok || "error" in gapResult) {
      appendMessage({ role: "assistant", content: "Couldn't evaluate that answer — try again.", messageType: "general" });
      setBusy(false);
      return;
    }

    appendMessage({ role: "assistant", content: gapResult.encouragingSummary, messageType: "general" });
    await persistMessage(sessionId, { role: "assistant", content: gapResult.encouragingSummary, nodeId: currentNode.id, messageType: "general" });

    const dbStatus = gapResult.overallStatus === "not_understood" ? "weak" : gapResult.overallStatus;
    const updatedNodes = nodes.map((n) => (n.id === currentNode.id ? { ...n, status: dbStatus as ConceptNode["status"] } : n));
    setNodes(updatedNodes);

    if (gapResult.overallStatus === "mastered") {
      const next = getNextNode(updatedNodes);
      if (next) {
        await teachNode(next, sessionId);
      } else {
        appendMessage({ role: "assistant", content: `You've mastered everything in "${rootTopic}". Nice work.`, messageType: "general" });
        setBusy(false);
      }
    } else {
      const reteach = await streamInto(
        `/api/concept-map/${conceptMapId}/reteach`,
        { nodeId: currentNode.id, personaId, gapResult },
        "reteach"
      );
      await persistMessage(sessionId, { role: "assistant", content: reteach, nodeId: currentNode.id, messageType: "reteach" });
      await askQuestion(currentNode, sessionId);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1">
        <ChatBox messages={messages} onSend={handleSend} disabled={busy} />
      </div>
      <ConceptMapPanel rootTopic={rootTopic} nodes={nodes} />
    </div>
  );
}
