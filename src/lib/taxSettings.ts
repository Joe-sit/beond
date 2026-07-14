import { supabase, supabaseEnabled } from "./supabase";

// Thai personal-income-tax progressive brackets (ภ.ง.ด.90/91). Each entry is a
// marginal bracket: income in [min, max] is taxed at `rate`%. The last bracket
// has no upper bound (max = Infinity). Bond coupon WHT is a flat 15%, so a user
// whose marginal rate is below 15% is over-withheld (refund) and above 15% may
// owe more — the setting lets the app reason about that.
export interface TaxBracket {
  rate: number; // marginal %
  min: number;
  max: number; // Infinity for the top bracket
}

export const TAX_BRACKETS: TaxBracket[] = [
  { rate: 0, min: 0, max: 150_000 },
  { rate: 5, min: 150_001, max: 300_000 },
  { rate: 10, min: 300_001, max: 500_000 },
  { rate: 15, min: 500_001, max: 750_000 },
  { rate: 20, min: 750_001, max: 1_000_000 },
  { rate: 25, min: 1_000_001, max: 2_000_000 },
  { rate: 30, min: 2_000_001, max: 5_000_000 },
  { rate: 35, min: 5_000_001, max: Infinity },
];

export const bracketByRate = (rate: number): TaxBracket =>
  TAX_BRACKETS.find((b) => b.rate === rate) ?? TAX_BRACKETS[0];

// Bond coupon interest (40(4)) is withheld at a flat 15% that the taxpayer MAY
// treat as a final tax (exclude from the annual return) OR include it and claim
// the credit. Which is better depends purely on their marginal bracket:
//   • below 15% → include & claim → refund of the over-withheld difference
//   • exactly 15% → no difference either way
//   • above 15% → keep it as FINAL tax; filing would only add the progressive gap
export type TaxVerdict = "claim" | "neutral" | "final";

export interface TaxAdvice {
  verdict: TaxVerdict;
  label: string; // short recommendation
  detail: string; // one-line explanation
}

export function taxAdvice(rate: number): TaxAdvice {
  if (rate < 15)
    return {
      verdict: "claim",
      label: "แนะนำ: ยื่นรวมเพื่อขอคืนภาษี",
      detail: "ฐานภาษีของคุณต่ำกว่า 15% — นำดอกเบี้ยมายื่นรวมเพื่อขอคืนส่วนต่างที่ถูกหักเกินได้",
    };
  if (rate === 15)
    return {
      verdict: "neutral",
      label: "ยื่นหรือไม่ยื่นก็เท่ากัน",
      detail: "ฐานภาษีของคุณเท่ากับหัก ณ ที่จ่าย 15% พอดี — ไม่มีส่วนต่างให้ขอคืนหรือจ่ายเพิ่ม",
    };
  return {
    verdict: "final",
    label: "แนะนำ: เลือกเป็น Final Tax (ไม่ต้องยื่นรวม)",
    detail: "ฐานภาษีของคุณสูงกว่า 15% — เก็บภาษีหัก ณ ที่จ่ายเป็นภาษีสุดท้าย ถ้ายื่นรวมจะต้องจ่ายภาษีส่วนต่างเพิ่ม",
  };
}

// Rough refundable amount when the user's bracket is below 15%: the portion of
// the WHT that exceeds what they'd owe at their marginal rate. Marginal
// approximation — refund ≈ totalWht × (15 − rate) / 15.
export function estimatedRefund(totalWht: number, rate: number): number {
  if (rate >= 15 || totalWht <= 0) return 0;
  return Math.round(totalWht * ((15 - rate) / 15) * 100) / 100;
}

// The caller's marginal tax rate (%), or null when unset / logged out / mock.
export async function getMarginalRate(): Promise<number | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return null;
  const { data } = await supabase
    .from("users").select("marginal_tax_rate").eq("id", userId).maybeSingle();
  const r = data?.marginal_tax_rate;
  return r === null || r === undefined ? null : Number(r);
}

// Persist the caller's marginal tax rate (%).
export async function saveMarginalRate(rate: number): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseEnabled || !supabase) return { ok: true };
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  const { error } = await supabase
    .from("users").update({ marginal_tax_rate: rate }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
