// Server Component: fetches the concept map + nodes + user + a default
// persona, then hands off to LearnSessionClient, which drives the actual
// explain -> question -> evaluate -> reteach loop (Step 9).
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LearnSessionClient } from "@/components/learn/LearnSessionClient";
import { getCachedPersonas } from "@/lib/cached-queries";
import type { ConceptNode } from "@/lib/engine/types";

export default async function LearnSessionPage({
  params,
}: {
  params: { conceptMapId: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: conceptMap, error: mapError } = await supabase
    .from("concept_maps")
    .select("*")
    .eq("id", params.conceptMapId)
    .single();
  if (mapError || !conceptMap) notFound();

  const { data: nodeRows, error: nodesError } = await supabase
    .from("concept_nodes")
    .select("*")
    .eq("concept_map_id", params.conceptMapId)
    .order("position", { ascending: true });
  if (nodesError) notFound();

  const nodes: ConceptNode[] = (nodeRows ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    parentId: row.parent_id,
    summary: row.summary,
    difficulty: row.difficulty,
    dependsOn: row.depends_on ?? [],
    nodeType: row.node_type,
    status: row.status,
    lastAssessedAt: row.last_assessed_at,
  }));

  // Use the user's saved preference if set, otherwise fall back to whichever
  // persona is first — see user_preferences.preferred_persona_id in the schema.
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("preferred_persona_id")
    .eq("user_id", user.id)
    .single();

  let personaId = preferences?.preferred_persona_id ?? null;
  if (!personaId) {
    const personas = await getCachedPersonas();
    personaId = personas[0]?.id ?? null;
  }

  return (
    <LearnSessionClient
      conceptMapId={params.conceptMapId}
      rootTopic={conceptMap.root_topic}
      initialNodes={nodes}
      userId={user.id}
      personaId={personaId}
    />
  );
}
