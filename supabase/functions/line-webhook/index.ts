// beond — LINE Messaging API webhook (Phase 1 + 2).
//
//   • verify the X-Line-Signature (HMAC-SHA256 over the raw body)
//   • follow   → upsert the LINE user + greet
//   • image    → store the slip (pending) + reply, then OCR in the background:
//                Typhoon OCR → markdown → Typhoon LLM → structured 50-ทวิ fields
//                → update the row → push a Flex confirm card
//   • postback → confirm / reject the extracted document
//   • text     → short instructions
//
// Env (Supabase Dashboard → Edge Function Secrets):
//   LINE_MESSAGING_ACCESS_TOKEN, LINE_MESSAGING_CHANNEL_SECRET, GEMINI_API_KEY
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//   service_role needs table grants (migration 0008).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN")!;
const LINE_SECRET = Deno.env.get("LINE_MESSAGING_CHANNEL_SECRET")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// LIFF entry for the "แก้ไข" deep link → opens the web OCR-review screen. The
// LIFF id is a public client id (not a secret); override via LIFF_ID if it moves.
const LIFF_ID = Deno.env.get("LIFF_ID") ?? "2010595004-4xF6RZlS";
const LIFF_REVIEW_URL = `https://liff.line.me/${LIFF_ID}`;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const encoder = new TextEncoder();

// ── helpers ─────────────────────────────────────────────────────────────────
async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LINE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}


// ── LINE API ────────────────────────────────────────────────────────────────
async function lineReply(replyToken: string, messages: unknown[]): Promise<void> {
  const r = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!r.ok) throw new Error(`reply ${r.status}: ${await r.text()}`);
}

async function linePush(to: string, messages: unknown[]): Promise<void> {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) console.error(`push ${r.status}: ${await r.text()}`);
}

async function lineProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string }> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${LINE_TOKEN}` },
  });
  if (!res.ok) return { displayName: "LINE user" };
  return await res.json();
}

async function lineImageContent(messageId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${LINE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`content ${res.status}: ${await res.text()}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
}

// ── OCR: Gemini vision ──────────────────────────────────────────────────────
interface SlipFields {
  payer_name: string | null;
  payer_tax_id: string | null;
  income_subtype: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  wht_amount: number | null;
  wht_rate: number | null;
  pay_date: string | null; // YYYY-MM-DD
  doc_ref: string | null;
  tax_year: number | null; // พ.ศ.
  bond_symbol: string | null;
}

// Gemini vision — image → structured fields in one call. Privacy: we never ask
// for (nor store) the payee's national ID — only 40(4) filing fields.
const GEMINI_PROMPT =
  "รูปนี้คือ 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)' ของดอกเบี้ยหุ้นกู้/พันธบัตร สกัดข้อมูลตาม schema. กติกา:\n" +
  "- คัดเฉพาะที่ปรากฏจริง ห้ามเดา ถ้าไม่พบให้เป็น null\n" +
  "- ห้ามอ่าน/ส่งเลขบัตรประชาชนของผู้ถูกหักภาษี (payee) เด็ดขาด\n" +
  "- payer_tax_id = เลขประจำตัวผู้เสียภาษี 13 หลัก ของบริษัทผู้จ่ายดอกเบี้ย (อยู่ติด/ใต้ชื่อบริษัทผู้จ่ายในตารางรายละเอียด) — ห้ามใช้เลขทะเบียนหัวกระดาษ ห้ามใช้เลขของธนาคาร/นายทะเบียน\n" +
  "- payer_name = ชื่อบริษัทผู้จ่าย (ไม่ใช่ธนาคาร/นายทะเบียน)\n" +
  "- bond_symbol = รหัสหุ้นกู้ เช่น BRI275A, ORI288B ถ้าไม่มีให้ null\n" +
  "- gross_amount = จำนวนเงินที่จ่าย, wht_amount = ภาษีที่หักไว้, net_amount = คงเหลือจ่ายจริง (gross = net + wht)\n" +
  "- wht_rate = อัตราภาษี (%) ปกติ 15\n" +
  "- pay_date = 'YYYY-MM-DD' (ค.ศ. = พ.ศ. − 543), tax_year = ปีภาษี พ.ศ.";

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
  // Abort if Gemini stalls so the flow fails fast (→ user-visible error) instead
  // of hanging the background task silently.
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

