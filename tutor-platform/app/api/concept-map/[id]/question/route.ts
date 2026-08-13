// Prompt 3 — generates a checkpoint question (learn mode) or interview-style question (prep mode).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CHECKPOINT_QUESTION_LEARN_PROMPT,
  buildCheckpointPrepPrompt,
  ENGINE_TEMPERATURES,
} from "@/lib/engine/prompts";
import { callLLM, callLLMJSON } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";

const questionSchema = z.object({
  questionType: z.enum(["open", "coding", "mcq"]),
  question: z.string(),
  options: z.array(z.string()).nullable(),
  correctOption: z.string().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { nodeId } = await req.json();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "concept-map-question", 40, 600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests — slow down a little." }, { status: 429 });
  }

  const { data: node, error: nodeError } = await supabase
    .from("concept_nodes")
    .select("*")
    .eq("id", nodeId)
    .single();
  if (nodeError || !node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const { data: conceptMap } = await supabase
    .from("concept_maps")
    .select("mode, role_context")
    .eq("id", params.id)
    .single();

  const isPrep = conceptMap?.mode === "prep";

  if (isPrep) {
    // Prep-mode questions are already asked for JSON — use the validated path.
    let questionData: z.infer<typeof questionSchema>;
    try {
      questionData = await callLLMJSON(
        {
          system: buildCheckpointPrepPrompt(node as any, conceptMap?.role_context ?? "the target role"),
          user: "Generate the question now.",
          temperature: ENGINE_TEMPERATURES.checkpointQuestion,
        },
        questionSchema
      );
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "LLM call failed" }, { status: 502 });
    }
    return NextResponse.json(questionData);
  }

  // Learn-mode's prompt intentionally asks for a plain open question, not
  // JSON (it reads more naturally that way) — wrap it into the same shape.
  let raw: string;
  try {
    raw = await callLLM({
      system: CHECKPOINT_QUESTION_LEARN_PROMPT,
      user: `Concept: ${node.title}\nSummary: ${node.summary}`,
      temperature: ENGINE_TEMPERATURES.checkpointQuestion,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "LLM call failed" }, { status: 502 });
  }

  return NextResponse.json({ questionType: "open", question: raw, options: null, correctOption: null });
}
