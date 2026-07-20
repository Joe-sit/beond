import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTimeline, useViewedYear, setViewedYear, useTaxCredits, useJustConfirmed, matchConfirmedPayouts } from "../../hooks/usePortfolio";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";
import Cube, { CUBE_H, CUBE_STACK_OFFSET } from "./Cube";

const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_MONTH_INDEX: Record<string, number> = {
  มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3, พฤษภาคม: 4, มิถุนายน: 5,
  กรกฎาคม: 6, สิงหาคม: 7, กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
};
const WHT = 0.15;
const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// One coupon receipt = one cube. `confirmed` means a 50-ทวิ slip was matched
// via LINE OCR (green); otherwise it's still pending (grey).
interface Payout {
  id: string;
  symbol: string;
  issuer: string;
  installment: string;
  wht: number;
  net: number;
  confirmed: boolean;
}
interface Bar {
  id: string;
  monthIdx: number;
  net: number;
  wht: number;
  gross: number;
  payouts: Payout[];
  isCurrent: boolean;
}

// Interest timeline — a row of isometric coupon cubes (one cube per installment
// in the month). Each cube is independently clickable; clicking opens its detail
// popup. Cube colour is driven by confirmation status, not by selection.
export default function TimelineCard({ onManage }: { onManage?: () => void }) {
  const { months: timeline } = useTimeline();
  const { docs } = useTaxCredits();
  const justConfirmed = useJustConfirmed(timeline, docs);
  const viewed = useViewedYear();
  // Selection key = `${barId}#${payoutIdx}` (a single cube), or null = no popup.
  const [sel, setSel] = useState<string | null>(null);
  // Hovered cube → a status tooltip rendered in a body portal (fixed), so it
  // floats above every cube without changing the cubes' own stacking order.
  const [hover, setHover] = useState<{ payout: Payout; x: number; y: number } | null>(null);

  const years = useMemo(() => [...new Set(timeline.map((m) => m.year))].sort(), [timeline]);
  const activeYear = viewed && years.includes(viewed) ? viewed : years[0] ?? "";

  const now = new Date();
  const curMonthIdx = now.getMonth();
  const curYearBE = now.getFullYear() + 543;

  // payoutId → confirmed slip (nearest-date match; see matchConfirmedPayouts).
  const matched = useMemo(() => matchConfirmedPayouts(timeline, docs), [timeline, docs]);

  const allBars: Bar[] = useMemo(() => {
    return timeline
      .filter((m) => m.year === activeYear)
      .map((m) => {
        const monthIdx = THAI_MONTH_INDEX[m.month] ?? 0;
        const gross = m.payouts.reduce((s, p) => s + p.amount, 0);
        const wht = Math.round(gross * WHT);
        const payouts: Payout[] = m.payouts.map((p) => {
          const pw = Math.round(p.amount * WHT);
          const confirmed = matched.has(p.id);
          return { id: p.id, symbol: p.symbol, issuer: p.issuer, installment: p.installment, wht: pw, net: p.amount - pw, confirmed };
        });
        return {
          id: m.id,
          monthIdx,
          gross,
          wht,
          net: gross - wht,
          payouts,
          isCurrent: monthIdx === curMonthIdx && Number(m.year) === curYearBE,
        };
      });
  }, [timeline, activeYear, curMonthIdx, curYearBE, matched]);

  const bars = allBars;
  const totalYear = allBars.reduce((s, b) => s + b.net, 0);

  // Reset the popup when the viewed year changes.
  useEffect(() => setSel(null), [activeYear]);

  const [selBarId, selIdxStr] = sel ? sel.split("#") : [null, null];
  const selBar = bars.find((b) => b.id === selBarId) ?? null;
  const selPayout = selBar && selIdxStr != null ? selBar.payouts[Number(selIdxStr)] ?? null : null;
  const yearBE = Number(activeYear) || curYearBE;

  return (
    <div className="flex flex-col rounded-3xl bg-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">ไทม์ไลน์ดอกเบี้ยปี <span className="font-nunito">{yearBE}</span></h2>
          <p className="mt-1 text-sm text-ink-soft">ดอกเบี้ยรวม ฿<span className="font-nunito">{fmtTHB(totalYear)}</span></p>
        </div>
        {years.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setViewedYear(y)}
                className={`rounded-full px-4 py-2 font-nunito font-medium transition-colors ${
                  y === activeYear ? "bg-brand font-bold text-white" : "border border-line bg-card text-ink/70 hover:border-brand/30"
                }`}
              >
                {Number(y) || y}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="relative mt-4 min-h-0 flex-1">
        {/* Floating cube detail — shown only while a cube is selected */}
        {selPayout && (
          <div className="absolute top-12 left-0 z-30 w-[46%] max-w-sm min-w-64 rounded-3xl bg-card p-6 shadow-[0_12px_40px_rgba(26,34,51,0.14)]">
            <button
              onClick={() => setSel(null)}
              aria-label="ปิด"
              className="absolute top-4 right-4 text-ink-soft/60 hover:text-ink-soft"
            >
              ✕
            </button>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <p className="font-nunito text-xl font-bold text-ink">{selPayout.symbol}</p>
                <p className="mt-1 text-sm text-ink-soft">งวด <span className="font-nunito">{selPayout.installment}</span></p>
              </div>
              {selPayout.confirmed ? (
                <span className="rounded-xl bg-success/10 px-2 py-1 text-sm text-success">ยืนยันแล้ว</span>
              ) : (
                <span className="rounded-xl bg-black/5 px-2 py-1 text-sm text-ink-soft">รอยืนยัน</span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div>
                <p className="text-sm text-ink-soft">ยอดหักภาษี ณ ที่จ่าย</p>
                <p className="mt-1 font-nunito text-2xl font-bold text-ink">฿{fmtTHB(selPayout.wht)}</p>
              </div>
              <span className="h-11 w-px rounded-full bg-black/10" />
              <div>
                <p className="text-sm text-ink-soft">คงเหลือจ่ายจริง</p>
                <p className="mt-1 font-nunito text-2xl font-bold text-ink">฿{fmtTHB(selPayout.net)}</p>
              </div>
            </div>
            <button
              onClick={onManage}
              className="mt-5 w-full rounded-2xl border border-brand-blue py-3 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/5"
            >
              จัดการ
            </button>
          </div>
        )}

        {/* Cube stacks — hovering a cube dims the others (only a real cube
            triggers it, via :has(button:hover), not empty column space) */}
        <div className="flex h-full min-h-70 items-end gap-2 [&:has(button:hover)_.cubeviz]:opacity-40 sm:gap-4">
          {bars.map((b, ci) => {
            const hasSel = b.id === selBarId;
            const cubes = Math.min(3, b.payouts.length);
            const colDelay = ci * 0.06; // rain in left→right
            return (
              <div
                key={b.id}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3 rounded-4xl px-1 pt-6 pb-2 transition-colors hover:bg-linear-to-t hover:from-sky/10 hover:to-transparent"
              >
                {/* The base cube (i=0) sits in normal flow so its bottom edge is
                    always on the same baseline — the month label lines up across
                    every column regardless of stack height. Higher cubes are
                    positioned absolutely, rising off that baseline. */}
                <div className="relative w-full max-w-36">
                  {/* Empty month → dashed placeholder cube */}
                  {b.gross === 0 && <Cube variant="empty" delay={colDelay} />}
                  {b.gross > 0 &&
                    Array.from({ length: cubes }).map((_, i) => {
                      const p = b.payouts[i];
                      const key = `${b.id}#${i}`;
                      const isSel = key === sel;
                      const base = i === 0;
                      const fresh = justConfirmed.has(p.id);
                      // Bottom cube (i=0) lands first; each higher cube then
                      // drops and stacks on top of it.
                      const cubeDelay = colDelay + i * 0.14;
                      return (
                        <button
                          key={i}
                          onClick={() => setSel((s) => (s === key ? null : key))}
                          onMouseEnter={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setHover({ payout: p, x: r.left + r.width / 2, y: r.top });
                          }}
                          onMouseLeave={() => setHover((h) => (h?.payout.id === p.id ? null : h))}
                          aria-label={`${p.symbol} งวด ${p.installment}`}
                          style={base ? { zIndex: 1 } : { zIndex: i + 1, position: "absolute", left: 0, right: 0, bottom: `${(i * CUBE_STACK_OFFSET * 100) / CUBE_H}%` }}
                          className={`group/cube relative block w-full transition-transform hover:scale-105 active:scale-95 ${
                            isSel ? "scale-105 drop-shadow-lg" : ""
                          } ${fresh ? "animate-confirm-pop" : ""}`}
                        >
                          <span className="cubeviz block transition-opacity group-hover/cube:opacity-100!">
                            <Cube variant={p.confirmed ? "confirmed" : "pending"} delay={cubeDelay}>
                              <span className={`inline-flex rounded-full ${isSel ? "ring-4 ring-brand" : ""}`}>
                                <IssuerLogo symbol={p.symbol} name={issuerName(p.symbol, p.issuer)} size={40} />
                              </span>
                            </Cube>
                          </span>
                        </button>
                      );
                    })}
                </div>
                <span className={`text-base transition-colors group-hover:font-bold group-hover:text-ink ${hasSel ? "font-bold text-ink" : "text-ink-soft"}`}>{MONTH_ABBR[b.monthIdx]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {hover &&
        createPortal(
          <div
            className="pointer-events-none fixed z-60 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 rounded-xl bg-white px-3 py-2 text-center whitespace-nowrap shadow-xl ring-1 ring-black/5"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            <span className="text-xs font-bold text-ink">
              <span className="font-nunito">{hover.payout.symbol}</span> · งวด <span className="font-nunito">{hover.payout.installment}</span>
            </span>
            <span className={`flex items-center gap-1 text-[11px] ${hover.payout.confirmed ? "text-success" : "text-ink-soft"}`}>
              <span className={`size-1.5 rounded-full ${hover.payout.confirmed ? "bg-success" : "bg-ink-soft/50"}`} />
              {hover.payout.confirmed ? "ยืนยันสลิปแล้ว" : "รอยืนยันสลิป"}
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}
