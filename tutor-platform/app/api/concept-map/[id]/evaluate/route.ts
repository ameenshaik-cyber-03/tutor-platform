// Prompt 4 — the core diagnostic step. Compares the user's answer to the node,
// writes a checkpoint_attempts row, and updates concept_nodes.status.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GAP_DETECTION_SYSTEM_PROMPT, buildGapDetectionUserPrompt, ENGINE_TEMPERATURES } from "@/lib/engine/prompts";
import { callLLMJSON } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

const gapSchema = z.object({
  coveredCorrectly: z.array(z.string()),
  missing: z.array(z.string()),
  misunderstood: z.array(z.string()),
  overallStatus: z.enum(["mastered", "weak", "not_understood"]),
  encouragingSummary: z.string(),
});

const bodySchema = z.object({
  nodeId: z.string().uuid(),
  sessionId: z.string().uuid(),
  userAnswer: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "concept-map-evaluate", 40, 600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests — slow down a little." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { nodeId, sessionId, userAnswer } = parsed.data;

  const { data: node, error: nodeError } = await supabase
    .from("concept_nodes")
    .select("*")
    .eq("id", nodeId)
    .single();
  if (nodeError || !node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  let gapData: z.infer<typeof gapSchema>;
  try {
    gapData = await callLLMJSON(
      {
        system: GAP_DETECTION_SYSTEM_PROMPT,
        user: buildGapDetectionUserPrompt(node as any, userAnswer),
        temperature: ENGINE_TEMPERATURES.gapDetection,
      },
      gapSchema
    );
  } catch (err) {
    logError("concept-map/evaluate LLM call failed", err, { userId: user.id, nodeId, sessionId });
    return NextResponse.json({ error: err instanceof Error ? err.message : "LLM call failed" }, { status: 502 });
  }

  // "not_understood" is a model-facing distinction for tone; the DB only
  // tracks mastered/weak/untouched (see database-schema.sql check constraint).
  const dbStatus = gapData.overallStatus === "not_understood" ? "weak" : gapData.overallStatus;

  const { error: insertError } = await supabase.from("checkpoint_attempts").insert({
    session_id: sessionId,
    node_id: nodeId,
    user_answer: userAnswer,
    covered_correctly: gapData.coveredCorrectly,
    missing: gapData.missing,
    misunderstood: gapData.misunderstood,
    overall_status: gapData.overallStatus,
    encouraging_summary: gapData.encouragingSummary,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("concept_nodes")
    .update({ status: dbStatus, last_assessed_at: new Date().toISOString() })
    .eq("id", nodeId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(gapData);
}
