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

// Progressive ("stair") tax on a net taxable income — every bracket taxes only
// the slice of income that falls inside it, so the effective rate is always
// below the top marginal rate hit. This is the real ภ.ง.ด. method.
export function progressiveTax(netIncome: number): number {
  if (netIncome <= 0) return 0;
  let tax = 0;
  for (const b of TAX_BRACKETS) {
    // Slice base = the previous bracket's ceiling (b.min - 1); the first
    // bracket starts at 0. Nothing to tax once income is below this base.
    const base = Math.max(0, b.min - 1);
    if (netIncome <= base) break;
    const slice = Math.min(netIncome, b.max) - base;
    tax += slice * (b.rate / 100);
  }
  return tax;
}

// Refundable WHT for a bond holder whose OTHER income tops out at marginal
// `rate`. Thai tax is progressive on TOTAL income, so the bond interest (40(4))
// is stacked ON TOP of that other income and taxed by the brackets it climbs
// through — not a flat `interest × rate`. We assume the other income sits at
// the floor of the marginal bracket (the honest reading of "my bracket is X"),
// then tax the interest as the slice above it. refund = WHT − that tax.
//   • rate < 15  → usually over-withheld → positive refund
//   • rate ≥ 15  → interest lands at/above the 15% WHT → refund clamps to 0
export function estimatedRefund(totalWht: number, rate: number): number {
  if (totalWht <= 0) return 0;
  const interest = totalWht / 0.15; // WHT is a flat 15% of the coupon
  const floor = Math.max(0, bracketByRate(rate).min - 1); // other income ≈ bracket floor
  const taxOnInterest = progressiveTax(floor + interest) - progressiveTax(floor);
  return Math.max(0, Math.round((totalWht - taxOnInterest) * 100) / 100);
}

// Which bracket an annual (net taxable) income falls in — its index in
// TAX_BRACKETS, i.e. the income's marginal bracket.
export function bracketIndexForIncome(income: number): number {
  if (income <= 0) return 0;
  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const b = TAX_BRACKETS[i];
    if (income >= b.min && income <= b.max) return i;
  }
  return TAX_BRACKETS.length - 1;
}

// The marginal rate (%) for an actual annual income.
export function marginalRateForIncome(income: number): number {
  return TAX_BRACKETS[bracketIndexForIncome(income)].rate;
}

// The personal allowance every taxpayer gets (ค่าลดหย่อนผู้มีเงินได้). This
// example models "no other deductions", so it's the only one applied.
export const PERSONAL_ALLOWANCE = 60_000;

// Overpaid (refundable) WHT given the caller's ACTUAL annual income. Following
// the ภ.ง.ด. worksheet: the personal allowance is first subtracted from total
// income, then the bond coupon (interest, before its flat 15% WHT) is the slice
// stacked on top of the caller's other income and taxed by the brackets it
// climbs through. The refund is the WHT already paid minus that incremental tax.
//   taxableWithout = max(0, income − allowance)
//   taxableWith    = max(0, income + interest − allowance)
//   refund = WHT − [ progressiveTax(taxableWith) − progressiveTax(taxableWithout) ]
// A retiree living purely off coupons (income 0) reclaims the most — the
// interest gets both the 150k exempt band and the personal allowance — while a
// high earner has the allowance used up by salary and the interest taxed on top.
export function refundFromIncome(
  totalWht: number,
  annualIncome: number,
  allowance: number = PERSONAL_ALLOWANCE,
): number {
  if (totalWht <= 0) return 0;
  const interest = totalWht / 0.15; // WHT is a flat 15% of the coupon
  const base = Math.max(0, annualIncome);
  const taxableWithout = Math.max(0, base - allowance);
  const taxableWith = Math.max(0, base + interest - allowance);
  const interestTax = progressiveTax(taxableWith) - progressiveTax(taxableWithout);
  return Math.max(0, Math.round((totalWht - interestTax) * 100) / 100);
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

// The caller's actual annual (net taxable) income in baht, or null when unset /
// logged out / mock. Persisted per user so the tax-base page and summary cards
// agree across devices (previously localStorage-only).
export async function getAnnualIncome(): Promise<number | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return null;
  const { data } = await supabase
    .from("users").select("annual_income").eq("id", userId).maybeSingle();
  const v = data?.annual_income;
  return v === null || v === undefined ? null : Number(v);
}

// Persist the caller's actual annual income (whole baht).
export async function saveAnnualIncome(income: number): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseEnabled || !supabase) return { ok: true };
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.app_metadata?.public_user_id as string | undefined;
  if (!userId) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  const { error } = await supabase
    .from("users").update({ annual_income: Math.max(0, Math.round(income)) }).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
