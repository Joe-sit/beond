// beond — permanently delete the caller's account and ALL their data.
//
// Irreversible. Scoped strictly to the caller: the public_user_id + auth uid come
// from the verified session JWT, never from the request body. Deleting the public
// `users` row cascades holdings → payouts, tax_documents, and scan_usage (FKs are
// ON DELETE CASCADE); slip images in storage are removed first (not covered by the
// DB cascade), then the auth user is deleted so no orphan login remains.
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

  // Identify the caller from their session — the ONLY account we may delete.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthenticated" });
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json(401, { error: "unauthenticated" });
  const authUid = auth.user.id;
  const publicUserId = auth.user.app_metadata?.public_user_id as string | undefined;
  if (!publicUserId) return json(403, { error: "no user" });

  // 1) Remove the caller's slip images from storage (not part of the DB cascade).
  try {
    const { data: docs } = await admin
      .from("tax_documents").select("image_path").eq("user_id", publicUserId);
    const paths = (docs ?? [])
      .map((d) => (d as { image_path: string | null }).image_path)
      .filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from("tax-slips").remove(paths);
  } catch (e) {
    console.error("storage cleanup (skip):", (e as Error).message);
  }

  // 2) Delete the public user row → cascades holdings/payouts/tax_documents/scan_usage.
  const { error: delErr } = await admin.from("users").delete().eq("id", publicUserId);
  if (delErr) return json(500, { error: delErr.message });

  // 3) Delete the auth user so no orphan login remains (best-effort).
  try {
    await admin.auth.admin.deleteUser(authUid);
  } catch (e) {
    console.error("auth delete (skip):", (e as Error).message);
  }

  return json(200, { ok: true });
});
