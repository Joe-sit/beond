// beond — SEC Open Data API proxy (production parity for the dev-only vite
// proxy). Forwards the path after "/sec-api" to https://api.sec.or.th, injecting
// the subscription key server-side so it never reaches the browser bundle.
//
// Public (deploy with --no-verify-jwt): only proxies SEC's public bond endpoints
// and the subscription key stays here. Set the SEC_API_KEY edge secret:
//   supabase secrets set SEC_API_KEY=<key>
//
// Client calls: ${SUPABASE_URL}/functions/v1/sec-api/v2/bond/features?search_term=…

const SEC_BASE = "https://api.sec.or.th";
const SEC_KEY = Deno.env.get("SEC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  // Everything after the function name "/sec-api" is the SEC path. Supabase
  // routes /functions/v1/sec-api/<rest> and the request path here is
  // "/sec-api/<rest>", so strip the prefix.
  const rest = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/sec-api/, "");
  if (!rest) return new Response(JSON.stringify({ error: "path required" }), {
    status: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

  const target = `${SEC_BASE}${rest}${url.search}`;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: { "Ocp-Apim-Subscription-Key": SEC_KEY, Accept: "application/json" },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
