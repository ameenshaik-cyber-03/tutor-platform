import { cn } from "@/lib/utils";

interface ReadinessCardProps {
  area: string;
  latestScore: number;
  previousScore: number | null;
}

const AREA_LABELS: Record<string, string> = {
  resume: "Resume",
  hr: "HR Interview",
  technical: "Technical Interview",
  aptitude: "Aptitude",
};

export function ReadinessCard({ area, latestScore, previousScore }: ReadinessCardProps) {
  const delta = previousScore == null ? null : latestScore - previousScore;
  const label = AREA_LABELS[area] ?? area;

  return (
    <div className="rounded-card border border-primary/10 p-4">
      <p className="text-xs text-ink/50 mb-2">{label}</p>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-display">{latestScore}</span>
        <span className="text-xs text-ink/40 mb-1">/ 100</span>
      </div>
      <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden mb-1">
        <div
          className={cn("h-full rounded-full", latestScore >= 70 ? "bg-success" : latestScore >= 40 ? "bg-warn" : "bg-danger")}
          style={{ width: `${latestScore}%` }}
        />
      </div>
      {delta != null && (
        <p className={cn("text-xs", delta >= 0 ? "text-success" : "text-danger")}>
          {delta >= 0 ? "+" : ""}{delta} since last attempt
        </p>
      )}
    </div>
  );
}
