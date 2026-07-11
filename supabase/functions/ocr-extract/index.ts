// beond — OCR a 50-ทวิ slip image and return structured 40(4) fields.
//
// Used by the WEB app scan/upload flow (mirrors the LINE webhook's OCR path, so
// both converge on the same SlipFields schema). Stateless + privacy-preserving:
// it never stores the image or the raw OCR markdown (which contains the payee's
// national ID) — it returns the reconciled fields to the client, which lets the
// user review/edit and then saves only the filing fields to tax_documents.
//
// Auth: caller must present a valid Supabase session JWT (logged-in user) since
// this spends Typhoon credits.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto), GEMINI_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SlipFields {
  payer_name: string | null;
  payer_tax_id: string | null;
  income_subtype: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  wht_amount: number | null;
  wht_rate: number | null;
  pay_date: string | null;
  doc_ref: string | null;
  tax_year: number | null;
  bond_symbol: string | null;
}

// ── Gemini: image → structured fields in one call ──────────────────────────
// Reads Thai + numbers reliably and returns strict JSON via a responseSchema.
const GEMINI_PROMPT =
  "รูปนี้คือ 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)' ของดอกเบี้ยหุ้นกู้/พันธบัตร " +
  "สกัดข้อมูลตาม schema. กติกา:\n" +
  "- คัดเฉพาะที่ปรากฏจริง ห้ามเดา ถ้าไม่พบให้เป็น null\n" +
  "- ห้ามอ่าน/ส่งเลขบัตรประชาชนของผู้ถูกหักภาษี (payee) เด็ดขาด\n" +
  "- payer_tax_id = เลขประจำตัวผู้เสียภาษี 13 หลัก ของบริษัทผู้จ่ายดอกเบี้ย (อยู่ติด/ใต้ชื่อบริษัทผู้จ่ายในตารางรายละเอียด) — ห้ามใช้เลขทะเบียนหัวกระดาษ ห้ามใช้เลขของธนาคาร/นายทะเบียน\n" +
  "- payer_name = ชื่อบริษัทผู้จ่าย (ผู้มีหน้าที่หักภาษี ณ ที่จ่าย)\n" +
  "- bond_symbol = รหัสหุ้นกู้ เช่น BRI275A, ORI288B (อักษร+เลข+อักษร) ถ้าไม่มีให้ null\n" +
  "- gross_amount = จำนวนเงินที่จ่าย, wht_amount = ภาษีที่หักไว้, net_amount = คงเหลือจ่ายจริง (gross = net + wht)\n" +
  "- wht_rate = อัตราภาษีหัก (%) ปกติ 15\n" +
  "- pay_date = วันที่จ่าย รูปแบบ 'YYYY-MM-DD' (ค.ศ. = พ.ศ. − 543), tax_year = ปีภาษี พ.ศ.";

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    payer_name: { type: "STRING", nullable: true },
    payer_tax_id: { type: "STRING", nullable: true },
    income_subtype: { type: "STRING", nullable: true },
    gross_amount: { type: "NUMBER", nullable: true },
    net_amount: { type: "NUMBER", nullable: true },
    wht_amount: { type: "NUMBER", nullable: true },
    wht_rate: { type: "NUMBER", nullable: true },
    pay_date: { type: "STRING", nullable: true },
    doc_ref: { type: "STRING", nullable: true },
    tax_year: { type: "INTEGER", nullable: true },
    bond_symbol: { type: "STRING", nullable: true },
  },
};

async function geminiExtract(bytes: Uint8Array, contentType: string): Promise<SlipFields> {
  const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
  // Abort if Gemini stalls so the request fails fast instead of hanging.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mime, data: encodeBase64(bytes) } },
              { text: GEMINI_PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    });
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? "gemini timeout (45s)" : `gemini fetch: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as SlipFields;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Reconcile amounts using the slip's own arithmetic (net + tax = gross).
function reconcile(f: SlipFields): SlipFields {
  const net = num(f.net_amount);
  const wht = num(f.wht_amount);
  let gross = num(f.gross_amount);
  if (net !== null && wht !== null && (gross === null || Math.abs(gross - (net + wht)) > 1)) {
    gross = Math.round((net + wht) * 100) / 100;
  }
  let rate = num(f.wht_rate);
  if ((rate === null || rate <= 0) && gross && wht) rate = Math.round((wht / gross) * 100);
  const taxYear = f.tax_year ?? (f.pay_date ? new Date(f.pay_date).getFullYear() + 543 : null);
  return { ...f, gross_amount: gross, net_amount: net, wht_amount: wht, wht_rate: rate, tax_year: taxYear };
}

// Returns the caller's internal user id (users.id, from the JWT app_metadata),
// or null when the token is missing/invalid.
async function authUserId(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return (data.user.app_metadata?.public_user_id as string | undefined) ?? null;
}

const SCAN_DAILY_LIMIT = 5;
const today = () => new Date().toISOString().slice(0, 10);

// True when the user has hit the daily scan cap (exempt accounts never do).
async function scanQuotaExceeded(userId: string): Promise<boolean> {
  const { data: u } = await admin.from("users").select("scan_unlimited").eq("id", userId).maybeSingle();
  if (u?.scan_unlimited) return false;
  const { data: row } = await admin
    .from("scan_usage").select("count").eq("user_id", userId).eq("day", today()).maybeSingle();
  return (row?.count ?? 0) >= SCAN_DAILY_LIMIT;
}

// Count one successful scan against today's quota.
async function bumpScanQuota(userId: string): Promise<void> {
  const day = today();
  const { data: row } = await admin
    .from("scan_usage").select("count").eq("user_id", userId).eq("day", day).maybeSingle();
  await admin.from("scan_usage").upsert({ user_id: userId, day, count: (row?.count ?? 0) + 1 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const userId = await authUserId(req);
  if (!userId) return json({ error: "unauthorized" }, 401);
  if (await scanQuotaExceeded(userId)) {
    return json({ error: `สแกนได้สูงสุด ${SCAN_DAILY_LIMIT} ครั้งต่อวัน — ลองใหม่พรุ่งนี้`, code: "quota_exceeded" }, 429);
  }

  try {
    const { image, contentType } = (await req.json()) as { image: string; contentType?: string };
    if (!image) return json({ error: "missing image" }, 400);
    const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const ct = contentType ?? "image/jpeg";

    // Gemini vision → structured JSON (one call, reads Thai reliably).
    const fields = reconcile(await geminiExtract(bytes, ct));
    await bumpScanQuota(userId);
    return json({ ok: true, fields });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
