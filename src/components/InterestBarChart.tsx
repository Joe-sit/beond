import { useState } from "react";
import type { TimelineMonth } from "../data/mockData";
import { issuerName } from "../lib/issuerLogo";

// Coupon interest is taxed 15% at source; the chart plots the net received.
const WHT_RATE = 0.15;
const net = (gross: number) => Math.round(gross * (1 - WHT_RATE));

function formatShortTHB(v: number): string {
  if (v === 0) return "0";
  const k = v / 1000;
  return `฿${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}
function formatTHB(v: number): string {
  return new Intl.NumberFormat("th-TH").format(v);
}

const MONTH_ABBR: Record<string, string> = {
  มกราคม: "ม.ค.", กุมภาพันธ์: "ก.พ.", มีนาคม: "มี.ค.", เมษายน: "เม.ย.",
  พฤษภาคม: "พ.ค.", มิถุนายน: "มิ.ย.", กรกฎาคม: "ก.ค.", สิงหาคม: "ส.ค.",
  กันยายน: "ก.ย.", ตุลาคม: "ต.ค.", พฤศจิกายน: "พ.ย.", ธันวาคม: "ธ.ค.",
};

// Distinct palette assigned PER BOND (symbol), not per sector — so two bonds
// paying in the same month always get different colours and the stacked
// segments stay visually separable.
const PALETTE = [
  "#4A5AA8", "#5990D7", "#2FA8AD", "#5FB865",
  "#E0991B", "#E8763A", "#D95F8A", "#9B6FD0",
];

// Round up to a clean axis maximum (1/2/5 × 10ⁿ).
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

interface Segment {
  id: string;
  amount: number;
  color: string;
  symbol: string;
  company: string;
  installment: string;
  completed?: boolean;
}
interface Bar {
  key: string;
  label: string;
  year: string;
  total: number;
  segments: Segment[];
}

// Stacked bar chart of monthly net coupon income — HeroUI-Pro-style bars with a
// dark hover tooltip breaking the month down by bond.
export default function InterestBarChart({ months }: { months: TimelineMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // Stable colour per bond across the whole chart (sorted for determinism).
  const symbols = [...new Set(months.flatMap((m) => m.payouts.map((p) => p.symbol)))].sort();
  const colorBySymbol = new Map(symbols.map((s, i) => [s, PALETTE[i % PALETTE.length]]));

  const bars: Bar[] = months.map((m) => {
    const segments = m.payouts.map((p) => ({
      id: p.id,
      amount: net(p.amount),
      color: colorBySymbol.get(p.symbol) ?? PALETTE[0],
      symbol: p.symbol,
      company: issuerName(p.symbol, p.issuer),
      installment: p.installment,
      completed: p.completed,
    }));
    return {
      key: m.id,
      label: MONTH_ABBR[m.month] ?? m.month,
      year: m.year,
      total: segments.reduce((s, x) => s + x.amount, 0),
      segments,
    };
  });

  const max = niceCeil(Math.max(...bars.map((b) => b.total), 1));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => f * max); // top → bottom

  return (
    <div className="mt-4 rounded-3xl border border-[#E7E7E7] bg-white p-5">
      <div className="flex gap-3">
        {/* Y axis */}
        <div className="flex h-64 flex-col justify-between py-0.5 text-right font-nunito text-[11px] text-black/40">
          {ticks.map((t, i) => (
            <span key={i}>{formatShortTHB(t)}</span>
          ))}
        </div>

        {/* Plot */}
        <div className="min-w-0 flex-1">
          <div className="relative h-64">
            {/* Gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {ticks.map((_, i) => (
                <div key={i} className="h-px w-full bg-black/6" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative flex h-full items-end gap-1.5">
              {bars.map((b, i) => (
                <div
                  key={b.key}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {b.total > 0 && (
                    <div
                      className={`flex w-full max-w-8.5 flex-col-reverse overflow-hidden rounded-t-lg transition-[filter] ${
                        hover !== null && hover !== i ? "brightness-105 saturate-50 opacity-60" : ""
                      }`}
                      style={{ height: `${(b.total / max) * 100}%` }}
                    >
                      {b.segments.map((s) => (
                        <div
                          key={s.id}
                          className="w-full"
                          style={{
                            height: `${(s.amount / b.total) * 100}%`,
                            backgroundColor: s.color,
                            opacity: s.completed ? 0.5 : 1,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Tooltip */}
                  {hover === i && b.total > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-55 -translate-x-1/2 rounded-2xl bg-[#181D20] p-3 text-left shadow-lg">
                      <p className="mb-2 text-xs font-medium text-white/60">
                        {b.label} {b.year}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {b.segments.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="font-nunito font-bold text-white">{s.symbol}</span>
                            <span className="ml-auto pl-3 font-nunito font-bold text-white">
                              ฿{formatTHB(s.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                        <span className="text-white/60">รวมสุทธิ</span>
                        <span className="font-nunito font-bold text-white">฿{formatTHB(b.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* X labels */}
          <div className="mt-2 flex gap-1.5">
            {bars.map((b) => (
              <div
                key={b.key}
                className={`min-w-0 flex-1 text-center text-[11px] ${
                  b.total > 0 ? "font-medium text-black/60" : "text-black/30"
                }`}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
