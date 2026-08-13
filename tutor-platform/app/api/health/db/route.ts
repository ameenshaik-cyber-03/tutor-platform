import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/health/db
// Visit this in the browser after setup to confirm Next.js can actually
// reach Supabase and read from a real table — before building anything
// that depends on it. A green response here means the connection layer
// (env vars, client config, RLS read policy) is genuinely working.
export async function GET() {
  const supabase = createClient();

  const startedAt = Date.now();
  const { data, error, count } = await supabase
    .from("tutor_personas")
    .select("id, name", { count: "exact" })
    .eq("is_active", true);

  const latencyMs = Date.now() - startedAt;

  if (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        hint: "Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, and confirm database-schema.sql + supabase/seed.sql have been run against your project.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    latencyMs,
    tutorPersonasFound: count ?? data?.length ?? 0,
    sample: data,
  });
}
