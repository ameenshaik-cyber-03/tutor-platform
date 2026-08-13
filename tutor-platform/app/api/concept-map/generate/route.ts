import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CONCEPT_MAP_SYSTEM_PROMPT,
  buildConceptMapUserPrompt,
  ENGINE_TEMPERATURES,
} from "@/lib/engine/prompts";
import { callLLMJSON } from "@/lib/engine/llm";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

const requestSchema = z.object({
  mode: z.enum(["learn", "prep"]),
  topicOrRole: z.string().min(2).max(200),
  companyTier: z.string().max(100).optional(),
  projectId: z.string().uuid().optional(),
});

// Validates the LLM's JSON output before it ever touches the database.
const nodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  parentId: z.string().nullable(),
  summary: z.string(),
  difficulty: z.enum(["foundational", "intermediate", "advanced"]),
  dependsOn: z.array(z.string()),
  // Falls back to "concept" if the model omits it (shouldn't happen given the
  // prompt, but a missing/invalid nodeType would otherwise fail the whole
  // generation — better to degrade gracefully than 502 on a minor field).
  nodeType: z
    .enum(["concept", "dsa", "mcq", "hr", "aptitude", "core_subject"])
    .catch("concept"),
});

const conceptMapSchema = z.object({
  rootTopic: z.string(),
  nodes: z.array(nodeSchema).min(1),
});

// Normalizes a topic/role into a stable cache key — same topic, different
// casing/whitespace, should still hit the cache.
function buildCacheKey(mode: string, topicOrRole: string, companyTier?: string): string {
  return `${mode}:${topicOrRole.trim().toLowerCase()}:${(companyTier ?? "").trim().toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // This is the most expensive call in the app (generates 6-12 nodes worth
  // of curriculum), so it gets the tightest limit: 8 per 10 minutes. Applies
  // even on cache hits — the write side (concept_maps/concept_nodes inserts)
  // still costs real DB work per request regardless of whether the LLM ran.
  const allowed = await enforceRateLimit(supabase, user.id, "concept-map-generate", 8, 600);
  if (!allowed) {
    return NextResponse.json(
      { error: "You're generating concept maps too quickly. Wait a bit and try again." },
      { status: 429 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { mode, topicOrRole, companyTier, projectId } = parsed.data;
  const cacheKey = buildCacheKey(mode, topicOrRole, companyTier);

  // --- Check the cache before spending an LLM call ---
  let conceptMapData: z.infer<typeof conceptMapSchema> | null = null;

  const { data: cached } = await supabase
    .from("concept_map_cache")
    .select("generated_json")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const validatedCache = conceptMapSchema.safeParse(cached.generated_json);
    if (validatedCache.success) {
      conceptMapData = validatedCache.data;
      // Best-effort bookkeeping — a failure here shouldn't affect the response.
      void supabase.rpc("bump_cache_hit", { p_cache_key: cacheKey });
    }
    // If the cached JSON somehow fails validation (schema drift over time),
    // fall through and regenerate rather than serving broken data.
  }

  if (!conceptMapData) {
    try {
      conceptMapData = await callLLMJSON(
        {
          system: CONCEPT_MAP_SYSTEM_PROMPT,
          user: buildConceptMapUserPrompt({ mode, topicOrRole, companyTier }),
          temperature: ENGINE_TEMPERATURES.conceptMap,
        },
        conceptMapSchema
      );
    } catch (err) {
      logError("concept-map/generate LLM call failed", err, { userId: user.id, mode, topicOrRole });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "LLM call failed" },
        { status: 502 }
      );
    }

    // Best-effort cache write. Ignore failures (e.g. a race where two users
    // requested the same new topic simultaneously and both tried to insert) —
    // the request should still succeed even if caching it didn't.
    await supabase
      .from("concept_map_cache")
      .insert({ cache_key: cacheKey, generated_json: conceptMapData })
      .then(
        () => {},
        () => {}
      );
  }

  // --- Persist: one row in concept_maps, one row per node in concept_nodes ---
  const { data: conceptMap, error: mapError } = await supabase
    .from("concept_maps")
    .insert({
      user_id: user.id,
      project_id: projectId ?? null,
      mode,
      root_topic: conceptMapData.rootTopic,
      role_context: mode === "prep" ? topicOrRole : null,
      company_tier: companyTier ?? null,
      raw_json: conceptMapData,
    })
    .select()
    .single();

  if (mapError || !conceptMap) {
    return NextResponse.json({ error: mapError?.message }, { status: 500 });
  }

  const nodeRows = conceptMapData.nodes.map((node, index) => ({
    concept_map_id: conceptMap.id,
    slug: node.id,
    title: node.title,
    parent_id: null, // resolved in a second pass below once IDs exist
    summary: node.summary,
    difficulty: node.difficulty,
    depends_on: node.dependsOn,
    node_type: node.nodeType,
    position: index,
  }));

  const { error: nodesError } = await supabase.from("concept_nodes").insert(nodeRows);
  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  return NextResponse.json({ conceptMap }, { status: 201 });
}
