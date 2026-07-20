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

  const bondId = await resolveBondId(fields.bond_symbol);

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
    bond_id: bondId,
  });

  if (error) {
    // Unique (user_id, doc_ref) collision → same slip already saved.
    if (error.code === "23505") return { ok: false, error: "สลิปนี้ถูกบันทึกไว้แล้ว" };
    return { ok: false, error: error.message };
  }
  // Learn the issuer's tax id for this bond series (canonical, self-improving).
  await bindBondPayerTaxId(fields.bond_symbol, fields.payer_tax_id);
  notifyPortfolioChanged();
  return { ok: true };
}

// Resolve a bond code to its catalog id (uppercased); null when not in catalog.
async function resolveBondId(symbol: string | null): Promise<string | null> {
  if (!symbol || !supabase) return null;
  const { data } = await supabase
    .from("bonds").select("id").eq("symbol", symbol.toUpperCase()).maybeSingle();
  return data?.id ?? null;
}

// Bind the payer's (issuer's) 13-digit tax id to the bond series on the catalog,
// so future scans/lookups resolve the issuer from the tax id. No-op unless both
// the bond code and a tax id are present.
async function bindBondPayerTaxId(symbol: string | null, taxId: string | null): Promise<void> {
  if (!supabase || !symbol || !taxId) return;
  await supabase
    .from("bonds")
    .update({ payer_tax_id: taxId })
    .eq("symbol", symbol.toUpperCase());
}

// The editable columns of a tax document. `bond_symbol` is resolved to a
// bond_id (catalog link) before the patch is written.
export interface TaxDocPatch {
  payer_name: string | null;
  payer_tax_id: string | null;
  bond_symbol: string | null;
  gross_amount: number | null;
  wht_amount: number | null;
  wht_rate: number | null;
  pay_date: string | null;
  tax_year: number | null;
}

// Update a user's own tax document after they edit it in the จัดการภาษี panel.
// RLS scopes the update to rows the caller owns. A confirmed edit keeps the slip
// confirmed; the amounts are trusted as the user reviewed them.
export async function updateTaxDocument(id: string, patch: TaxDocPatch): Promise<SaveResult> {
  if (!supabaseEnabled || !supabase) {
    notifyPortfolioChanged();
    return { ok: true };
  }

  // Link the bond code to the catalog when it resolves; otherwise leave it null.
  const bondId = await resolveBondId(patch.bond_symbol);

  const { error } = await supabase
    .from("tax_documents")
    .update({
      payer_name: patch.payer_name,
      payer_tax_id: patch.payer_tax_id,
      bond_id: bondId,
      gross_amount: patch.gross_amount,
      wht_amount: patch.wht_amount,
      wht_rate: patch.wht_rate,
      pay_date: patch.pay_date,
      tax_year: patch.tax_year,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  // Keep the catalog's learned issuer tax id in sync with the user's edit.
  await bindBondPayerTaxId(patch.bond_symbol, patch.payer_tax_id);
  notifyPortfolioChanged();
  return { ok: true };
}

// Manually add a tax document from the จัดการภาษี panel (no scan) — for slips the
// OCR missed or paper records entered by hand. Lands `confirmed` like a reviewed
// scan and binds the issuer tax id to the bond series.
export async function createTaxDocument(patch: TaxDocPatch): Promise<SaveResult> {
  if (!supabaseEnabled || !supabase) {
    notifyPortfolioChanged();
    return { ok: true };
  }

  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const bondId = await resolveBondId(patch.bond_symbol);

  const { error } = await supabase.from("tax_documents").insert({
    user_id: userId,
    source: "web_upload",
    status: "confirmed",
    income_type: "40(4)",
    payer_name: patch.payer_name,
    payer_tax_id: patch.payer_tax_id,
    gross_amount: patch.gross_amount,
    wht_amount: patch.wht_amount,
    wht_rate: patch.wht_rate,
    pay_date: patch.pay_date,
    tax_year: patch.tax_year,
    bond_id: bondId,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "รายการนี้ถูกบันทึกไว้แล้ว" };
    return { ok: false, error: error.message };
  }
  await bindBondPayerTaxId(patch.bond_symbol, patch.payer_tax_id);
  notifyPortfolioChanged();
  return { ok: true };
}

// Load a saved tax document as SlipFields for the OCR-review screen — used by the
// LINE "แก้ไข" deep link (?review=<id>) so a pending slip can be reviewed/edited
// in the web app before confirming. RLS scopes it to the caller's own rows.
export async function getReviewSlip(id: string): Promise<SlipFields | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data, error } = await supabase
    .from("tax_documents")
    .select(
      "payer_name, payer_tax_id, income_subtype, gross_amount, wht_amount, wht_rate, pay_date, doc_ref, tax_year, bond_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    console.error("getReviewSlip failed:", error?.message);
    return null;
  }
  // Resolve the bond code separately (avoid an embed that can fail on relationship
  // inference); net_amount isn't stored, so derive it from gross − wht.
  let bondSymbol: string | null = null;
  if (data.bond_id) {
    const { data: bond } = await supabase.from("bonds").select("symbol").eq("id", data.bond_id).maybeSingle();
    bondSymbol = bond?.symbol ?? null;
  }
  const net =
    data.gross_amount != null && data.wht_amount != null
      ? Math.round((data.gross_amount - data.wht_amount) * 100) / 100
      : null;
  return {
    payer_name: data.payer_name,
    payer_tax_id: data.payer_tax_id,
    income_subtype: data.income_subtype,
    gross_amount: data.gross_amount,
    net_amount: net,
    wht_amount: data.wht_amount,
    wht_rate: data.wht_rate,
    pay_date: data.pay_date,
    doc_ref: data.doc_ref,
    tax_year: data.tax_year,
    bond_symbol: bondSymbol,
  };
}

// Update a pending LINE slip from the OCR-review screen, then confirm it.
export async function confirmReviewedSlip(id: string, fields: SlipFields): Promise<SaveResult> {
  if (!supabaseEnabled || !supabase) {
    notifyPortfolioChanged();
    return { ok: true };
  }
  const bondId = await resolveBondId(fields.bond_symbol);
  const { error } = await supabase
    .from("tax_documents")
    .update({
      status: "confirmed",
      payer_name: fields.payer_name,
      payer_tax_id: fields.payer_tax_id,
      gross_amount: fields.gross_amount,
      wht_amount: fields.wht_amount,
      wht_rate: fields.wht_rate,
      pay_date: fields.pay_date,
      tax_year: fields.tax_year,
      bond_id: bondId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await bindBondPayerTaxId(fields.bond_symbol, fields.payer_tax_id);
  notifyPortfolioChanged();
  return { ok: true };
}

// Delete a user's own tax document. RLS scopes the delete to rows the caller owns.
export async function deleteTaxDocument(id: string): Promise<SaveResult> {
  if (!supabaseEnabled || !supabase) {
    notifyPortfolioChanged();
    return { ok: true };
  }
  const { error } = await supabase.from("tax_documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  notifyPortfolioChanged();
  return { ok: true };
}
