import { supabase } from "./supabase";
import { deriveCouponSchedule } from "./couponSchedule";
import type { BondCandidate } from "./secApi";

// SEC doesn't classify bonds by industry — new bonds land in "unclassified".
const FALLBACK_SECTOR_ID = "other";

// Insert one bond holding (+ its payout schedule) for a user, creating the shared
// bonds catalog row on demand. Throws on any failure (incl. a duplicate holding).
// Verification of the payer tax id is the CALLER's job (kept out so this stays a
// pure DB helper reusable from the add-bond flow and the slip-scan auto-add).
export async function createBondHolding(
  cand: BondCandidate,
  faceValue: number,
  freqV: number,
  ratingV: string,
  payerTaxId: string | null,
  publicUserId: string,
): Promise<void> {
  if (!supabase) return;
  const schedule = deriveCouponSchedule({
    issueDate: cand.issueDate,
    maturityDate: cand.maturityDate,
    termYears: cand.termYears,
    frequency: freqV, // user-picked; SEC omits payment frequency
    couponRate: cand.couponRate,
    faceValue,
  });

  let { data: bond } = await supabase
    .from("bonds")
    .select("id")
    .eq("symbol", cand.symbol)
    .maybeSingle();

  if (!bond) {
    const { data: inserted, error: bondErr } = await supabase
      .from("bonds")
      .insert({
        symbol: cand.symbol,
        issuer: cand.issuer,
        sector_id: FALLBACK_SECTOR_ID,
        coupon_rate: cand.couponRate ?? 0,
        total_installments:
          schedule.length ||
          (cand.termYears ? Math.max(1, Math.round(cand.termYears * 2)) : 4),
        maturity_date: cand.maturityDate,
        issue_date: cand.issueDate,
        coupon_freq: freqV,
        rating: ratingV || null,
        payer_tax_id: payerTaxId,
      })
      .select("id")
      .single();
    if (bondErr) throw bondErr;
    bond = inserted;
  }

  // Block adding a bond already in this user's portfolio (same symbol → same
  // shared bond row → dup holding).
  const { data: existing } = await supabase
    .from("holdings")
    .select("id")
    .eq("user_id", publicUserId)
    .eq("bond_id", bond!.id)
    .limit(1);
  if (existing && existing.length) throw new Error(`หุ้นกู้ ${cand.symbol} มีอยู่ในพอร์ตแล้ว`);

  const { data: holding, error: holdErr } = await supabase
    .from("holdings")
    .insert({ user_id: publicUserId, bond_id: bond!.id, face_value: faceValue })
    .select("id")
    .single();
  if (holdErr) throw holdErr;

  // Seed this holding's payout timeline from the derived schedule.
  if (holding && schedule.length) {
    const { error: payErr } = await supabase.from("payouts").insert(
      schedule.map((p) => ({
        holding_id: holding.id,
        installment: p.installment,
        amount: p.amount,
        payout_date: p.date,
      })),
    );
    if (payErr) throw payErr;
  }
}
