// Resume Analyzer — reuses the same validate -> LLM -> validate -> persist
// pattern as the concept-map engine, applied to an ATS-style checklist.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  RESUME_ANALYSIS_SYSTEM_PROMPT,
  buildResumeAnalysisUserPrompt,
  ENGINE_TEMPERATURES,
} from "@/lib/engine/prompts";
import { callLLMJSON } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";

// NOTE: accepts pasted resume text for now, not a file upload. Real PDF
// upload (Supabase Storage + text extraction) is a follow-up — see README.
// Capped at 20k chars — a real resume is a few thousand; anything wildly
// longer is either not a resume or an attempt to run up API costs.
const requestSchema = z.object({
  resumeText: z.string().min(50, "Resume text looks too short to analyze").max(20000),
  targetRole: z.string().min(2).max(100),
});

const feedbackSchema = z.object({
  atsScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  suggestions: z.array(
    z.object({ section: z.string(), issue: z.string(), suggestion: z.string() })
  ),
  missingKeywords: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "resume-analyze", 8, 600);
  if (!allowed) {
    return NextResponse.json(
      { error: "You're submitting resumes too quickly. Wait a bit and try again." },
      { status: 429 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { resumeText, targetRole } = parsed.data;

  let feedbackData: z.infer<typeof feedbackSchema>;
  try {
    feedbackData = await callLLMJSON(
      {
        system: RESUME_ANALYSIS_SYSTEM_PROMPT,
        user: buildResumeAnalysisUserPrompt(resumeText, targetRole),
        temperature: ENGINE_TEMPERATURES.resumeAnalysis,
        maxTokens: 1500,
      },
      feedbackSchema
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM call failed" },
      { status: 502 }
    );
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .insert({ user_id: user.id, file_url: "pasted-text", target_role: targetRole })
    .select()
    .single();
  if (resumeError || !resume) {
    return NextResponse.json({ error: resumeError?.message }, { status: 500 });
  }

  const { data: feedback, error: feedbackError } = await supabase
    .from("resume_feedback")
    .insert({
      resume_id: resume.id,
      ats_score: feedbackData.atsScore,
      strengths: feedbackData.strengths,
      suggestions: feedbackData.suggestions,
      missing_keywords: feedbackData.missingKeywords,
    })
    .select()
    .single();
  if (feedbackError) {
    return NextResponse.json({ error: feedbackError.message }, { status: 500 });
  }

  await supabase.from("readiness_snapshots").insert({
    user_id: user.id,
    area: "resume",
    score: feedbackData.atsScore,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
