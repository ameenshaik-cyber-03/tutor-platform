# Core Diagnostic Engine — Design Spec

This is the shared engine behind both **Tutor mode** and **Career Prep mode**.
One engine, two `mode` values (`"learn"` | `"prep"`), same pipeline.

---

## 1. The Concept Map Schema

Everything hangs off this one JSON structure. Generate it once per topic/role, store it in Postgres (JSONB column), and reuse it across the whole session.

```typescript
interface ConceptMap {
  id: string;
  mode: "learn" | "prep";
  rootTopic: string;          // e.g. "Binary Search Trees" or "SDE-1 Interview Prep"
  roleContext?: string;       // only for "prep" mode, e.g. "Product-based SDE"
  nodes: ConceptNode[];
  createdAt: string;
}

interface ConceptNode {
  id: string;                 // short slug, e.g. "bst-insertion"
  title: string;               // "BST Insertion"
  parentId: string | null;     // null = top-level node
  summary: string;             // 1-2 sentence description of what this node covers
  difficulty: "foundational" | "intermediate" | "advanced";
  dependsOn: string[];         // node ids that should be understood first
  status: "untouched" | "weak" | "mastered";  // updated as user progresses
  lastAssessedAt: string | null;
}
```

Why this shape matters: `dependsOn` lets you order teaching/prep logically, `status` per node is what powers your "concept map visualization" panel and the readiness dashboard, and re-using the same schema for `learn` and `prep` is what avoids building two systems.

---

## 2. Prompt 1 — Generate the Concept Map

Called once when a user starts a new topic (learn) or selects a role (prep).

**System prompt:**
```
You are an expert curriculum designer. Given a topic or job role, break it
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
      "dependsOn": string[] (ids of prerequisite nodes)
    }
  ]
}
```

**User message (learn mode):**
```
Topic: {{topic}}
Mode: learn
Generate the concept map for a student learning this from scratch.
```

**User message (prep mode):**
```
Role: {{jobRole}}
Company tier: {{companyTier}}   // e.g. "Product-based", "PSU", "Core Mechanical"
Mode: prep
Generate the concept map of skill areas a candidate needs to master to
clear interviews for this role. Include both technical and non-technical
areas (e.g. DSA, CS fundamentals, aptitude, HR/behavioral, domain-specific
core subjects if applicable).
```

**Note on GATE/core branches:** since this is fully LLM-generated at runtime rather than hardcoded, "all branches" is just a different string passed into the same prompt — no extra engineering needed to support a new branch.

---

## 3. Prompt 2 — Explain a Node (the teaching/prep-briefing step)

Called when the user reaches a node, or requests explanation.

**System prompt:**
```
You are {{tutorPersona}}, an engaging tutor. Explain the given concept
node thoroughly but clearly: what it is, why it matters, how it connects
to {{parentTopic}}, and one concrete real-world example. Keep it
conversational, not textbook-dry. End with a short check: tell the user
you'll ask them to explain it back in their own words next.
```

**User message:**
```
Node: {{node.title}}
Summary: {{node.summary}}
Difficulty level: {{node.difficulty}}
Prior context (already covered): {{list of mastered node titles}}
```

This is a plain streaming text response — no JSON needed here, since it's rendered directly in the chat.

---

## 4. Prompt 3 — Generate the Checkpoint Question

**Learn mode** → "explain it back" prompt.
**Prep mode** → mock interview question / MCQ / coding problem, depending on node type.

**System prompt (learn mode):**
```
Ask the user a single open-ended question that requires them to explain
"{{node.title}}" back in their own words. Do not ask a yes/no or
multiple-choice question — you need to see their reasoning to diagnose
gaps.
```

**System prompt (prep mode):**
```
Generate ONE interview-style question for the skill area "{{node.title}}"
appropriate for a {{jobRole}} candidate. If this is a DSA/coding node,
give a coding problem statement. If HR/behavioral, give a STAR-format
question. If aptitude/MCQ-style, generate one MCQ with 4 options.
Return JSON:
{
  "questionType": "open" | "coding" | "mcq",
  "question": string,
  "options": string[] | null,
  "correctOption": string | null
}
```

