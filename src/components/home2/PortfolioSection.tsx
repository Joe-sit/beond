import { useMemo } from "react";
import { usePortfolioStats, useHoldings, useTimeline } from "../../hooks/usePortfolio";
import { issuerColor } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";
import mascot from "../../assets/mascot-2d.png";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));
const BRAND_GREEN = "#2FA35B";
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// Portfolio overview — a hero (total value + monthly average) sitting over a
// city skyline of the biggest holdings, and a monthly coupon-income bar chart.
export default function PortfolioSection() {
  const { totalValue } = usePortfolioStats();
  const { holdings } = useHoldings();
  const { months } = useTimeline();

  // Average monthly income = annual coupon / 12.
  const avgMonthly = useMemo(() => {
    const annual = holdings.reduce((s, h) => s + h.faceValue * h.couponRate, 0);
    return annual / 12;
  }, [holdings]);

  // Skyline — the biggest holdings, tallest in the centre (like the mock). Cap
  // to 7 so it stays readable.
  const skyline = useMemo(() => {
    const top = [...holdings].sort((a, b) => b.faceValue - a.faceValue).slice(0, 7);
    const max = top[0]?.faceValue ?? 1;
    // Re-order so the tallest is centred, alternating outwards.
    const ordered: typeof top = [];
    top.forEach((h, i) => (i % 2 === 0 ? ordered.push(h) : ordered.unshift(h)));
    return ordered.map((h, i) => ({
      h,
      pct: 0.42 + 0.58 * (h.faceValue / max),
      isTop: h.faceValue === max,
      key: `${h.symbol}-${i}`,
    }));
  }, [holdings]);

  // Monthly income bars across the whole timeline.
  const bars = useMemo(() => {
    const now = new Date();
    const beY = now.getFullYear() + 543;
    const curMonth = THAI_MONTHS[now.getMonth()];
    const list = months.map((m) => {
      const value = m.payouts.reduce((s, p) => s + p.amount, 0);
      const top = [...m.payouts].sort((a, b) => b.amount - a.amount)[0];
      return {
        label: m.month.slice(0, 3),
        value,
        top,
        isCurrent: m.month === curMonth && Number(m.year) === beY,
      };
    });
    const max = Math.max(1, ...list.map((b) => b.value));
    return { list, max };
  }, [months]);

  return (
    <div className="relative w-full max-w-5xl">
      {/* Hero — gradient sky with the skyline + total value */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#5B8FD6] to-[#CFE0F2] px-8 pt-8 pb-32">
        <div className="relative z-10">
          <p className="text-sm text-white/85">พอร์ตโฟลิโอของฉัน</p>
          <p className="mt-1 text-4xl font-medium text-white">฿{fmtTHB(totalValue)}</p>
          <p className="mt-1 text-sm text-white/85">เฉลี่ยต่อเดือน ฿{fmtTHB(avgMonthly)}</p>
        </div>

        {/* Bottom band — mascot on the left, holdings skyline on the right */}
        <div className="mt-6 flex items-end justify-between gap-4">
          <img src={mascot} alt="" aria-hidden className="pointer-events-none h-28 w-auto shrink-0" />
          <div className="flex items-end gap-2">
            {skyline.map(({ h, pct, isTop, key }) => {
              const color = isTop ? BRAND_GREEN : issuerColor(h.symbol);
              return (
                <div key={key} className="relative w-14 rounded-t-md" style={{ height: 190 * pct, background: color }}>
                  {/* darker right side for depth */}
                  <div
                    className="absolute top-1.5 -right-2 h-full w-2"
                    style={{ background: color, filter: "brightness(0.78)", clipPath: "polygon(0 0, 100% 6px, 100% 100%, 0 100%)" }}
                  />
                  <span className="absolute top-2 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-sm">
                    <IssuerLogo symbol={h.symbol} name={h.issuer} size={30} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Income bar chart — overlaps the hero bottom */}
      <div className="relative z-20 -mt-28 mx-4 rounded-[28px] bg-white p-6 shadow-xl">
        <div className="flex items-end gap-3 overflow-x-auto pb-2">
          {bars.list.map((b, i) => {
            const height = 200 * (b.value / bars.max);
            return (
              <div key={i} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
                <div className="flex h-[220px] w-full items-end justify-center">
                  <div className="relative flex w-8 justify-center">
                    {b.top && b.value > 0 && (
                      <span className="absolute -top-9 flex size-8 items-center justify-center rounded-full border border-black/5 bg-white shadow-sm">
                        <IssuerLogo symbol={b.top.symbol} name={b.top.issuer} size={26} />
                      </span>
                    )}
                    <div
                      className={`w-8 rounded-full ${b.isCurrent ? "bg-ink" : "bg-black/10"}`}
                      style={{ height: Math.max(6, height) }}
                    />
                  </div>
                </div>
                <span className="text-xs text-ink/60">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
