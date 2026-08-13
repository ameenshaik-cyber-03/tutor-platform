// Real dashboard: readiness_snapshots (written by Learn evaluate, resume
// analyze, and mock-interview complete) drive the readiness cards; recent
// concept_maps drive the "continue" list.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReadinessCard } from "@/components/dashboard/ReadinessCard";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: snapshots } = await supabase
    .from("readiness_snapshots")
    .select("area, score, computed_at")
    .eq("user_id", user.id)
    .order("computed_at", { ascending: true });

  const byArea: Record<string, { score: number; computed_at: string }[]> = {};
  for (const s of snapshots ?? []) {
    if (!byArea[s.area]) byArea[s.area] = [];
    byArea[s.area].push({ score: s.score, computed_at: s.computed_at });
  }
  const areaCards = Object.entries(byArea).map(([area, points]) => ({
    area,
    latestScore: points[points.length - 1].score,
    previousScore: points.length > 1 ? points[points.length - 2].score : null,
  }));

  const { data: recentMaps } = await supabase
    .from("concept_maps")
    .select("id, root_topic, mode, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl mb-1">Welcome back</h1>
      <p className="text-ink/50 mb-8">Pick up a topic, or jump into prep.</p>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link href="/learn" className="rounded-card border border-primary/10 p-6 hover:border-secondary/40 transition-colors">
          <h2 className="font-display font-extrabold text-lg mb-1">Learn something new</h2>
          <p className="text-sm text-ink/50">Start a topic and let the tutor find your gaps.</p>
        </Link>
        <Link href="/prep" className="rounded-card border border-primary/10 p-6 hover:border-secondary/40 transition-colors">
          <h2 className="font-display font-extrabold text-lg mb-1">Career prep</h2>
          <p className="text-sm text-ink/50">Resume review, mock interviews, and role-based tests.</p>
        </Link>
      </div>

      {areaCards.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium text-ink/60 mb-3">Your readiness</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {areaCards.map((c) => (
              <ReadinessCard key={c.area} area={c.area} latestScore={c.latestScore} previousScore={c.previousScore} />
            ))}
          </div>
        </div>
      )}

      {recentMaps && recentMaps.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink/60 mb-3">Continue where you left off</h2>
          <div className="space-y-2">
            {recentMaps.map((m) => (
              <Link
                key={m.id}
                href={m.mode === "learn" ? `/learn/${m.id}` : "/prep"}
                className="flex items-center justify-between px-4 py-3 rounded-card border border-primary/10 hover:border-secondary/40 text-sm"
              >
                <span>{m.root_topic}</span>
                <span className="text-xs text-ink/40 uppercase">{m.mode}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