---

## 5. Prompt 4 — Gap Detection (the core diagnostic step)

This is the most important prompt in the whole system — it's what separates you from a generic chatbot.

**System prompt:**
```
You are a diagnostic evaluator. Compare the user's answer against the
reference concept node. Identify exactly which parts are correct,
which are missing, and which are misunderstood. Be specific — point to
the sub-idea, not just "partially correct."

Return ONLY JSON:
{
  "coveredCorrectly": string[],   // sub-ideas the user got right
  "missing": string[],             // sub-ideas they didn't mention at all
  "misunderstood": string[],       // sub-ideas they got wrong, with what they said vs reality
  "overallStatus": "mastered" | "weak" | "not_understood",
  "encouragingSummary": string     // 1-2 sentence encouraging summary to show the user
}
```

**User message:**
```
Concept node: {{node.title}}
Reference summary: {{node.summary}}
User's answer: {{userAnswer}}
```

`overallStatus` writes directly back into `ConceptNode.status` — this is the update that drives your concept-map visualization and readiness dashboard.

---

## 6. Prompt 5 — Targeted Re-teach

Only called when `overallStatus` is `"weak"` or `"not_understood"`.

**System prompt:**
```
You are {{tutorPersona}}. The user misunderstood or missed specific parts
of "{{node.title}}". Do NOT re-explain the whole topic — target only the
gaps listed below. Be encouraging, acknowledge what they got right first,
then clarify the specific gap with a fresh example or analogy (don't
repeat the same explanation wording as before).
```

**User message:**
```
Missing: {{gapResult.missing}}
Misunderstood: {{gapResult.misunderstood}}
What they got right: {{gapResult.coveredCorrectly}}
```

---

## 7. End-to-End Example (learn mode)

```
User → "I want to learn Binary Search Trees"

[Prompt 1] → concept map generated:
  bst-basics (foundational)
  bst-insertion (depends on: bst-basics)
  bst-deletion (depends on: bst-insertion)
  bst-traversal (depends on: bst-basics)
  bst-balancing (advanced, depends on: bst-deletion)

[Prompt 2] → explains "bst-basics" with example
[Prompt 3] → "Can you explain in your own words what makes a tree a BST?"
User → "It's a tree where left is smaller and right is bigger"

[Prompt 4] → gap detection:
  coveredCorrectly: ["left/right ordering property"]
  missing: ["uniqueness of values", "recursive definition applies at every node, not just root"]
  overallStatus: "weak"

[Prompt 5] → re-teach targeting just the two missing points
  → loop back to Prompt 3 with a new question
```

---

## 8. API Route Sketch

```
POST /api/concept-map/generate     { topic | role, mode }        → ConceptMap
POST /api/concept-map/:id/explain  { nodeId, personaId }         → streamed text
POST /api/concept-map/:id/question { nodeId }                    → question JSON
POST /api/concept-map/:id/evaluate { nodeId, userAnswer }        → gap result JSON, updates node.status
POST /api/concept-map/:id/reteach  { nodeId, gapResult }         → streamed text
GET  /api/concept-map/:id                                        → full map (for visualization panel)
```

---

## 9. Model & Config Notes

- Use **low temperature (0.2–0.3)** for Prompts 1, 3 (mcq/prep), and 4 — these need structure and consistency, not creativity.
- Use **higher temperature (0.6–0.7)** for Prompts 2 and 5 — explanations should feel natural and varied, not robotic.
- Always request **strict JSON output** for 1, 3, and 4 — validate with a schema library (e.g. Zod) before saving to DB, and retry once if parsing fails.
- Cache Prompt 1 results per unique topic string (Redis) — regenerating the same concept map repeatedly wastes tokens.
