// Fetches the full concept map + nodes for the visualization panel.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: conceptMap, error: mapError } = await supabase
    .from("concept_maps")
    .select("*")
    .eq("id", params.id)
    .single();

  if (mapError) return NextResponse.json({ error: mapError.message }, { status: 404 });

  const { data: nodes, error: nodesError } = await supabase
    .from("concept_nodes")
    .select("*")
    .eq("concept_map_id", params.id)
    .order("position", { ascending: true });

  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 });

  return NextResponse.json({ conceptMap, nodes });
}
