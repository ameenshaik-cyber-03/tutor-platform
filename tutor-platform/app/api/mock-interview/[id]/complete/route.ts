// Finalizes a mock interview: computes the overall score and writes a
// readiness_snapshots row, which is what powers the readiness dashboard trend.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: questions, error: qError } = await supabase
    .from("mock_interview_questions")
    .select("score")
    .eq("mock_interview_id", params.id);
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const scores = (questions ?? []).map((q) => q.score ?? 0);
  const overallScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const { data: interview, error: updateError } = await supabase
    .from("mock_interviews")
    .update({ status: "completed", overall_score: overallScore, ended_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (interview) {
    await supabase.from("readiness_snapshots").insert({
      user_id: user.id,
      area: interview.interview_type,
      score: overallScore,
    });
  }

  return NextResponse.json({ overallScore, questionCount: scores.length });
}
