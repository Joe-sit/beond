// Add a bond to a user's portfolio straight from a scanned slip, with no trip
// to the web app.
//
// A 50-ทวิ carries everything needed except the one thing only the investor
// knows: how much they put in. But the slip's own coupon figure gives it away —
// interest = face × rate × days/365 — so with the bond's rate and schedule from
// the catalog, the face value is arithmetic, not a guess. It is snapped to the
// ฿1,000 unit bonds are actually sold in, and always shown to the user before it
// is written — they confirm it on the card and can correct it in the app.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { deriveCouponSchedule } from "./couponSchedule.ts";
import { thaibmaFeature } from "./thaibma.ts";

const FALLBACK_SECTOR_ID = "other";
/** Thai retail bonds are issued in ฿1,000 units. */
const UNIT = 1_000;
/** Below this, a derived face value is more likely a misread than a real position. */
const MIN_FACE = 10_000;
/** Above this it's not a retail position; something upstream is wrong. */
const MAX_FACE = 100_000_000;

export interface BondFacts {
  id: string | null;
  symbol: string;
  issuer: string;
  couponRate: number | null;
  frequency: number | null;
  issueDate: string | null;
  maturityDate: string | null;
  termYears: number | null;
  isin: string | null;
}

/** Catalog row first (authoritative), ThaiBMA only to fill what's missing. */
export async function loadBondFacts(
  admin: SupabaseClient,
  symbol: string,
  fallbackIssuer: string | null,
): Promise<BondFacts | null> {
  const sym = symbol.toUpperCase();
  const { data: row } = await admin
    .from("bonds")
    .select("id, symbol, issuer, coupon_rate, coupon_freq, issue_date, maturity_date")
    .eq("symbol", sym)
    .maybeSingle();

  const facts: BondFacts = {
    id: (row?.id as string | undefined) ?? null,
    symbol: (row?.symbol as string | undefined) ?? sym,
    issuer: (row?.issuer as string | undefined) ?? fallbackIssuer ?? sym,
    couponRate: (row?.coupon_rate as number | null) ?? null,
    frequency: (row?.coupon_freq as number | null) ?? null,
    issueDate: (row?.issue_date as string | null) ?? null,
    maturityDate: (row?.maturity_date as string | null) ?? null,
    termYears: null,
    isin: null,
  };

  // The SEC catalog carries no payment frequency and sometimes no dates; ThaiBMA
  // has both. Best-effort — a failed lookup just leaves the gaps.
  if (!facts.couponRate || !facts.maturityDate || !facts.frequency) {
    const t = await thaibmaFeature(sym);
    if (t) {
      facts.couponRate ??= t.couponRate;
      facts.maturityDate ??= t.maturityDate;
      facts.frequency ??= t.frequency;
      facts.issueDate ??= t.issueDate;
      facts.termYears = t.termYears;
      facts.isin = t.isin;
      if (!row?.issuer && t.issuer) facts.issuer = t.issuer;
    }
  }
  return facts.couponRate || facts.maturityDate ? facts : null;
}

/**
 * Back out the face value from one coupon payment.
 *
 * `days` is the real accrual period when the schedule is known (the first coupon
 * is usually a short stub, so assuming a full period there would understate the
 * position badly); otherwise it falls back to the nominal period.
 */
export function deriveFaceValue(
  gross: number,
  facts: BondFacts,
  payDate: string | null,
): number | null {
  const rate = facts.couponRate;
  if (!rate || rate <= 0 || !gross || gross <= 0) return null;

  const freq = facts.frequency && facts.frequency > 0 ? facts.frequency : 2;
  const nominalDays = Math.round(365 / freq);

  // Match the slip's pay date to a coupon in the derived schedule to recover
  // that period's true length. A unit face value makes the schedule's amounts
  // proportional, so only the dates matter here.
  if (payDate && facts.maturityDate) {
    const probe = deriveCouponSchedule({
      issueDate: facts.issueDate,
      maturityDate: facts.maturityDate,
      termYears: facts.termYears,
      frequency: freq,
      couponRate: rate,
      faceValue: UNIT,
    });
    const target = new Date(payDate).getTime();
    let best: { date: string; amount: number } | null = null;
    let bestDiff = Infinity;
    for (const p of probe) {
      const diff = Math.abs(new Date(p.date).getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = p; }
    }
    // Within ~45 days is the same coupon; further off and the slip belongs to a
    // schedule we haven't reconstructed correctly.
    if (best && bestDiff <= 45 * 86_400_000 && best.amount > 0) {
      const face = (gross / best.amount) * UNIT;
      return roundToUnit(face);
    }
  }

  return roundToUnit((gross / (rate / 100) / nominalDays) * 365);
}

// Snap to the ฿1,000 unit bonds are sold in, and refuse anything outside the
// range a retail position can plausibly occupy. This is a sanity bound, not a
// correctness proof: the figure is only as good as the coupon rate we matched,
// which is why the user is always shown the number before it is written and can
// correct it in the app afterwards.
function roundToUnit(face: number): number | null {
  if (!Number.isFinite(face) || face < MIN_FACE || face > MAX_FACE) return null;
  return Math.round(face / UNIT) * UNIT;
}

/**
 * Create the bond row (if the catalog doesn't have it), the holding, and the
 * payout schedule. Returns the holding id, or null when the user already holds
 * this bond.
 */
export async function createHoldingFromSlip(
  admin: SupabaseClient,
  userId: string,
  facts: BondFacts,
  faceValue: number,
  payerTaxId: string | null,
): Promise<{ holdingId: string; bondId: string } | null> {
  const freq = facts.frequency && facts.frequency > 0 ? facts.frequency : 2;
  const schedule = deriveCouponSchedule({
    issueDate: facts.issueDate,
    maturityDate: facts.maturityDate,
    termYears: facts.termYears,
    frequency: freq,
    couponRate: facts.couponRate,
    faceValue,
  });

  let bondId = facts.id;
  if (!bondId) {
    const { data: inserted, error } = await admin
      .from("bonds")
      .insert({
        symbol: facts.symbol,
        issuer: facts.issuer,
        sector_id: FALLBACK_SECTOR_ID,
        coupon_rate: facts.couponRate ?? 0,
        total_installments:
          schedule.length || (facts.termYears ? Math.max(1, Math.round(facts.termYears * freq)) : 4),
        maturity_date: facts.maturityDate,
        issue_date: facts.issueDate,
        coupon_freq: freq,
        payer_tax_id: payerTaxId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert bond: ${error.message}`);
    bondId = inserted.id as string;
  }

  const { data: existing } = await admin
    .from("holdings")
    .select("id")
    .eq("user_id", userId)
    .eq("bond_id", bondId)
    .limit(1);
  if (existing?.length) return null;

  const { data: holding, error: holdErr } = await admin
    .from("holdings")
    .insert({ user_id: userId, bond_id: bondId, face_value: faceValue })
    .select("id")
    .single();
  if (holdErr) throw new Error(`insert holding: ${holdErr.message}`);

  if (schedule.length) {
    const { error: payErr } = await admin.from("payouts").insert(
      schedule.map((p) => ({
        holding_id: holding.id,
        installment: p.installment,
        amount: p.amount,
        payout_date: p.date,
      })),
    );
    if (payErr) throw new Error(`insert payouts: ${payErr.message}`);
  }

  return { holdingId: holding.id as string, bondId };
}
