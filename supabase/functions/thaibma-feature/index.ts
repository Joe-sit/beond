// beond — ThaiBMA bond-feature lookup (production parity for the dev-only vite
// middleware). ThaiBMA has no public JSON API: its Bond Feature page authorises
// the /issue/feature call with a Token+timestamp pair embedded in the page HTML
// plus an X-Requested-With header, and it can't be called from the browser
// (CORS). This runs the multi-step handshake server-side and returns a slim
// normalised record used to enrich manually-added bonds not in the SEC catalog.
//
// The scraper itself lives in ../_shared/thaibma.ts (the LINE auto-add flow
// needs it too).
//
// Public (deploy with --no-verify-jwt): ThaiBMA data is public and the flow can
// run before the user is authenticated. No secrets involved.

import { thaibmaFeature } from "../_shared/thaibma.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  if (!symbol) return json(400, { error: "symbol required" });
  try {
    const data = await thaibmaFeature(symbol);
    if (!data) return json(404, { error: "not found" });
    return json(200, data);
  } catch (e) {
    return json(502, { error: String((e as Error)?.message ?? e) });
  }
});
