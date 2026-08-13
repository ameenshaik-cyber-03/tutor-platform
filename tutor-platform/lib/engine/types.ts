// Mirrors database-schema.sql — see core-engine-design.md for the full spec.

export type EngineMode = "learn" | "prep";
export type Difficulty = "foundational" | "intermediate" | "advanced";
export type NodeStatus = "untouched" | "weak" | "mastered";
export type NodeType = "concept" | "dsa" | "mcq" | "hr" | "aptitude" | "core_subject";

export interface ConceptNode {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  summary: string;
  difficulty: Difficulty;
  dependsOn: string[];
  nodeType: NodeType;
  status: NodeStatus;
  lastAssessedAt: string | null;
}

export interface ConceptMap {
  id: string;
  mode: EngineMode;
  rootTopic: string;
  roleContext?: string;
  companyTier?: string;
  nodes: ConceptNode[];
  createdAt: string;
}

export type QuestionType = "open" | "coding" | "mcq";

export interface CheckpointQuestion {
  questionType: QuestionType;
  question: string;
  options: string[] | null;
  correctOption: string | null;
}

export interface GapDetectionResult {
  coveredCorrectly: string[];
  missing: string[];
  misunderstood: string[];
  overallStatus: NodeStatus | "not_understood";
  encouragingSummary: string;
}
