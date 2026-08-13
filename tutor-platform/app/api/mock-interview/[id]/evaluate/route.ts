// Scores one interview answer and writes it to mock_interview_questions.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  INTERVIEW_EVALUATION_SYSTEM_PROMPT,
  buildInterviewEvaluationUserPrompt,
  ENGINE_TEMPERATURES,
} from "@/lib/engine/prompts";
import { callLLMJSON } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  nodeId: z.string().uuid().nullable(),
  questionType: z.enum(["open", "coding", "mcq"]),
  questionText: z.string().max(2000),
  options: z.array(z.string()).nullable().optional(),
  correctOption: z.string().nullable().optional(),
  userAnswer: z.string().min(1).max(5000),
});

const evalSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "mock-interview-evaluate", 40, 600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests — slow down a little." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { nodeId, questionType, questionText, options, correctOption, userAnswer } = parsed.data;

  let score: number;
  let evaluation: Record<string, unknown>;

  if (questionType === "mcq") {
    // MCQs are graded deterministically — no need to spend an LLM call on them.
    const correct = correctOption != null && userAnswer.trim() === correctOption.trim();
    score = correct ? 100 : 0;
    evaluation = {
      score,
      feedback: correct ? "Correct." : `Not quite — the correct answer was "${correctOption}".`,
      strengths: correct ? ["Selected the right option"] : [],
      improvements: correct ? [] : ["Review this topic before your next attempt"],
    };
  } else {
    let evalData: z.infer<typeof evalSchema>;
    try {
      evalData = await callLLMJSON(
        {
          system: INTERVIEW_EVALUATION_SYSTEM_PROMPT,
          user: buildInterviewEvaluationUserPrompt(questionText, userAnswer),
          temperature: ENGINE_TEMPERATURES.interviewEvaluation,
        },
        evalSchema
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "LLM call failed" },
        { status: 502 }
      );
    }
    score = evalData.score;
    evaluation = evalData;
  }

  const { error: insertError } = await supabase.from("mock_interview_questions").insert({
    mock_interview_id: params.id,
    node_id: nodeId,
    question_type: questionType,
    question_text: questionText,
    options: options ?? null,
    correct_option: correctOption ?? null,
    user_answer: userAnswer,
    evaluation,
    score,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ score, evaluation });
}