// Canonicalize a bond code so OCR's O↔0 / I↔1 confusions still match the
// catalog. Mirrors the web scan flow's canonSym.
const canonSym = (s: string) => s.replace(/O/g, "0").replace(/I/g, "1");

// ── Slip processing (background) ────────────────────────────────────────────
async function processSlip(documentId: string, lineUserId: string): Promise<void> {
  let imagePath: string | null = null;
  try {
    const { data: doc, error } = await admin
      .from("tax_documents").select("image_path").eq("id", documentId).single();
    if (error || !doc?.image_path) throw new Error(`load doc: ${error?.message}`);
    imagePath = doc.image_path;

    const { data: blob, error: dlErr } = await admin.storage.from("tax-slips").download(doc.image_path);
    if (dlErr || !blob) throw new Error(`download: ${dlErr?.message}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const contentType = blob.type || "image/jpeg";

    // Reassure the user if OCR runs long (usually ~5s). Cleared once it lands.
    const slow = setTimeout(() => {
      linePush(lineUserId, [{ type: "text", text: "ยังอ่านข้อมูลอยู่นะครับ ⏳ อีกสักครู่" }]).catch(() => {});
    }, 12_000);
    // Gemini vision reads the slip directly (accurate on Thai + skew).
    let f: SlipFields;
    try {
      f = await geminiExtract(bytes, contentType);
    } finally {
      clearTimeout(slow);
    }

    // Cross-check amounts: the slip's own arithmetic (net + tax = gross) is more
    // reliable than a single OCR'd figure, so reconcile before trusting gross.
    const net = num(f.net_amount);
    const wht = num(f.wht_amount);
    let gross = num(f.gross_amount);
    if (net !== null && wht !== null && (gross === null || Math.abs(gross - (net + wht)) > 1)) {
      gross = Math.round((net + wht) * 100) / 100;
    }
    let rate = num(f.wht_rate);
    if ((rate === null || rate <= 0) && gross && wht) rate = Math.round((wht / gross) * 100);
    f.gross_amount = gross;
    f.wht_rate = rate;

    const taxYear = f.tax_year ?? (f.pay_date ? new Date(f.pay_date).getFullYear() + 543 : null);

    // Best-effort link to a known bond by its symbol. OCR routinely confuses
    // O↔0 and I↔1 inside a bond code, so if the exact symbol misses we retry on
    // a canonical form against the catalog and adopt the catalog's true spelling.
    let bondId: string | null = null;
    if (f.bond_symbol) {
      const sym = f.bond_symbol.toUpperCase();
      const { data: exact } = await admin.from("bonds").select("id, symbol").eq("symbol", sym).maybeSingle();
      if (exact) {
        bondId = exact.id;
        f.bond_symbol = exact.symbol;
      } else {
        const wanted = canonSym(sym);
        const { data: bonds } = await admin.from("bonds").select("id, symbol");
        const hit = (bonds ?? []).find((b) => canonSym(String(b.symbol).toUpperCase()) === wanted);
        if (hit) {
          bondId = hit.id;
          f.bond_symbol = hit.symbol; // correct the OCR misread (e.g. BTSG280A → BTSG28OA)
        }
      }
      // Not in the catalog → the LLM likely guessed (OCR often drops the bond
      // line). Blank it rather than show a wrong code; the user picks on confirm.
      if (!bondId) f.bond_symbol = null;
    }

    // Store only the fields a filing needs. No raw markdown (it contains the
    // investor's national ID) and no image_path — the slip image is deleted
    // below so beond never retains a copy of the ID document.
    await admin
      .from("tax_documents")
      .update({
        payer_name: f.payer_name ?? null,
        payer_tax_id: f.payer_tax_id ?? null,
        income_subtype: f.income_subtype ?? null,
        gross_amount: gross,
        wht_amount: wht,
        wht_rate: rate,
        pay_date: f.pay_date ?? null,
        doc_ref: f.doc_ref ?? null,
        tax_year: taxYear,
        bond_id: bondId,
        ocr_raw: { fields: f },
        image_path: null,
      })
      .eq("id", documentId);

    await deleteSlipImage(imagePath);
    imagePath = null;

    await linePush(lineUserId, [buildConfirmFlex(documentId, f)]);
  } catch (err) {
    console.error("processSlip failed:", err);
    // Never keep the ID document around, even on failure.
    if (imagePath) {
      await deleteSlipImage(imagePath);
      await admin.from("tax_documents").update({ image_path: null }).eq("id", documentId);
    }
    await linePush(lineUserId, [
      { type: "text", text: "ขออภัย อ่านเอกสารไม่สำเร็จ 😢 ลองส่งรูปที่ชัดขึ้นอีกครั้งนะครับ" },
    ]);
  }
}

// Remove a slip image from storage (best-effort — a stale image must never
// linger since it carries the investor's national ID).
async function deleteSlipImage(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await admin.storage.from("tax-slips").remove([path]);
  if (error) console.error("deleteSlipImage failed:", error.message);
}

function fmtTHB(n: number | null): string {
  return n === null ? "-" : new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(n);
}

// Flex bubble summarising the extracted slip with confirm / reject postbacks.
function buildConfirmFlex(documentId: string, f: SlipFields): unknown {
  const row = (label: string, value: string) => ({
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8A8A8A", size: "sm", flex: 4 },
      { type: "text", text: value || "-", wrap: true, color: "#111111", size: "sm", flex: 6 },
    ],
  });
  return {
    type: "flex",
    altText: "สรุปข้อมูลหนังสือรับรองหักภาษี ณ ที่จ่าย",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "หัก ณ ที่จ่าย 50 ทวิ", weight: "bold", size: "lg", color: "#43507F" },
          { type: "text", text: "ตรวจสอบข้อมูลก่อนบันทึกนะครับ", size: "xs", color: "#8A8A8A" },
          { type: "separator", margin: "md" },
          row("ผู้จ่าย", f.payer_name ?? "-"),
          row("หุ้นกู้", f.bond_symbol ?? "-"),
          row("ดอกเบี้ย", `฿${fmtTHB(num(f.gross_amount))}`),
          row("ภาษีหัก", `฿${fmtTHB(num(f.wht_amount))} (${f.wht_rate ?? "-"}%)`),
          row("วันที่จ่าย", f.pay_date ?? "-"),
          row("ปีภาษี", f.tax_year ? String(f.tax_year) : "-"),
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            // Open the web app's OCR-review screen (LIFF) for this pending slip.
            action: { type: "uri", label: "แก้ไข", uri: `${LIFF_REVIEW_URL}?review=${documentId}` },
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#43507F",
            action: { type: "postback", label: "ยืนยัน", data: `action=confirm&id=${documentId}` },
          },
        ],
      },
    },
  };
}

// Upsert the user by LINE id, returning our internal uuid.
async function ensureUser(lineUserId: string): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from("users").select("id").eq("line_user_id", lineUserId).maybeSingle();
  if (selErr) throw new Error(`select user: ${selErr.message}`);
  if (existing) return existing.id;
  const profile = await lineProfile(lineUserId);
  const { data, error } = await admin
    .from("users")
    .insert({ line_user_id: lineUserId, display_name: profile.displayName, picture_url: profile.pictureUrl ?? null })
    .select("id").single();
  if (error) throw new Error(`insert user: ${error.message}`);
  return data.id;
}

const SCAN_DAILY_LIMIT = 5;
const today = () => new Date().toISOString().slice(0, 10);

// True when the user has hit the daily scan cap (exempt accounts never do).
// Fail-open: any error (e.g. quota tables not yet migrated) must NOT block OCR.
async function scanQuotaExceeded(userId: string): Promise<boolean> {
  try {
    const { data: u } = await admin.from("users").select("scan_unlimited").eq("id", userId).maybeSingle();
    if (u?.scan_unlimited) return false;
    const { data: row } = await admin
      .from("scan_usage").select("count").eq("user_id", userId).eq("day", today()).maybeSingle();
    return (row?.count ?? 0) >= SCAN_DAILY_LIMIT;
  } catch (e) {
    console.error("scanQuotaExceeded (fail-open):", (e as Error).message);
    return false;
  }
}

// Count one scan against today's quota. Best-effort — never throws.
async function bumpScanQuota(userId: string): Promise<void> {
  try {
    const day = today();
    const { data: row } = await admin
      .from("scan_usage").select("count").eq("user_id", userId).eq("day", day).maybeSingle();
    await admin.from("scan_usage").upsert({ user_id: userId, day, count: (row?.count ?? 0) + 1 });
  } catch (e) {
    console.error("bumpScanQuota (skip):", (e as Error).message);
  }
}

// ── Event handlers ──────────────────────────────────────────────────────────
async function handleFollow(event: LineEvent): Promise<void> {
  if (event.source?.userId) await ensureUser(event.source.userId);
  if (event.replyToken) {
    await lineReply(event.replyToken, [
      {
        type: "text",
        text:
          "ยินดีต้อนรับสู่ beond 🎉\n\nส่งรูป 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)' ของดอกเบี้ยหุ้นกู้เข้ามาได้เลย ระบบจะอ่านข้อมูลและสรุปเครดิตภาษีให้อัตโนมัติ",
      },
    ]);
  }
}

async function handleImage(event: LineEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  const messageId = event.message?.id;
  if (!lineUserId || !messageId) return;

  const userId = await ensureUser(lineUserId);

  // Daily scan cap (Gemini cost) — exempt accounts (scan_unlimited) skip it.
  if (await scanQuotaExceeded(userId)) {
    if (event.replyToken) {
      await lineReply(event.replyToken, [
        { type: "text", text: `วันนี้สแกนครบ ${SCAN_DAILY_LIMIT} ครั้งแล้วครับ 🙏 พรุ่งนี้ลองใหม่ได้เลย` },
      ]);
    }
    return;
  }

  const { bytes, contentType } = await lineImageContent(messageId);
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${lineUserId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("tax-slips").upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  const { data: doc, error: insErr } = await admin
    .from("tax_documents")
    .insert({ user_id: userId, source: "line_ocr", status: "pending", image_path: path })
    .select("id").single();
  if (insErr) throw new Error(`insert doc: ${insErr.message}`);

  if (event.replyToken) {
    await lineReply(event.replyToken, [
      { type: "text", text: "ได้รับเอกสารแล้ว ✅ กำลังอ่านข้อมูล เดี๋ยวสรุปให้นะครับ" },
    ]);
  }
  await bumpScanQuota(userId);
  // OCR is slow; run it after responding so LINE's webhook doesn't time out.
  EdgeRuntime.waitUntil(processSlip(doc.id, lineUserId));
}

async function handlePostback(event: LineEvent): Promise<void> {
  const data = new URLSearchParams(event.postback?.data ?? "");
  const action = data.get("action");
  const id = data.get("id");
  if (!event.replyToken) return;

  // Rich-menu "สแกนใบ 50 ทวิ" button → prompt the user to send a photo in chat
  // (the image handler does the rest). No LIFF camera page needed.
  if (action === "scan") {
    await lineReply(event.replyToken, [
      {
        type: "text",
        text: "ส่งรูปหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) เข้ามาในแชทได้เลยครับ 📄\nระบบจะอ่านข้อมูลให้อัตโนมัติ แล้วส่งสรุปให้ยืนยัน",
      },
    ]);
    return;
  }

  if (!id) return;

  if (action === "confirm") {
    await admin.from("tax_documents").update({ status: "confirmed" }).eq("id", id);
    await lineReply(event.replyToken, [
      { type: "text", text: "บันทึกเครดิตภาษีเรียบร้อย ✅ ดูสรุปทั้งหมดได้ในแอป beond" },
    ]);
  } else if (action === "reject") {
    await admin.from("tax_documents").update({ status: "rejected" }).eq("id", id);
    await lineReply(event.replyToken, [
      { type: "text", text: "ยกเลิกรายการแล้ว หากต้องการแก้ไข ส่งรูปเอกสารเข้ามาใหม่ได้เลยครับ" },
    ]);
  }
}

async function handleText(event: LineEvent): Promise<void> {
  if (!event.replyToken) return;
  await lineReply(event.replyToken, [
    { type: "text", text: "ส่งรูปหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) เข้ามาได้เลยครับ ระบบจะอ่านข้อมูลให้อัตโนมัติ 📄" },
  ]);
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { id?: string; type?: string; text?: string };
  postback?: { data?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const body = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!(await verifySignature(body, signature))) return new Response("bad signature", { status: 401 });

  const { events } = JSON.parse(body) as { events: LineEvent[] };
  const errors: string[] = [];
  for (const event of events ?? []) {
    try {
      if (event.type === "follow") await handleFollow(event);
      else if (event.type === "postback") await handlePostback(event);
      else if (event.type === "message" && event.message?.type === "image") await handleImage(event);
      else if (event.type === "message" && event.message?.type === "text") await handleText(event);
    } catch (err) {
      console.error("event failed:", event.type, err);
      errors.push(`${event.type}: ${String((err as Error)?.message ?? err)}`);
    }
  }
  return new Response(JSON.stringify({ ok: true, errors }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
