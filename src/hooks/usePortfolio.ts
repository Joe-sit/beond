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
    bonds: { symbol: string; issuer: string; total_installments: number };
  };
}

// Allocation grouped by sector. Falls back to mock data until Supabase is
// configured and seeded.
export function useAllocation(): {
  holdings: AllocationHolding[];
  refetch: () => void;
} {
  // With Supabase on, real data is the only source — no mock underneath, so
  // an empty DB reads as empty (not fake data). Mock only when Supabase is off.
  const [holdings, setHoldings] = useState<AllocationHolding[]>(
    supabaseEnabled ? [] : mockHoldings,
  );
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    supabase
      .from("holdings")
      .select("face_value, bonds(symbol, sectors(id, label_th, color))")
      .then(({ data, error }) => {
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
      });
  }, [version]);

  return { holdings, refetch };
}

// Twelve-month payout timeline (BE year). Falls back to mock data.
export function useTimeline(): TimelineMonth[] {
  // Same rule as allocation: real data only when Supabase is on; mock is a
  // pure offline fallback so it can never sit on top of live data.
  const [months, setMonths] = useState<TimelineMonth[]>(
    supabaseEnabled ? [] : mockTimeline,
  );

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    supabase
      .from("payouts")
      .select(
        "installment, amount, payout_date, holdings!inner(bonds(symbol, issuer, total_installments))",
      )
      .order("payout_date")
      .then(({ data, error }) => {
        if (error) return;
        if (!data.length) {
          setMonths([]);
          return;
        }
        const rows = data as unknown as PayoutRow[];
        // Schedules span multiple years; show the current year when it has
        // payouts, else the next upcoming year, else the latest — so the
        // 12-month view reflects what the user is actually receiving now.
        const years = [
          ...new Set(rows.map((r) => new Date(r.payout_date).getFullYear())),
        ].sort((a, b) => a - b);
        const now = new Date().getFullYear();
        const year =
          (years.includes(now) ? now : years.find((y) => y > now)) ??
          years[years.length - 1];
        const skeleton: TimelineMonth[] = THAI_MONTHS.map((m, i) => ({
          id: `m-${i}`,
          month: m,
          year: String(year + 543),
          payouts: [],
        }));
        for (const row of rows) {
          const d = new Date(row.payout_date);
          if (d.getFullYear() !== year) continue;
          const bond = row.holdings.bonds;
          skeleton[d.getMonth()].payouts.push({
            id: `${bond.symbol}-${row.installment}`,
            issuer: bond.issuer,
            symbol: bond.symbol,
            installment: `${row.installment}/${bond.total_installments}`,
            payoutDate: d.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            amount: Number(row.amount),
          });
        }
        setMonths(skeleton);
      });
  }, []);

  return months;
}
