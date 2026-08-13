import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

// Checks and increments a user's request count for a given endpoint. Returns
// false once they've hit the limit within the current window.
//
// Deliberately fails OPEN (returns true) if the check itself errors — a
// rate-limiter outage should degrade to "unlimited" rather than take the
// whole app down, but the error is logged so it doesn't go unnoticed.
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    logError("Rate limit check failed", error, { endpoint, userId });
    return true;
  }

  return Boolean(data);
}
