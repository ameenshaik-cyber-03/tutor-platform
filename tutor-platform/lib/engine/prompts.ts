import type { ConceptNode, EngineMode } from "./types";

// See core-engine-design.md for the full rationale behind each prompt.

export const CONCEPT_MAP_SYSTEM_PROMPT = `You are an expert curriculum designer. Given a topic or job role, break it
into a concept map of 6-12 nodes covering everything a learner needs to
understand it thoroughly, ordered by dependency.

Return ONLY valid JSON matching this schema, no other text:
{
  "rootTopic": string,
  "nodes": [
    {
      "id": string (short-slug),
      "title": string,
      "parentId": string | null,
      "summary": string (1-2 sentences),
      "difficulty": "foundational" | "intermediate" | "advanced",
      "dependsOn": string[] (ids of prerequisite nodes),
      "nodeType": "concept" | "dsa" | "mcq" | "hr" | "aptitude" | "core_subject"
    }
  ]
}

nodeType classification rules:
- If this is a "learn" mode request (a single topic to understand), every node's nodeType is "concept".
- If this is a "prep" mode request (a job role), classify each node by what kind of interview round it belongs to: "dsa" for data structures/algorithms/coding, "hr" for behavioral/soft-skills, "aptitude" for quantitative/logical reasoning or objective quiz-style topics, "core_subject" for domain-specific technical knowledge that isn't DSA (e.g. thermodynamics, DBMS theory, circuit design), "mcq" only for pure objective-question topics that don't fit the others.`;

export function buildConceptMapUserPrompt(params: {
  mode: EngineMode;
  topicOrRole: string;
  companyTier?: string;
}): string {
  if (params.mode === "learn") {
    return `Topic: ${params.topicOrRole}
Mode: learn
Generate the concept map for a student learning this from scratch.`;
  }
  return `Role: ${params.topicOrRole}
Company tier: ${params.companyTier ?? "not specified"}
Mode: prep
Generate the concept map of skill areas a candidate needs to master to
clear interviews for this role. Include both technical and non-technical
areas (e.g. DSA, CS fundamentals, aptitude, HR/behavioral, domain-specific
core subjects if applicable).`;
}

export function buildExplainSystemPrompt(personaStyle: string, parentTopic: string): string {
  return `You are ${personaStyle}, an engaging tutor. Explain the given concept
node thoroughly but clearly: what it is, why it matters, how it connects
to ${parentTopic}, and one concrete real-world example. Keep it
conversational, not textbook-dry. End with a short check: tell the user
you'll ask them to explain it back in their own words next.`;
}

export function buildExplainUserPrompt(node: ConceptNode, masteredTitles: string[]): string {
  return `Node: ${node.title}
Summary: ${node.summary}
Difficulty level: ${node.difficulty}
Prior context (already covered): ${masteredTitles.join(", ") || "none yet"}`;
}

export const CHECKPOINT_QUESTION_LEARN_PROMPT = `Ask the user a single open-ended question that requires them to explain
the given concept back in their own words. Do not ask a yes/no or
multiple-choice question — you need to see their reasoning to diagnose
gaps.`;

export function buildCheckpointPrepPrompt(node: ConceptNode, jobRole: string): string {
  return `Generate ONE interview-style question for the skill area "${node.title}"
appropriate for a ${jobRole} candidate. If this is a DSA/coding node,
give a coding problem statement. If HR/behavioral, give a STAR-format
question. If aptitude/MCQ-style, generate one MCQ with 4 options.
Return JSON:
{
  "questionType": "open" | "coding" | "mcq",
  "question": string,
  "options": string[] | null,
  "correctOption": string | null
}`;
}

export const GAP_DETECTION_SYSTEM_PROMPT = `You are a diagnostic evaluator. Compare the user's answer against the
reference concept node. Identify exactly which parts are correct,
which are missing, and which are misunderstood. Be specific — point to
the sub-idea, not just "partially correct."

Return ONLY JSON:
{
  "coveredCorrectly": string[],
  "missing": string[],
  "misunderstood": string[],
  "overallStatus": "mastered" | "weak" | "not_understood",
  "encouragingSummary": string
}`;

export function buildGapDetectionUserPrompt(node: ConceptNode, userAnswer: string): string {
  return `Concept node: ${node.title}
Reference summary: ${node.summary}
User's answer: ${userAnswer}`;
}

export function buildReteachSystemPrompt(personaStyle: string, nodeTitle: string): string {
  return `You are ${personaStyle}. The user misunderstood or missed specific parts
of "${nodeTitle}". Do NOT re-explain the whole topic — target only the
gaps listed below. Be encouraging, acknowledge what they got right first,
then clarify the specific gap with a fresh example or analogy (don't
repeat the same explanation wording as before).`;
}

export function buildReteachUserPrompt(gap: {
  missing: string[];
  misunderstood: string[];
  coveredCorrectly: string[];
}): string {
  return `Missing: ${gap.missing.join(", ") || "none"}
Misunderstood: ${gap.misunderstood.join(", ") || "none"}
What they got right: ${gap.coveredCorrectly.join(", ") || "none"}`;
}

// Low temperature for structured/JSON steps, higher for natural explanation text.
export const ENGINE_TEMPERATURES = {
  conceptMap: 0.25,
  explanation: 0.65,
  checkpointQuestion: 0.3,
  gapDetection: 0.2,
  reteach: 0.65,
  resumeAnalysis: 0.3,
  interviewEvaluation: 0.25,
} as const;

// ---------------------------------------------------------------------------
// Career Prep: Resume Analyzer
// ---------------------------------------------------------------------------

export const RESUME_ANALYSIS_SYSTEM_PROMPT = `You are an ATS resume reviewer and career coach. Given a resume's text and
a target job role, evaluate how well the resume would perform in an
Applicant Tracking System screen and a human recruiter's first pass.

Return ONLY valid JSON, no other text:
{
  "atsScore": number (0-100),
  "strengths": string[],
  "suggestions": [{ "section": string, "issue": string, "suggestion": string }],
  "missingKeywords": string[]
}`;

export function buildResumeAnalysisUserPrompt(resumeText: string, targetRole: string): string {
  return `Target role: ${targetRole}

Resume text:
${resumeText}`;
}

// ---------------------------------------------------------------------------
// Career Prep: Mock Interviews
// ---------------------------------------------------------------------------

export const INTERVIEW_EVALUATION_SYSTEM_PROMPT = `You are a strict but fair interview evaluator. Compare the candidate's
answer to the interview question and assess it the way a real interviewer
would — reward correct substance and clear communication, don't reward
vague or padded answers.

Return ONLY valid JSON, no other text:
{
  "score": number (0-100),
  "feedback": string (2-3 sentences, specific and actionable),
  "strengths": string[],
  "improvements": string[]
}`;

export function buildInterviewEvaluationUserPrompt(question: string, answer: string): string {
  return `Question: ${question}
Candidate's answer: ${answer}`;
}
