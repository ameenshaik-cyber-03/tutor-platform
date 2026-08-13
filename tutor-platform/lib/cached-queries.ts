import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Deliberately NOT using lib/supabase/server.ts's cookie-based client here.
// unstable_cache's whole point is caching independent of the current
// request, so reading request-scoped cookies inside it fights the caching
// model (and Next.js explicitly disallows headers()/cookies() inside a
// cached function). tutor_personas' RLS policy allows any authenticated
// role to read it regardless of *which* user — no cookies needed at all.
function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// tutor_personas is effectively static seed data — it changes only when you
// add a new persona, not per-request. Caching it avoids a DB round trip on
// every page that needs the list (Settings, the Learn session page's
// default-persona lookup).
export const getCachedPersonas = unstable_cache(
  async () => {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("tutor_personas")
      .select("id, name, style_description")
      .eq("is_active", true);
    return data ?? [];
  },
  ["tutor-personas"],
  { revalidate: 3600, tags: ["tutor-personas"] }
);
