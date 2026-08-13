"use client";
// Vertical slice: topic → form → /api/concept-map/generate → engine → AI →
// JSON → Supabase → redirect to the page that displays the saved concept map.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LearnEntryPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/concept-map/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "learn", topicOrRole: topic }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong generating your concept map.");
        setLoading(false);
        return;
      }

      router.push(`/learn/${data.conceptMap.id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <h1 className="font-display font-extrabold text-2xl mb-2">What do you want to learn?</h1>
      <p className="text-ink/50 mb-6 text-sm">
        Type a topic, or attach notes/a PDF from the search bar above.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Binary Search Trees"
          disabled={loading}
          className="w-full px-4 py-3 rounded-card border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="mt-3 w-full btn-3d text-sm"
        >
          {loading ? "Building your concept map..." : "Start learning"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2 mt-4">{error}</p>
      )}
    </div>
  );
}
