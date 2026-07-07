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
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto), TYPHOON_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TYPHOON_KEY = Deno.env.get("TYPHOON_API_KEY")!;
const TYPHOON_URL = "https://api.opentyphoon.ai/v1/chat/completions";

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

const OCR_PROMPT =
  "Below is an image of a document page along with its dimensions. " +
  "Simply return the markdown representation of this document, presenting tables in markdown format as they naturally appear.\n" +
  "If the document contains images, use a placeholder like dummy.png for each image.\n" +
  "Your final output must be in JSON format with a single key `natural_text` containing the response.\n" +
  "RAW_TEXT_START\n\nRAW_TEXT_END";

async function typhoonOcr(bytes: Uint8Array, contentType: string): Promise<string> {
  const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
  const dataUri = `data:${mime};base64,${encodeBase64(bytes)}`;
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
  try {
    return JSON.parse(content).natural_text ?? content;
  } catch {
    return content;
  }
}

const EXTRACT_SYS =
  "คุณเป็นผู้ช่วยสกัดข้อมูลจาก 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)' ของดอกเบี้ยหุ้นกู้/พันธบัตร\n" +
  "กติกาสำคัญ:\n" +
  "- คัดลอกเฉพาะข้อความ/ตัวเลขที่ปรากฏจริงในเอกสาร ห้ามเดาหรือแต่งชื่อขึ้นเอง ถ้าไม่พบให้เป็น null\n" +
  "- ห้ามดึงเลขประจำตัวประชาชนของผู้ถูกหักภาษี (payee) เด็ดขาด — ไม่ต้องอ่าน ไม่ต้องส่งกลับ\n" +
  "- payer_name = ชื่อ 'ผู้มีหน้าที่หักภาษี ณ ที่จ่าย' (บริษัทผู้ออกหุ้นกู้/ผู้จ่ายดอกเบี้ย) ที่อยู่ส่วนหัวเอกสาร\n" +
  "- payer_tax_id = เลขประจำตัวผู้เสียภาษีของบริษัทผู้จ่าย (นิติบุคคล 13 หลัก)\n" +
  "- bond_symbol = รหัสหุ้นกู้รูปแบบ ตัวอักษร+ตัวเลข+ตัวอักษร เช่น BRI275A, ORI288B\n" +
  "- gross_amount = ยอด 'จำนวนเงิน (บาท) / Total' ของแถวดอกเบี้ย, net_amount = 'คงเหลือจ่ายจริง / Net balance', " +
  "wht_amount = 'จำนวนเงินภาษีที่หักไว้ / Less income tax'. ต้องสอดคล้อง: gross = net + tax (ถ้าขัดกันยึด net + tax)\n" +
  "- wht_rate = อัตราภาษีหัก ณ ที่จ่าย (%) ปกติ 15 (อย่าสับสนกับอัตราดอกเบี้ยต่อปี)\n" +
  "- pay_date = วันที่จ่ายดอกเบี้ยจริง, tax_year = ปีภาษี (พ.ศ.) = ปีของ pay_date, แปลง pay_date เป็น 'YYYY-MM-DD' แบบ ค.ศ. (พ.ศ. - 543)\n" +
  "ตอบกลับเป็น JSON อย่างเดียว ตาม schema:\n" +
  '{"payer_name":string,"payer_tax_id":string,"income_subtype":string,' +
  '"gross_amount":number,"net_amount":number,"wht_amount":number,' +
  '"wht_rate":number,"pay_date":string,"doc_ref":string,"tax_year":number,"bond_symbol":string}';

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

async function authorized(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data, error } = await admin.auth.getUser(jwt);
  return !error && !!data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!(await authorized(req))) return json({ error: "unauthorized" }, 401);

  try {
    const { image, contentType } = (await req.json()) as { image: string; contentType?: string };
    if (!image) return json({ error: "missing image" }, 400);
    const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const markdown = await typhoonOcr(bytes, contentType ?? "image/jpeg");
    const fields = reconcile(await typhoonExtract(markdown));
    return json({ ok: true, fields });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
