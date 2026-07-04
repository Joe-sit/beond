import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import {
  allocationHoldings as mockHoldings,
  mockTimeline,
  type AllocationHolding,
  type TimelineMonth,
} from "../data/mockData";

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
    sectors: { id: string; label_th: string; color: string };
  };
}

interface PayoutRow {
  installment: number;
  amount: number;
  payout_date: string;
  holdings: {
    id: string;
    bonds: { symbol: string; issuer: string; total_installments: number };
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
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    const channel = supabase
      .channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => onChange())
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [table, onChange]);
}

// Allocation grouped by sector. Falls back to mock data until Supabase is
// configured and seeded; live-refreshes on holdings changes.
export function useAllocation(): {
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
      .select("face_value, bonds(symbol, sectors(id, label_th, color))");
    if (error) return;
    if (!data.length) {
      setHoldings([]);
      return;
    }
    const bySector = new Map<string, AllocationHolding>();
    let total = 0;
    for (const row of data as unknown as HoldingRow[]) {
      const sector = row.bonds.sectors;
      total += Number(row.face_value);
      const prev = bySector.get(sector.id);
      if (prev) {
        prev.value += Number(row.face_value);
      } else {
        bySector.set(sector.id, {
          id: sector.id,
          label: sector.label_th,
          color: sector.color,
          value: Number(row.face_value),
          pct: 0,
        });
      }
    }
    const result = [...bySector.values()]
      .map((h) => ({ ...h, pct: Math.round((h.value / total) * 100) }))
      .sort((a, b) => b.value - a.value);
    setHoldings(result);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribePortfolio(load), [load]);
  useRealtimeRefetch("holdings", load);

  return { holdings, refetch: load };
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
        "installment, amount, payout_date, holdings!inner(id, bonds(symbol, issuer, total_installments))",
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
