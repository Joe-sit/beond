// beond — delete a user's accumulated 50-ทวิ slips for one bond, server-side.
//
// Why an edge function: the confirmed tax_documents are linked to a bond by
// bond_id only (holding_id is null for every LINE-OCR / web-confirm slip), so
// the holdings FK cascade never removes them. And a client-side delete on
// tax_documents is blocked by RLS in practice (it silently removes 0 rows),
// leaving slips behind after a holding is deleted — they then reappear when the
// bond is re-added. Running with the service role bypasses RLS, and scoping the
// delete to (user_id = caller, bond_id) keeps it to the caller's own rows for
// this bond only (a client bond_id-only delete would hit every user's slips).
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // Require a valid session; the delete is scoped to the caller's own rows.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthenticated" });
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json(401, { error: "unauthenticated" });
  const publicUserId = auth.user.app_metadata?.public_user_id as string | undefined;
  if (!publicUserId) return json(403, { error: "no user" });

  let body: { bondId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const bondId = (body.bondId ?? "").trim();
  if (!bondId) return json(400, { error: "bondId required" });

  // service_role bypasses RLS; the explicit user_id filter keeps it to the
  // caller's slips for this bond only.
  const { data, error } = await admin
    .from("tax_documents")
    .delete()
    .eq("user_id", publicUserId)
    .eq("bond_id", bondId)
    .select("id");
  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, deleted: data?.length ?? 0 });
});
