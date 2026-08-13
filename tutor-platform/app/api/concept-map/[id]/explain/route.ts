// Prompt 2 — streams the tutor's explanation of a node.
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExplainSystemPrompt, buildExplainUserPrompt, ENGINE_TEMPERATURES } from "@/lib/engine/prompts";
import { callLLMStream } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { nodeId, personaId } = await req.json();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const allowed = await enforceRateLimit(supabase, user.id, "concept-map-explain", 40, 600);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests — slow down a little." }),
      { status: 429, headers: { "content-type": "application/json" } }
    );
  }

  const { data: node, error: nodeError } = await supabase
    .from("concept_nodes")
    .select("*")
    .eq("id", nodeId)
    .eq("concept_map_id", params.id)
    .single();
  if (nodeError || !node) return new Response("Node not found", { status: 404 });

  const { data: conceptMap } = await supabase
    .from("concept_maps")
    .select("root_topic")
    .eq("id", params.id)
    .single();

  let personaStyle = "an encouraging, clear tutor";
  if (personaId) {
    const { data: persona } = await supabase
      .from("tutor_personas")
      .select("name, style_description")
      .eq("id", personaId)
      .single();
    if (persona) personaStyle = `${persona.name}, whose teaching style is: ${persona.style_description}`;
  }

  const { data: masteredNodes } = await supabase
    .from("concept_nodes")
    .select("title")
    .eq("concept_map_id", params.id)
    .eq("status", "mastered");

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await callLLMStream({
      system: buildExplainSystemPrompt(personaStyle, conceptMap?.root_topic ?? "this topic"),
      user: buildExplainUserPrompt(node as any, (masteredNodes ?? []).map((n) => n.title)),
      temperature: ENGINE_TEMPERATURES.explanation,
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "LLM call failed", { status: 502 });
  }

  // NOTE: streaming responses can't use the callLLMJSON retry pattern since
  // there's no JSON to validate — a failure mid-stream just ends the stream.
  // The client (LearnSessionClient) surfaces whatever text arrived; a fully
  // empty/failed stream is a known gap, see README's Step 10 notes.

  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
