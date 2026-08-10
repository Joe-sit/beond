// beond — admin catalog import. Receives a bond-catalog JSON ({ at, items })
// from the admin dashboard and stores it in the public `catalog` bucket as
// bond-catalog.json, so a refreshed SEC snapshot goes live without a redeploy.
//
// Access is gated to the same admin allowlist as the health function: the caller
// must present a valid Supabase session JWT whose LINE user id is in
// ADMIN_LINE_IDS. Writes use the service role.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically.
//      ADMIN_LINE_IDS (required).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_LINE_IDS = (Deno.env.get("ADMIN_LINE_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Verify the caller is an allow-listed admin; returns their line id or null.
async function authorizeAdmin(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  const lineId =
    (data.user.app_metadata?.line_user_id as string | undefined) ??
    (data.user.user_metadata?.line_user_id as string | undefined) ??
    null;
  if (lineId && ADMIN_LINE_IDS.includes(lineId)) return lineId;
  const pubId = data.user.app_metadata?.public_user_id as string | undefined;
  if (pubId) {
    const { data: u } = await admin.from("users").select("line_user_id").eq("id", pubId).maybeSingle();
    if (u?.line_user_id && ADMIN_LINE_IDS.includes(u.line_user_id)) return u.line_user_id;
  }
  return null;
}

interface CatalogItem {
  symbol: string;
  maturityDate?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const who = await authorizeAdmin(req);
  if (!who) return json(403, { error: "forbidden" });

  let body: { items?: CatalogItem[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: "expected a non-empty `items` array" });
  }
  // Shape sanity — every entry must at least carry a symbol.
  if (!items.every((it) => it && typeof it.symbol === "string" && it.symbol.length > 0)) {
    return json(400, { error: "every item needs a string `symbol`" });
  }

  const payload = JSON.stringify({ at: Date.now(), items });
  const { error } = await admin.storage
    .from("catalog")
    .upload("bond-catalog.json", new Blob([payload], { type: "application/json" }), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "60",
    });
  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, count: items.length, by: who });
});
