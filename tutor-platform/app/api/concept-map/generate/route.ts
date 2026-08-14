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
// nodeType is validated as a plain string, not z.enum(...).catch(...) — that
// combination has an inconsistent TypeScript output type across Zod patch
// versions. Validating loosely here and normalizing explicitly in code below
// has an output type that can't drift between Zod versions.
const VALID_NODE_TYPES = ["concept", "dsa", "mcq", "hr", "aptitude", "core_subject"] as const;
type NodeType = (typeof VALID_NODE_TYPES)[number];

function normalizeNodeType(value: string | undefined): NodeType {
  return (VALID_NODE_TYPES as readonly string[]).includes(value ?? "")
    ? (value as NodeType)
    : "concept"; // falls back if the model omits it or sends something invalid
}

const nodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  parentId: z.string().nullable(),
  summary: z.string(),
  difficulty: z.enum(["foundational", "intermediate", "advanced"]),
  dependsOn: z.array(z.string()),
  nodeType: z.string().optional(),
});

const conceptMapSchema = z.object({
  rootTopic: z.string(),
  nodes: z.array(nodeSchema).min(1),
});

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
      void supabase.rpc("bump_cache_hit", { p_cache_key: cacheKey });
    }
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

    await supabase
      .from("concept_map_cache")
      .insert({ cache_key: cacheKey, generated_json: conceptMapData })
      .then(
        () => {},
        () => {}
      );
  }

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
    parent_id: null,
    summary: node.summary,
    difficulty: node.difficulty,
    depends_on: node.dependsOn,
    node_type: normalizeNodeType(node.nodeType),
    position: index,
  }));

  const { error: nodesError } = await supabase.from("concept_nodes").insert(nodeRows);
  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  return NextResponse.json({ conceptMap }, { status: 201 });
}