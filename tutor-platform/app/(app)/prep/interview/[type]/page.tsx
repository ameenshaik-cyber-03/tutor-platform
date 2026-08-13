"use client";
// Two-phase page: "setup" collects role/company tier and kicks off the same
// concept-map engine used by Learn mode (mode: "prep"), then creates a
// mock_interviews row and hands off to MockInterviewClient for the actual
// question -> answer -> score loop.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MockInterviewClient } from "@/components/prep/MockInterviewClient";
import type { ConceptNode } from "@/lib/engine/types";

const TYPE_LABELS: Record<string, string> = {
  hr: "HR / Behavioral",
  technical: "Technical",
  aptitude: "Aptitude",
};

export default function MockInterviewPage({ params }: { params: { type: string } }) {
  const interviewType = params.type as "hr" | "technical" | "aptitude";
  const supabase = createClient();

  const [phase, setPhase] = useState<"setup" | "active">("setup");
  const [role, setRole] = useState("");
  const [companyTier, setCompanyTier] = useState("Product-based");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [conceptMapId, setConceptMapId] = useState<string | null>(null);
  const [mockInterviewId, setMockInterviewId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ConceptNode[]>([]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const genRes = await fetch("/api/concept-map/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "prep", topicOrRole: role, companyTier }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error?.toString?.() ?? "Couldn't generate a prep plan for that role.");
        setLoading(false);
        return;
      }
      const mapId = genData.conceptMap.id as string;

      const nodesRes = await fetch(`/api/concept-map/${mapId}`);
      const nodesData = await nodesRes.json();
      if (!nodesRes.ok) {
        setError("Generated the plan, but couldn't load its topics.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated — please log in again.");
        setLoading(false);
        return;
      }

      const { data: interview, error: interviewError } = await supabase
        .from("mock_interviews")
        .insert({
          user_id: user.id,
          concept_map_id: mapId,
          interview_type: interviewType,
          status: "in_progress",
        })
        .select()
        .single();

      if (interviewError || !interview) {
        setError("Couldn't start the interview session.");
        setLoading(false);
        return;
      }

      const mappedNodes: ConceptNode[] = (nodesData.nodes ?? []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        parentId: row.parent_id,
        summary: row.summary,
        difficulty: row.difficulty,
        dependsOn: row.depends_on ?? [],
        nodeType: row.node_type,
        status: row.status,
        lastAssessedAt: row.last_assessed_at,
      }));

      setConceptMapId(mapId);
      setMockInterviewId(interview.id);
      setNodes(mappedNodes);
      setPhase("active");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (phase === "active" && conceptMapId && mockInterviewId) {
    return (
      <MockInterviewClient
        conceptMapId={conceptMapId}
        mockInterviewId={mockInterviewId}
        interviewType={interviewType}
        nodes={nodes}
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="font-display font-extrabold text-2xl mb-1 text-center">
        {TYPE_LABELS[interviewType] ?? "Mock"} Interview
      </h1>
      <p className="text-sm text-ink/50 text-center mb-6">
        Tell us the role you're preparing for.
      </p>

      <form onSubmit={handleStart} className="space-y-3">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. SDE-1, Data Analyst, Mechanical Engineer"
          disabled={loading}
          className="w-full px-4 py-3 rounded-card border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 disabled:opacity-60"
        />
        <select
          value={companyTier}
          onChange={(e) => setCompanyTier(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 rounded-card border border-primary/15 text-sm bg-white disabled:opacity-60"
        >
          <option>Product-based</option>
          <option>Service-based</option>
          <option>PSU / Government</option>
          <option>Core Engineering</option>
          <option>Startup</option>
        </select>
        <button
          type="submit"
          disabled={loading || !role.trim()}
          className="w-full btn-3d text-sm disabled:opacity-50"
        >
          {loading ? "Preparing your interview..." : "Start interview"}
        </button>
      </form>

      {error && <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2 mt-4">{error}</p>}
    </div>
  );
}
