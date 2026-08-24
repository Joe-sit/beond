// DBD lookups backed by the verified pool (public.dbd_registry).
//
// The registry is write-once-from-DBD: a row exists only because DBD returned
// that name for that number, and the table grants no write to anyone but
// service_role. So a cache hit carries the same guarantee as a live call —
// which matters, because the live call takes 7–11s and is behind a WAF that
// drops requests.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { dbdLookup, type DbdResult } from "./dbd.ts";

/**
 * Official name for a 13-digit juristic id: pool first, DBD second, and a
 * successful DBD answer is added to the pool.
 *
 * A `not_found` is deliberately NOT cached — a company registered tomorrow would
 * otherwise stay unknown forever.
 */
export async function lookupJuristic(admin: SupabaseClient, id: string): Promise<DbdResult> {
  const { data: hit } = await admin
    .from("dbd_registry")
    .select("official_name")
    .eq("tax_id", id)
    .maybeSingle();
  if (hit?.official_name) return { status: "found", name: hit.official_name as string };

  const live = await dbdLookup(id);
  if (live.status === "found") {
    // Best-effort: a failed write costs a future lookup, nothing more.
    const { error } = await admin
      .from("dbd_registry")
      .upsert({ tax_id: id, official_name: live.name, verified_at: new Date().toISOString() });
    if (error) console.error("dbd_registry upsert:", error.message);
  }
  return live;
}
