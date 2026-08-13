"use client";
import { useState } from "react";

const ROLES = [
  "SDE / Software Engineer",
  "Data Analyst",
  "Data Scientist",
  "Mechanical Engineer",
  "Electrical Engineer",
  "Civil Engineer",
  "GATE / PSU aspirant",
];

interface Feedback {
  ats_score: number;
  strengths: string[];
  suggestions: { section: string; issue: string; suggestion: string }[];
  missing_keywords: string[];
}

export default function ResumeAnalyzerPage() {
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(ROLES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeText, targetRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong analyzing your resume.");
        return;
      }
      setFeedback(data.feedback);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-2xl mb-1">Resume Analyzer</h1>
      <p className="text-sm text-ink/50 mb-6">
        Paste your resume text below. (File upload comes next — plain text works for now.)
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <select
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm bg-white"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={12}
          placeholder="Paste your resume text here..."
          className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary/40"
        />
        <button
          type="submit"
          disabled={loading || resumeText.trim().length < 50}
          className="btn-3d text-sm disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze resume"}
        </button>
      </form>

      {error && <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2 mt-4">{error}</p>}

      {feedback && (
        <div className="mt-8 space-y-5">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-display">{feedback.ats_score}</span>
            <span className="text-sm text-ink/50 mb-1">/ 100 ATS readiness score</span>
          </div>

          <div>
            <h2 className="text-sm font-medium mb-2 text-success">Strengths</h2>
            <ul className="text-sm space-y-1 text-ink/70 list-disc list-inside">
              {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-medium mb-2 text-warn">Suggestions</h2>
            <div className="space-y-2">
              {feedback.suggestions.map((s, i) => (
                <div key={i} className="rounded-card border border-warn/20 bg-warn/5 p-3 text-sm">
                  <p className="font-medium">{s.section}</p>
                  <p className="text-ink/60">{s.issue}</p>
                  <p className="text-ink/80 mt-1">→ {s.suggestion}</p>
                </div>
              ))}
            </div>
          </div>

          {feedback.missing_keywords.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-2">Missing keywords</h2>
              <div className="flex flex-wrap gap-1.5">
                {feedback.missing_keywords.map((k, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
