// Prompt 5 — targeted re-explanation of only the gaps identified by /evaluate.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReteachSystemPrompt, buildReteachUserPrompt, ENGINE_TEMPERATURES } from "@/lib/engine/prompts";
import { callLLMStream } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { nodeId, personaId, gapResult } = await req.json();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "concept-map-reteach", 40, 600);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests — slow down a little." }),
      { status: 429, headers: { "content-type": "application/json" } }
    );
  }

  const { data: node, error: nodeError } = await supabase
    .from("concept_nodes")
    .select("title")
    .eq("id", nodeId)
    .single();
  if (nodeError || !node) return new Response("Node not found", { status: 404 });

  let personaStyle = "an encouraging, clear tutor";
  if (personaId) {
    const { data: persona } = await supabase
      .from("tutor_personas")
      .select("name, style_description")
      .eq("id", personaId)
      .single();
    if (persona) personaStyle = `${persona.name}, whose teaching style is: ${persona.style_description}`;
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await callLLMStream({
      system: buildReteachSystemPrompt(personaStyle, node.title),
      user: buildReteachUserPrompt(gapResult),
      temperature: ENGINE_TEMPERATURES.reteach,
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "LLM call failed", { status: 502 });
  }

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
