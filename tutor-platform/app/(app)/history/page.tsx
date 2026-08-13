import Link from "next/link";
import { BookOpen, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/utils";

interface HistoryItem {
  id: string;
  kind: "learn" | "interview";
  title: string;
  timestamp: string;
  href: string;
  meta?: string;
}

export default async function HistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, title, started_at, concept_map_id")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const { data: interviews } = await supabase
    .from("mock_interviews")
    .select("id, interview_type, status, overall_score, started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const items: HistoryItem[] = [
    ...(sessions ?? []).map((s) => ({
      id: s.id,
      kind: "learn" as const,
      title: s.title ?? "Untitled session",
      timestamp: s.started_at,
      href: `/learn/${s.concept_map_id}`,
    })),
    ...(interviews ?? []).map((i) => ({
      id: i.id,
      kind: "interview" as const,
      title: `${i.interview_type[0].toUpperCase()}${i.interview_type.slice(1)} interview`,
      timestamp: i.started_at,
      href: "/prep",
      meta: i.status === "completed" ? `${i.overall_score}/100` : "In progress",
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const grouped: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const label = dateLabel(item.timestamp);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-2xl mb-6">History</h1>

      {items.length === 0 && (
        <p className="text-sm text-ink/50">Nothing here yet — start a learning session or a mock interview to see it here.</p>
      )}

      {Object.entries(grouped).map(([label, groupItems]) => (
        <div key={label} className="mb-6">
          <p className="text-xs uppercase tracking-wide text-ink/40 mb-2">{label}</p>
          <div className="space-y-1.5">
            {groupItems.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-card border border-primary/10 hover:border-secondary/40 text-sm"
              >
                {item.kind === "learn" ? (
                  <BookOpen size={15} className="text-primary shrink-0" />
                ) : (
                  <Briefcase size={15} className="text-secondary shrink-0" />
                )}
                <span className="flex-1 truncate">{item.title}</span>
                {item.meta && <span className="text-xs text-ink/40">{item.meta}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
