import { supabase, supabaseEnabled } from "./supabase";
import { deriveCouponSchedule } from "./couponSchedule";

// A fixed, verified demo portfolio for testing the dashboard end-to-end.
// Frequencies are the real issuer values (SEC omits them). SIRI266A already
// matured, so it exercises the "ครบแล้ว" completed state.
interface TestBond {
  symbol: string;
  issuer: string;
  sectorId: string;
  couponRate: number;
  issueDate: string;
  maturityDate: string;
  frequency: number;
  faceValue: number;
}

const TEST_BONDS: TestBond[] = [
  { symbol: "BRI267A", issuer: "Britania", sectorId: "property", couponRate: 5.0, issueDate: "2024-07-12", maturityDate: "2026-07-12", frequency: 4, faceValue: 300000 },
  { symbol: "ORI288B", issuer: "Origin Property", sectorId: "property", couponRate: 5.35, issueDate: "2026-02-13", maturityDate: "2028-08-13", frequency: 4, faceValue: 500000 },
  { symbol: "BTSG28OA", issuer: "BTS Group", sectorId: "logistics", couponRate: 3.6, issueDate: "2025-10-02", maturityDate: "2028-10-02", frequency: 2, faceValue: 1000000 },
  { symbol: "GULF289A", issuer: "Gulf Energy", sectorId: "energy", couponRate: 4.0, issueDate: "2025-09-30", maturityDate: "2028-09-30", frequency: 2, faceValue: 800000 },
  { symbol: "KBANK267A", issuer: "Kasikornbank", sectorId: "finance", couponRate: 3.5, issueDate: "2024-07-01", maturityDate: "2026-07-01", frequency: 2, faceValue: 600000 },
  // Already matured -> its final coupon is in the past -> "ครบแล้ว".
  { symbol: "SIRI266A", issuer: "Sansiri", sectorId: "property", couponRate: 4.5, issueDate: "2024-06-15", maturityDate: "2026-06-15", frequency: 2, faceValue: 400000 },
];

// Wipe the demo user's holdings + bonds, then insert the fixed test set with
// derived payouts. Requires the demo delete grants (migration 0005).
export async function resetAndSeedTestData(): Promise<void> {
  if (!supabaseEnabled || !supabase) throw new Error("Supabase ไม่พร้อม");

  const { data: authData } = await supabase.auth.getUser();
  const publicUserId = authData.user?.app_metadata?.public_user_id as string | undefined;
  if (!publicUserId) throw new Error("ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่");

  // Holdings first (payouts cascade), then bonds so they re-insert clean.
  await supabase.from("holdings").delete().eq("user_id", publicUserId);
  await supabase.from("bonds").delete().not("id", "is", null);

  for (const tb of TEST_BONDS) {
    const schedule = deriveCouponSchedule({
      issueDate: tb.issueDate,
      maturityDate: tb.maturityDate,
      termYears: null,
      frequency: tb.frequency,
      couponRate: tb.couponRate,
      faceValue: tb.faceValue,
    });

    const { data: bond, error: bondErr } = await supabase
      .from("bonds")
      .insert({
        symbol: tb.symbol,
        issuer: tb.issuer,
        sector_id: tb.sectorId,
        coupon_rate: tb.couponRate,
        total_installments: schedule.length || 1,
        maturity_date: tb.maturityDate,
        issue_date: tb.issueDate,
        coupon_freq: tb.frequency,
      })
      .select("id")
      .single();
    if (bondErr) throw bondErr;

    const { data: holding, error: holdErr } = await supabase
      .from("holdings")
      .insert({ user_id: publicUserId, bond_id: bond.id, face_value: tb.faceValue })
      .select("id")
      .single();
    if (holdErr) throw holdErr;

    if (schedule.length) {
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
}
