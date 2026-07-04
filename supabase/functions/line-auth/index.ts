// beond — exchange a LINE LIFF id_token for a real Supabase session.
//
// The frontend logs in with LIFF (client-side) and gets an id_token. This
// function verifies it with LINE, ensures a matching Supabase auth user exists
// (linked to our public.users row), and returns a magic-link token_hash that
// the frontend redeems with supabase.auth.verifyOtp() to obtain a genuine
// session — signed by the project's current (ECC) JWT key, so it survives key
// rotation. No hand-minted JWTs, no legacy HS256 dependency.
//
// The auth user carries `public_user_id` in app_metadata → included in the JWT
// → RLS policies scope rows with (auth.jwt()->'app_metadata'->>'public_user_id').
//
// Env: LINE_LOGIN_CHANNEL_ID (aud of id_token; defaults to the LIFF channel).
//      SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_LOGIN_CHANNEL_ID = Deno.env.get("LINE_LOGIN_CHANNEL_ID") ?? "2010595004";
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

// Synthetic, unique, non-deliverable email per LINE user (no SMTP is used —
// generateLink returns the token directly).
const emailFor = (lineUserId: string) => `line_${lineUserId}@beond.app`;

interface LineVerify {
  sub: string;
  name?: string;
  picture?: string;
}

async function verifyLineIdToken(idToken: string): Promise<LineVerify> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error(`line verify ${res.status}: ${await res.text()}`);
  return await res.json();
}

// Ensure a public.users row exists for this LINE user; returns its uuid.
async function ensurePublicUser(v: LineVerify): Promise<string> {
  const { data: existing } = await admin
    .from("users").select("id").eq("line_user_id", v.sub).maybeSingle();
  if (existing) {
    await admin.from("users")
      .update({ display_name: v.name ?? "LINE user", picture_url: v.picture ?? null })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin
    .from("users")
    .insert({ line_user_id: v.sub, display_name: v.name ?? "LINE user", picture_url: v.picture ?? null })
    .select("id").single();
  if (error) throw new Error(`insert user: ${error.message}`);
  return data.id;
}

// Ensure an auth.users exists for this LINE user, carrying public_user_id in
// app_metadata. Returns the email used (for verifyOtp on the client).
async function ensureAuthUser(lineUserId: string, publicUserId: string, v: LineVerify): Promise<string> {
  const email = emailFor(lineUserId);
  const appMeta = { provider: "line", line_user_id: lineUserId, public_user_id: publicUserId };

  // Look up existing auth user by our stored id on public.users first.
  const { data: pub } = await admin
    .from("users").select("auth_user_id").eq("id", publicUserId).maybeSingle();

  if (pub?.auth_user_id) {
    await admin.auth.admin.updateUserById(pub.auth_user_id, {
      app_metadata: appMeta,
      user_metadata: { name: v.name, picture: v.picture },
    });
    return email;
  }

  // Create; if the email already exists (e.g. prior run), fall back to linking.
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: appMeta,
    user_metadata: { name: v.name, picture: v.picture },
  });
  let authId = created?.user?.id;
  if (error || !authId) {
    // Find the existing auth user with this email.
    const { data: list } = await admin.auth.admin.listUsers();
    authId = list?.users.find((u) => u.email === email)?.id;
    if (!authId) throw new Error(`create auth user: ${error?.message ?? "unknown"}`);
    await admin.auth.admin.updateUserById(authId, { app_metadata: appMeta });
  }
  await admin.from("users").update({ auth_user_id: authId }).eq("id", publicUserId);
  return email;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

  try {
    const { id_token } = await req.json();
    if (!id_token) throw new Error("missing id_token");

    const verified = await verifyLineIdToken(id_token);
    const publicUserId = await ensurePublicUser(verified);
    const email = await ensureAuthUser(verified.sub, publicUserId, verified);

    // Mint a magic-link token the client redeems for a real session.
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data?.properties?.hashed_token) {
      throw new Error(`generateLink: ${error?.message ?? "no token"}`);
    }

    return new Response(
      JSON.stringify({
        token_hash: data.properties.hashed_token,
        user: {
          id: publicUserId,
          displayName: verified.name ?? "LINE user",
          pictureUrl: verified.picture ?? null,
        },
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("line-auth failed:", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
