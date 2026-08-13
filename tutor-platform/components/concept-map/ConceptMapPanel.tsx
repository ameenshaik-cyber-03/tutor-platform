import { cn } from "@/lib/utils";
import type { ConceptNode } from "@/lib/engine/types";

interface ConceptMapPanelProps {
  rootTopic: string;
  nodes: ConceptNode[];
}

// A simple grouped-list view to start with. Swap for a React Flow graph
// once you want the full visual tree — the data shape already supports it
// via node.parentId / node.dependsOn.
export function ConceptMapPanel({ rootTopic, nodes }: ConceptMapPanelProps) {
  const masteredCount = nodes.filter((n) => n.status === "mastered").length;

  return (
    <div className="w-80 shrink-0 border-l border-primary/10 p-5 h-full overflow-y-auto">
      <p className="text-xs uppercase tracking-wide text-ink/40 mb-1">Progress</p>
      <h3 className="font-display font-extrabold text-lg mb-1">{rootTopic}</h3>
      <p className="text-sm text-ink/50 mb-5">
        {masteredCount} / {nodes.length} mastered
      </p>

      <div className="space-y-2">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
              node.status === "mastered" && "bg-success/10",
              node.status === "weak" && "bg-warn/10",
              node.status === "untouched" && "bg-primary/5"
            )}
          >
            <span className={cn("status-dot", `status-dot--${node.status}`)} />
            <span className="text-ink/80">{node.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
