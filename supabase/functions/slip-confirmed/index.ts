// beond — push a "slip collected" confirmation to the user's LINE chat after
// they confirm a 50-ทวิ slip on the web (the LINE deep-link review flow). The
// chat has no reply on a web confirm, so this closes the loop: it tells the user
// the credit was saved, in the same channel the slip arrived on.
//
// Only the owner of the document may trigger its notification (checked against
// the caller's public_user_id), and only a slip that is actually `confirmed` is
// announced — so a replayed request can't spam a chat.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically;
//      LINE_MESSAGING_ACCESS_TOKEN set as an Edge Function secret (shared with
//      the line-webhook function).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildSavedFlex } from "../_shared/savedSlip.ts";
import { autoAddHolding } from "../_shared/autoHolding.ts";
import { buildAddedBondFlex } from "../_shared/addedBond.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN") ?? "";
const LIFF_ID = Deno.env.get("LIFF_ID") ?? "2010595004-4xF6RZlS";
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

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

async function linePush(to: string, messages: unknown[]): Promise<void> {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) console.error(`push ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // Require a valid session; the notification is scoped to the caller's own doc.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthenticated" });
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json(401, { error: "unauthenticated" });
  const publicUserId = auth.user.app_metadata?.public_user_id as string | undefined;
  if (!publicUserId) return json(403, { error: "no user" });

  let body: { documentId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const id = (body.documentId ?? "").trim();
  if (!id) return json(400, { error: "documentId required" });

  // Load the doc + confirm ownership + status. Only a confirmed slip owned by the
  // caller is announced — anything else is a silent no-op (never an error the
  // client must handle).
  const { data: doc } = await admin
    .from("tax_documents")
    .select("user_id, status, bond_id")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.user_id !== publicUserId || doc.status !== "confirmed") {
    return json(200, { ok: true, pushed: false });
  }

  const docBond = (doc.bond_id as string | null) ?? null;

  // Confirming on the web must land the bond in the portfolio exactly as
  // confirming in chat does — the slip is the same slip, and a user who reviewed
  // it on the LIFF page shouldn't end up with an unmatched credit. Runs before
  // the LINE checks below: the portfolio write is the point, the push is not.
  let added = null;
  try {
    added = await autoAddHolding(admin, doc.user_id as string, docBond, id);
  } catch (e) {
    // The credit is saved either way; an auto-add failure just leaves the slip
    // unmatched until the bond is added by hand.
    console.error("autoAddHolding failed (continuing):", (e as Error).message);
  }

  // Resolve the user's LINE id (the card resolves the bond itself).
  const { data: user } = await admin
    .from("users").select("line_user_id").eq("id", doc.user_id).maybeSingle();
  const lineUserId = user?.line_user_id as string | undefined;
  if (!lineUserId || !LINE_TOKEN) {
    return json(200, { ok: true, pushed: false, added: added ? added.facts.symbol : null });
  }

  const messages: unknown[] = [await buildSavedFlex(admin, doc.user_id as string, id, LIFF_URL)];
  if (added) {
    messages.unshift(buildAddedBondFlex(added.facts, added.faceValue, added.installments, LIFF_URL));
  }

  await linePush(lineUserId, messages);
  return json(200, { ok: true, pushed: true, added: added ? added.facts.symbol : null });
});
