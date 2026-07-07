// beond — system health + ops metrics for the internal admin dashboard.
//
// Returns dependency status (DB, LINE, SEC, Typhoon OCR, logo.dev) with latency,
// plus aggregate counts across ALL users (service role bypasses RLS). Because it
// exposes cross-user metrics, access is gated to an admin allowlist: the caller
// must present a valid Supabase session JWT whose LINE user id is in
// ADMIN_LINE_IDS (comma-separated env).
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically.
//      ADMIN_LINE_IDS (required), LINE_MESSAGING_ACCESS_TOKEN, SEC_API_KEY,
//      TYPHOON_API_KEY, LOGODEV_TOKEN (optional — a check is "skipped" if unset).

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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Status = "up" | "down" | "degraded" | "skipped";
interface Service {
  id: string;
  label: string;
  status: Status;
  latencyMs: number | null;
  detail: string;
}

// Time a fetch with a hard timeout; classify by HTTP status.
async function probe(
  id: string,
  label: string,
  url: string,
  init: RequestInit,
  ok: (status: number) => boolean = (s) => s >= 200 && s < 400,
): Promise<Service> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const latencyMs = Date.now() - t0;
    return {
      id,
      label,
      status: ok(res.status) ? "up" : "degraded",
      latencyMs,
      detail: `HTTP ${res.status}`,
    };
  } catch (e) {
    return { id, label, status: "down", latencyMs: Date.now() - t0, detail: String((e as Error).message) };
  } finally {
    clearTimeout(timer);
  }
}

// Verify the caller is an allow-listed admin; returns their line id or null.
async function authorizeAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  const lineId =
    (data.user.app_metadata?.line_user_id as string | undefined) ??
    (data.user.user_metadata?.line_user_id as string | undefined) ??
    null;
  // Fall back to the public.users row linked to this auth user.
  if (lineId && ADMIN_LINE_IDS.includes(lineId)) return lineId;
  const pubId = data.user.app_metadata?.public_user_id as string | undefined;
  if (pubId) {
    const { data: u } = await admin.from("users").select("line_user_id").eq("id", pubId).maybeSingle();
    if (u?.line_user_id && ADMIN_LINE_IDS.includes(u.line_user_id)) return u.line_user_id;
  }
  return null;
}

async function dbService(): Promise<Service> {
  const t0 = Date.now();
  const { error } = await admin.from("users").select("id", { count: "exact", head: true });
  const latencyMs = Date.now() - t0;
  return error
    ? { id: "db", label: "Supabase DB", status: "down", latencyMs, detail: error.message }
    : { id: "db", label: "Supabase DB", status: "up", latencyMs, detail: "OK" };
}

async function stats() {
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = admin.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count: c } = await q;
    return c ?? 0;
  };
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();

  const [users, holdings, pending, confirmed, rejected, docs24h, users7d] = await Promise.all([
    count("users"),
    count("holdings"),
    count("tax_documents", (q) => q.eq("status", "pending")),
    count("tax_documents", (q) => q.eq("status", "confirmed")),
    count("tax_documents", (q) => q.eq("status", "rejected")),
    count("tax_documents", (q) => q.gte("created_at", since(24 * 3600e3))),
    count("users", (q) => q.gte("created_at", since(7 * 24 * 3600e3))),
  ]);

  const totalDocs = pending + confirmed + rejected;
  // OCR "success" = a slip that extracted enough to be confirmed or is awaiting
  // review (pending); rejected = failed/garbage. Rate over all processed docs.
  const ocrSuccessRate = totalDocs === 0 ? null : Math.round(((confirmed + pending) / totalDocs) * 100);

  return {
    users,
    holdings,
    taxDocs: { pending, confirmed, rejected, total: totalDocs },
    ocrSuccessRate,
    docs24h,
    users7d,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  if (ADMIN_LINE_IDS.length === 0) return json({ error: "ADMIN_LINE_IDS not configured" }, 500);

  const adminLineId = await authorizeAdmin(req);
  if (!adminLineId) return json({ error: "forbidden" }, 403);

  const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN");
  const SEC_KEY = Deno.env.get("SEC_API_KEY");
  const TYPHOON_KEY = Deno.env.get("TYPHOON_API_KEY");
  const LOGODEV = Deno.env.get("LOGODEV_TOKEN") ?? Deno.env.get("VITE_LOGODEV_TOKEN");

  const skipped = (id: string, label: string): Service => ({
    id,
    label,
    status: "skipped",
    latencyMs: null,
    detail: "no key configured",
  });

  const [db, line, sec, typhoon, logodev] = await Promise.all([
    dbService(),
    LINE_TOKEN
      ? probe("line", "LINE Messaging", "https://api.line.me/v2/bot/info", {
          headers: { Authorization: `Bearer ${LINE_TOKEN}` },
        })
      : Promise.resolve(skipped("line", "LINE Messaging")),
    SEC_KEY
      ? probe(
          "sec",
          "SEC API",
          "https://api.sec.or.th/FundFactsheet/fund/amc",
          { headers: { "Ocp-Apim-Subscription-Key": SEC_KEY } },
          (s) => s === 200 || s === 204 || s === 404, // reachable = healthy
        )
      : Promise.resolve(skipped("sec", "SEC API")),
    TYPHOON_KEY
      ? probe("typhoon", "Typhoon OCR", "https://api.opentyphoon.ai/v1/models", {
          headers: { Authorization: `Bearer ${TYPHOON_KEY}` },
        })
      : Promise.resolve(skipped("typhoon", "Typhoon OCR")),
    LOGODEV
      ? probe("logodev", "logo.dev", "https://img.logo.dev/google.com?token=" + LOGODEV, {})
      : Promise.resolve(skipped("logodev", "logo.dev")),
  ]);

  const s = await stats();

  return json({
    ok: true,
    generatedAt: new Date().toISOString(),
    services: [db, line, sec, typhoon, logodev],
    stats: s,
  });
});
