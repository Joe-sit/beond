import { supabase, supabaseEnabled } from "./supabase";
import { notifyPortfolioChanged } from "../hooks/usePortfolio";
import { mockExtract, type SlipFields } from "./scanTypes";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Blob → base64 (no data: prefix) for the ocr-extract JSON payload.
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read failed"));
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.readAsDataURL(blob);
  });
}

// OCR a slip image → structured fields. Real path calls the ocr-extract edge fn
// with the user's session token; mock mode returns sample fields so the flow is
// testable without a backend.
export async function extractSlip(image: Blob): Promise<SlipFields> {
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) return mockExtract(image);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ยังไม่ได้เข้าสู่ระบบ");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image: await toBase64(image), contentType: image.type || "image/jpeg" }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.error ?? `ocr-extract ${res.status}`);
  return body.fields as SlipFields;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

// Persist a reviewed slip to tax_documents for the logged-in user. The user has
// already checked/edited the fields, so it lands as `confirmed` (unlike the LINE
// flow, which starts `pending` until confirmed in chat). RLS requires user_id to
// equal the caller's public_user_id (from the session JWT app_metadata).
export async function saveTaxDocument(fields: SlipFields): Promise<SaveResult> {
  if (!supabaseEnabled || !supabase) {
    // Mock mode: pretend success so the UI flow completes in local dev.
    notifyPortfolioChanged();
    return { ok: true };
  }

  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const { error } = await supabase.from("tax_documents").insert({
    user_id: userId,
    source: "web_upload",
    status: "confirmed",
    income_type: "40(4)",
    payer_name: fields.payer_name,
    payer_tax_id: fields.payer_tax_id,
    income_subtype: fields.income_subtype,
    gross_amount: fields.gross_amount,
    wht_amount: fields.wht_amount,
    wht_rate: fields.wht_rate,
    pay_date: fields.pay_date,
    doc_ref: fields.doc_ref,
    tax_year: fields.tax_year,
  });

  if (error) {
    // Unique (user_id, doc_ref) collision → same slip already saved.
    if (error.code === "23505") return { ok: false, error: "สลิปนี้ถูกบันทึกไว้แล้ว" };
    return { ok: false, error: error.message };
  }
  notifyPortfolioChanged();
  return { ok: true };
}
