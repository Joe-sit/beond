// beond — verify a payer tax id against DBD (the official juristic-person
// registry). Given a 13-digit id + the bond's issuer name, it asks DBD for the
// company name behind that number and checks it matches the issuer. On a match
// the id is written to the shared catalog as VERIFIED and propagated to every
// other bond of the same issuer that has no verified id yet. On a mismatch it
// writes nothing to the catalog — the caller keeps the raw value locally.
//
// DBD OpenAPI (id → name) is free and needs no key. Any authenticated user may
// call this; the write is a trust upgrade gated by DBD, not by the caller.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { namesMatch } from "../_shared/dbd.ts";
import { lookupJuristic } from "../_shared/dbdRegistry.ts";

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

  // Require a valid session (any authenticated user), not admin.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthenticated" });
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json(401, { error: "unauthenticated" });

  let body: { taxId?: string; symbol?: string; lookupOnly?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const id = (body.taxId ?? "").replace(/\D/g, "");
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (id.length !== 13) return json(400, { error: "taxId must be 13 digits" });

  // Lookup-only: just return DBD's official name for the id — no DB read, no
  // write, no trust decision. The client uses it for live UI feedback while
  // typing; nothing is persisted until a real (symbol-resolved) save.
  if (body.lookupOnly) {
    const r = await lookupJuristic(admin, id);
    if (r.status === "found") return json(200, { verified: false, officialName: r.name, reason: "match" });
    // "error" must not read as "no such company" — the caller shows a retry
    // hint instead of telling the user their correct id is unknown.
    return json(200, { verified: false, officialName: null, reason: r.status === "not_found" ? "not_found" : "error" });
  }

  if (!symbol) return json(400, { error: "symbol required" });

  // The issuer to verify against MUST come from the catalog, not the client —
  // otherwise a caller could forge an issuer that matches any DBD name and
  // poison the shared row. Resolve the bond's authoritative issuer server-side.
  const { data: bond } = await admin
    .from("bonds")
    .select("issuer")
    .eq("symbol", symbol)
    .maybeSingle();
  const issuer = (bond?.issuer ?? "").trim();
  if (!issuer) return json(404, { verified: false, officialName: null, reason: "not_found" });

  const lookup = await lookupJuristic(admin, id);
  if (lookup.status !== "found") {
    return json(200, {
      verified: false,
      officialName: null,
      reason: lookup.status === "not_found" ? "not_found" : "error",
    });
  }
  const officialName = lookup.name;
  // Compare DBD's official name against the DB issuer (authoritative).
  const verified = namesMatch(officialName, issuer);

  // Only a verified id is written to the shared catalog (trust upgrade). Both the
  // exact symbol and the issuer-wide fan-out use the DB issuer, so a client can't
  // steer the write to arbitrary rows.
  if (verified) {
    await admin
      .from("bonds")
      .update({ payer_tax_id: id, payer_tax_id_verified: true, payer_verified_name: officialName })
      .eq("symbol", symbol);
    await admin
      .from("bonds")
      .update({ payer_tax_id: id, payer_tax_id_verified: true, payer_verified_name: officialName })
      .eq("issuer", issuer)
      .eq("payer_tax_id_verified", false);
  }

  return json(200, { verified, officialName, reason: verified ? "match" : "name_mismatch" });
});
