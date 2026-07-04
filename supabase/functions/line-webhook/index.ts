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
//   LINE_MESSAGING_ACCESS_TOKEN, LINE_MESSAGING_CHANNEL_SECRET, TYPHOON_API_KEY
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//   service_role needs table grants (migration 0008).

import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_TOKEN = Deno.env.get("LINE_MESSAGING_ACCESS_TOKEN")!;
const LINE_SECRET = Deno.env.get("LINE_MESSAGING_CHANNEL_SECRET")!;
const TYPHOON_KEY = Deno.env.get("TYPHOON_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TYPHOON_URL = "https://api.opentyphoon.ai/v1/chat/completions";
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

// Chunked base64 (spread on a big Uint8Array overflows the call stack).
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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

// ── Typhoon OCR + extraction ────────────────────────────────────────────────
// Prompt from the typhoon-ocr SDK: returns JSON {"natural_text": "<markdown>"}.
const OCR_PROMPT =
  "Below is an image of a document page along with its dimensions. " +
  "Simply return the markdown representation of this document, presenting tables in markdown format as they naturally appear.\n" +
  "If the document contains images, use a placeholder like dummy.png for each image.\n" +
  "Your final output must be in JSON format with a single key `natural_text` containing the response.\n" +
  "RAW_TEXT_START\n\nRAW_TEXT_END";

async function typhoonOcr(bytes: Uint8Array, contentType: string): Promise<string> {
  const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
  const dataUri = `data:${mime};base64,${toBase64(bytes)}`;
  const res = await fetch(TYPHOON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TYPHOON_KEY}` },
    body: JSON.stringify({
      model: "typhoon-ocr",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
      repetition_penalty: 1.2,
      temperature: 0.1,
      top_p: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`typhoon-ocr ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  // content is itself JSON: {"natural_text": "..."}. Fall back to raw content.
  try {
    return JSON.parse(content).natural_text ?? content;
  } catch {
    return content;
  }
}

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

// Privacy: beond is only a middleman for bond/tax-credit tracking, so we never
// ask the model for — and never store — the investor's national ID (payee tax
// id). We keep only what a 40(4) filing needs: the payer + amounts + dates.
const EXTRACT_SYS =
  "คุณเป็นผู้ช่วยสกัดข้อมูลจาก 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)' ของดอกเบี้ยหุ้นกู้/พันธบัตร\n" +
  "กติกาสำคัญ:\n" +
  "- คัดลอกเฉพาะข้อความ/ตัวเลขที่ปรากฏจริงในเอกสาร ห้ามเดาหรือแต่งชื่อขึ้นเอง ถ้าไม่พบให้เป็น null\n" +
  "- ห้ามดึงเลขประจำตัวประชาชนของผู้ถูกหักภาษี (payee) เด็ดขาด — ไม่ต้องอ่าน ไม่ต้องส่งกลับ\n" +
  "- payer_name = ชื่อ 'ผู้มีหน้าที่หักภาษี ณ ที่จ่าย' (บริษัทผู้ออกหุ้นกู้/ผู้จ่ายดอกเบี้ย) ที่อยู่ส่วนหัวเอกสาร " +
  "เช่น 'บริษัท บริทาเนีย จำกัด (มหาชน)' ไม่ใช่ชื่อธนาคารหรือนายทะเบียน\n" +
  "- payer_tax_id = เลขประจำตัวผู้เสียภาษีของบริษัทผู้จ่าย (นิติบุคคล 13 หลัก) — ไม่ใช่บัตรประชาชนบุคคล\n" +
  "- bond_symbol = รหัสหุ้นกู้รูปแบบ ตัวอักษร+ตัวเลข+ตัวอักษร เช่น BRI275A, ORI288B ที่มักอยู่หน้า 'หุ้นกู้ของบริษัท...'\n" +
  "- gross_amount = ยอด 'จำนวนเงิน (บาท) / Total' ของแถวดอกเบี้ย (เงินได้ก่อนหักภาษี), " +
  "net_amount = 'คงเหลือจ่ายจริง / Net balance', wht_amount = 'จำนวนเงินภาษีที่หักไว้ / Less income tax'. " +
  "ต้องสอดคล้องกัน: gross_amount = net_amount + wht_amount (ถ้าอ่านขัดกันให้ยึด net + tax)\n" +
  "- wht_rate = อัตราภาษีหัก ณ ที่จ่าย (%) โดยปกติดอกเบี้ยหุ้นกู้บุคคลธรรมดา = 15 " +
  "(อย่าสับสนกับ 'อัตราร้อยละ x ต่อปี' ซึ่งเป็นอัตราดอกเบี้ย ไม่ใช่อัตราภาษี)\n" +
  "- pay_date = วันที่จ่ายดอกเบี้ยจริง (เช่น 'จ่าย ณ วันที่ 30 เมษายน 2569' หรือวันสิ้นงวด) " +
  "ห้ามใช้วันที่ในข้อความอ้างอิงกฎหมาย เช่น 'ตามหนังสือที่ กค 0809/5220 ลงวันที่ 12 มิถุนายน 2545'\n" +
  "- tax_year = ปีภาษี (พ.ศ.) = ปีของ pay_date\n" +
  "- แปลง pay_date เป็น 'YYYY-MM-DD' แบบ ค.ศ. (พ.ศ. - 543)\n" +
  "ตอบกลับเป็น JSON อย่างเดียว ห้ามมีข้อความอื่น ตาม schema:\n" +
  '{"payer_name":string,"payer_tax_id":string(นิติบุคคล 13 หลัก),' +
  '"income_subtype":string(เช่น "ดอกเบี้ยหุ้นกู้"),' +
  '"gross_amount":number,"net_amount":number,"wht_amount":number,' +
  '"wht_rate":number,"pay_date":string,"doc_ref":string(เลขที่/ลำดับที่เอกสาร),' +
  '"tax_year":number,"bond_symbol":string}';

async function typhoonExtract(markdown: string): Promise<SlipFields> {
  const res = await fetch(TYPHOON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TYPHOON_KEY}` },
    body: JSON.stringify({
      model: "typhoon-v2.5-30b-a3b-instruct",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACT_SYS },
        { role: "user", content: markdown },
      ],
    }),
  });
  if (!res.ok) throw new Error(`typhoon-extract ${res.status}: ${await res.text()}`);
  const json = await res.json();
  let content: string = json.choices?.[0]?.message?.content ?? "{}";
  content = content.replace(/```json\s*|\s*```/g, "").trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) content = content.slice(start, end + 1);
  return JSON.parse(content) as SlipFields;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

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

    const markdown = await typhoonOcr(bytes, contentType);
    const f = await typhoonExtract(markdown);

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

    // Best-effort link to a known bond by its symbol.
    let bondId: string | null = null;
    if (f.bond_symbol) {
      const { data: bond } = await admin
        .from("bonds").select("id").eq("symbol", f.bond_symbol.toUpperCase()).maybeSingle();
      bondId = bond?.id ?? null;
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
            action: { type: "postback", label: "แก้ไข", data: `action=reject&id=${documentId}` },
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
  // OCR is slow; run it after responding so LINE's webhook doesn't time out.
  EdgeRuntime.waitUntil(processSlip(doc.id, lineUserId));
}

async function handlePostback(event: LineEvent): Promise<void> {
  const data = new URLSearchParams(event.postback?.data ?? "");
  const action = data.get("action");
  const id = data.get("id");
  if (!id || !event.replyToken) return;

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
