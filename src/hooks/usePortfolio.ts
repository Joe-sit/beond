import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import {
  allocationHoldings as mockHoldings,
  mockTimeline,
  type AllocationHolding,
  type TimelineMonth,
} from "../data/mockData";
import { RATING_META, ratingFamily, ratingRank, type RatingFamily } from "../data/ratingMeta";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

interface HoldingRow {
  face_value: number;
  bonds: {
    symbol: string;
    rating: string | null;
    sectors: { id: string; label_th: string; color: string };
  };
}

// Group holdings by sector — the default allocation view.
function groupBySector(rows: HoldingRow[]): AllocationHolding[] {
  const map = new Map<string, AllocationHolding>();
  let total = 0;
  for (const row of rows) {
    const sector = row.bonds.sectors;
    const v = Number(row.face_value);
    total += v;
    const prev = map.get(sector.id);
    if (prev) prev.value += v;
    else map.set(sector.id, { id: sector.id, label: sector.label_th, color: sector.color, value: v, pct: 0 });
  }
  return [...map.values()]
    .map((h) => ({ ...h, pct: Math.round((h.value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

// Group by individual bond series (one pillar per symbol), largest first.
function groupByBond(rows: HoldingRow[]): AllocationHolding[] {
  const map = new Map<string, AllocationHolding>();
  let total = 0;
  for (const row of rows) {
    const sym = row.bonds.symbol;
    const v = Number(row.face_value);
    total += v;
    const prev = map.get(sym);
    if (prev) prev.value += v;
    else map.set(sym, { id: sym, label: sym, color: row.bonds.sectors?.color ?? "#4A5AA8", value: v, pct: 0 });
  }
  return [...map.values()]
    .map((h) => ({ ...h, pct: Math.round((h.value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

// Group holdings by credit-rating family (AAA…B, nonRate), safest first.
function groupByRating(rows: HoldingRow[]): AllocationHolding[] {
  const map = new Map<string, AllocationHolding>();
  let total = 0;
  for (const row of rows) {
    const fam = ratingFamily(row.bonds.rating);
    const v = Number(row.face_value);
    total += v;
    const prev = map.get(fam);
    if (prev) prev.value += v;
    else map.set(fam, { id: fam, label: RATING_META[fam].label, color: RATING_META[fam].color, value: v, pct: 0 });
  }
  return [...map.values()]
    .map((h) => ({ ...h, pct: Math.round((h.value / total) * 100) }))
    .sort((a, b) => ratingRank(a.id as RatingFamily) - ratingRank(b.id as RatingFamily));
}

interface PayoutRow {
  installment: number;
  amount: number;
  payout_date: string;
  holdings: {
    id: string;
    bonds: {
      symbol: string;
      issuer: string;
      total_installments: number;
      sectors: { color: string } | null;
    };
  };
}

// Cross-component refresh bus: any write (add / delete / seed) calls
// notifyPortfolioChanged() and every mounted hook re-reads. Reliable even when
// Supabase Realtime isn't delivering events; realtime below is a bonus.
const portfolioListeners = new Set<() => void>();

export function notifyPortfolioChanged(): void {
  portfolioListeners.forEach((l) => l());
}

function subscribePortfolio(cb: () => void): () => void {
  portfolioListeners.add(cb);
  return () => {
    portfolioListeners.delete(cb);
  };
}

// Re-runs `onChange` whenever a Postgres change lands on `table` (Supabase
// Realtime), so views stay live without a page reload. Needs the table in the
// `supabase_realtime` publication (migration 0006).
function useRealtimeRefetch(table: string, onChange: () => void) {
  // Unique per hook instance — two hooks watching the same table (e.g.
  // allocation + holdings both watch "holdings") must not share a channel name,
  // or the second .on() throws "callbacks ... after subscribe()".
  const channelId = useRef(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    const channel = supabase
      .channel(`rt-${table}-${channelId.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => onChange())
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [table, onChange]);
}

// Allocation grouped by sector. Falls back to mock data until Supabase is
// configured and seeded; live-refreshes on holdings changes.
export function useAllocation(groupBy: "sector" | "rating" | "bond" = "sector"): {
  holdings: AllocationHolding[];
  refetch: () => void;
} {
  // With Supabase on, real data is the only source — no mock underneath, so
  // an empty DB reads as empty (not fake data). Mock only when Supabase is off.
  const [holdings, setHoldings] = useState<AllocationHolding[]>(
    supabaseEnabled ? [] : mockHoldings,
  );

  const load = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const { data, error } = await supabase
      .from("holdings")
      .select("face_value, bonds(symbol, rating, sectors(id, label_th, color))");
    if (error) return;
    if (!data.length) {
      setHoldings([]);
      return;
    }
    const rows = data as unknown as HoldingRow[];
    setHoldings(
      groupBy === "rating"
        ? groupByRating(rows)
        : groupBy === "bond"
          ? groupByBond(rows)
          : groupBySector(rows),
    );
  }, [groupBy]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("holdings", load);

  return { holdings, refetch: load };
}

// Per-holding detail for the manage/CRUD view — carries the bond attributes
// needed to re-derive the payout schedule when a holding is edited.
export interface HoldingDetail {
  id: string;
  faceValue: number;
  symbol: string;
  issuer: string;
  sectorId: string;
  rating: string | null;
  couponRate: number;
  couponFreq: number | null;
  issueDate: string | null;
  maturityDate: string | null;
  totalInstallments: number;
}

interface HoldingDetailRow {
  id: string;
  face_value: number;
  bonds: {
    symbol: string;
    issuer: string;
    sector_id: string;
    rating: string | null;
    coupon_rate: number;
    coupon_freq: number | null;
    issue_date: string | null;
    maturity_date: string | null;
    total_installments: number;
  } | null;
}

// The signed-in user's holdings with their bond details; live-refreshes on any
// portfolio change (add / edit / delete from web or the LINE bot).
export function useHoldings(): {
  holdings: HoldingDetail[];
  loading: boolean;
  refetch: () => void;
} {
  const [holdings, setHoldings] = useState<HoldingDetail[]>([]);
  // Start loading only when Supabase drives the data; offline mock is instant.
  const [loading, setLoading] = useState(supabaseEnabled);

  const load = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const { data, error } = await supabase
      .from("holdings")
      .select(
        "id, face_value, bonds(symbol, issuer, sector_id, rating, coupon_rate, coupon_freq, issue_date, maturity_date, total_installments)",
      )
      .order("id");
    if (error) return;
    const rows = (data as unknown as HoldingDetailRow[])
      .filter((r) => r.bonds)
      .map((r) => ({
        id: r.id,
        faceValue: Number(r.face_value),
        symbol: r.bonds!.symbol,
        issuer: r.bonds!.issuer,
        sectorId: r.bonds!.sector_id,
        rating: r.bonds!.rating,
        couponRate: Number(r.bonds!.coupon_rate),
        couponFreq: r.bonds!.coupon_freq,
        issueDate: r.bonds!.issue_date,
        maturityDate: r.bonds!.maturity_date,
        totalInstallments: r.bonds!.total_installments,
      }));
    setHoldings(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("holdings", load);

  return { holdings, loading, refetch: load };
}

// Twelve-month payout timeline (BE year). Falls back to mock data; live-
// refreshes on payouts changes so adding a bond updates it in real time.
export function useTimeline(): {
  months: TimelineMonth[];
  refetch: () => void;
} {
  // Same rule as allocation: real data only when Supabase is on; mock is a
  // pure offline fallback so it can never sit on top of live data.
  const [months, setMonths] = useState<TimelineMonth[]>(
    supabaseEnabled ? [] : mockTimeline,
  );

  const load = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const { data, error } = await supabase
      .from("payouts")
      .select(
        "installment, amount, payout_date, holdings!inner(id, bonds(symbol, issuer, total_installments, sectors(color)))",
      )
      .order("payout_date");
    if (error) return;
    if (!data.length) {
      setMonths([]);
      return;
    }
    const rows = data as unknown as PayoutRow[];
    // Continuous month timeline spanning the start year through the year of the
    // final payout, so the user can scroll all the way to their last coupon.
    // Start = current year when it has payouts, else the next upcoming year,
    // else the earliest — end = the last payout year.
    const years = [
      ...new Set(rows.map((r) => new Date(r.payout_date).getFullYear())),
    ].sort((a, b) => a - b);
    const now = new Date().getFullYear();
    const startYear = Math.min(
      (years.includes(now) ? now : years.find((y) => y > now)) ?? years[0],
      years[years.length - 1],
    );
    const endYear = years[years.length - 1];
    const skeleton: TimelineMonth[] = [];
    for (let y = startYear; y <= endYear; y++) {
      for (let i = 0; i < THAI_MONTHS.length; i++) {
        skeleton.push({
          id: `m-${y}-${i}`,
          month: THAI_MONTHS[i],
          year: String(y + 543),
          payouts: [],
        });
      }
    }
    const idxOf = (y: number, m: number) => (y - startYear) * 12 + m;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const row of rows) {
      const d = new Date(row.payout_date);
      if (d.getFullYear() < startYear || d.getFullYear() > endYear) continue;
      const bond = row.holdings.bonds;
      skeleton[idxOf(d.getFullYear(), d.getMonth())].payouts.push({
        id: `${row.holdings.id}-${row.installment}`,
        issuer: bond.issuer,
        symbol: bond.symbol,
        installment: `${row.installment}/${bond.total_installments}`,
        payoutDate: d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        amount: Number(row.amount),
        color: bond.sectors?.color ?? undefined,
        // Bond fully redeemed once its last coupon has been paid.
        completed: Number(row.installment) === bond.total_installments && d < today,
      });
    }
    setMonths(skeleton);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("payouts", load);

  return { months, refetch: load };
}

// Withholding-tax credits from OCR'd 50-ทวิ slips (added via the LINE bot),
// live-syncing into the web app. Only the fields a 40(4) filing needs — no
// national ID is ever stored.
export interface TaxDoc {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  payerName: string | null;
  symbol: string | null;
  incomeSubtype: string | null;
  grossAmount: number | null;
  whtAmount: number | null;
  whtRate: number | null;
  payDate: string | null;
  taxYear: number | null;
}

interface TaxDocRow {
  id: string;
  status: TaxDoc["status"];
  payer_name: string | null;
  income_subtype: string | null;
  gross_amount: number | null;
  wht_amount: number | null;
  wht_rate: number | null;
  pay_date: string | null;
  tax_year: number | null;
  bonds: { symbol: string } | null;
}

export function useTaxCredits(): { docs: TaxDoc[]; refetch: () => void } {
  const [docs, setDocs] = useState<TaxDoc[]>([]);

  const load = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const { data, error } = await supabase
      .from("tax_documents")
      .select(
        "id, status, payer_name, income_subtype, gross_amount, wht_amount, wht_rate, pay_date, tax_year, bonds(symbol)",
      )
      .neq("status", "rejected")
      .order("pay_date", { ascending: false, nullsFirst: false });
    if (error) return;
    setDocs(
      (data as unknown as TaxDocRow[]).map((r) => ({
        id: r.id,
        status: r.status,
        payerName: r.payer_name,
        symbol: r.bonds?.symbol ?? null,
        incomeSubtype: r.income_subtype,
        grossAmount: r.gross_amount === null ? null : Number(r.gross_amount),
        whtAmount: r.wht_amount === null ? null : Number(r.wht_amount),
        whtRate: r.wht_rate === null ? null : Number(r.wht_rate),
        payDate: r.pay_date,
        taxYear: r.tax_year,
      })),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("tax_documents", load);

  return { docs, refetch: load };
}

// Current Thai tax year in the Buddhist calendar (พ.ศ.).
export function currentTaxYearBE(): number {
  return new Date().getFullYear() + 543;
}

// Total coupon income received/scheduled in the current calendar year — the
// headline number in the hero. Live-refreshes on payout changes.
function mockAnnualIncome(): number {
  const y = new Date().getFullYear();
  return mockTimeline
    .flatMap((m) => m.payouts)
    .filter((p) => new Date(p.payoutDate).getFullYear() === y)
    .reduce((s, p) => s + p.amount, 0);
}

export function useAnnualIncome(): { total: number } {
  const [total, setTotal] = useState(supabaseEnabled ? 0 : mockAnnualIncome());

  const load = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from("payouts")
      .select("amount")
      .gte("payout_date", `${year}-01-01`)
      .lte("payout_date", `${year}-12-31`);
    if (error) return;
    setTotal((data as { amount: number }[]).reduce((s, p) => s + Number(p.amount), 0));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("payouts", load);

  return { total };
}

// Portfolio-level summary stats derived from the signed-in user's holdings:
// total invested, face-value-weighted average coupon, and weighted average
// years remaining to maturity.
export interface PortfolioStats {
  totalValue: number;
  avgCoupon: number;
  avgRemainingYears: number;
}

export function usePortfolioStats(): PortfolioStats {
  const { holdings } = useHoldings();
  const totalValue = holdings.reduce((s, h) => s + h.faceValue, 0);
  if (!holdings.length) return { totalValue: 0, avgCoupon: 0, avgRemainingYears: 0 };

  // Coupon = yield on invested capital, so it's face-value-weighted (a big
  // holding pulls the average toward its rate). Remaining years = a plain
  // per-bond average (each bond counts the same), matching beBond.
  const now = Date.now();
  const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

  const avgCoupon = totalValue
    ? holdings.reduce((s, h) => s + h.couponRate * h.faceValue, 0) / totalValue
    : 0;

  const dated = holdings.filter((h) => h.maturityDate);
  const avgRemainingYears = dated.length
    ? dated.reduce(
        (s, h) => s + Math.max(0, (new Date(h.maturityDate!).getTime() - now) / YEAR_MS),
        0,
      ) / dated.length
    : 0;

  return { totalValue, avgCoupon, avgRemainingYears };
}
