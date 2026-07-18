import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconCircleCheck } from "@tabler/icons-react";
import { useTimeline, useViewedYear, useTaxCredits, matchConfirmedPayouts, useJustConfirmed } from "../../hooks/usePortfolio";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";
import slipThumb from "../../assets/slip-thumb.svg";

const WHT = 0.15;
const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

interface SlipRow {
  id: string;
  symbol: string;
  issuer: string;
  installment: string;
  gross: number;
  wht: number;
  net: number;
  confirmed: boolean;
}

// จัดการภาษี — collect the 50-ทวิ slips for one month at a time. One card per
// coupon: green when its slip is matched (confirmed), white while pending.
export default function TaxCollectionPanel() {
  const { months: timeline } = useTimeline();
  const { docs } = useTaxCredits();
  const viewed = useViewedYear();
  const justConfirmed = useJustConfirmed(timeline, docs);

  const matched = useMemo(() => matchConfirmedPayouts(timeline, docs), [timeline, docs]);

  // Months (of the viewed year) that actually have coupons.
  const payoutMonths = useMemo(() => {
    const years = [...new Set(timeline.map((m) => m.year))].sort();
    const year = viewed && years.includes(viewed) ? viewed : years[0] ?? "";
    return timeline.filter((m) => m.year === year && m.payouts.length > 0);
  }, [timeline, viewed]);

  // Default focus = the current calendar month if it pays, else the first that
  // still has an unconfirmed slip, else the first.
  const defaultIdx = useMemo(() => {
    const curName = new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date());
    const cur = payoutMonths.findIndex((m) => m.month === curName);
    if (cur >= 0) return cur;
    const pending = payoutMonths.findIndex((m) => m.payouts.some((p) => !matched.has(p.id)));
    return pending >= 0 ? pending : 0;
  }, [payoutMonths, matched]);

  const [idx, setIdx] = useState<number | null>(null);
  const focusIdx = Math.min(idx ?? defaultIdx, Math.max(0, payoutMonths.length - 1));
  const month = payoutMonths[focusIdx];

  const rows: SlipRow[] = useMemo(() => {
    if (!month) return [];
    return month.payouts.map((p) => {
      const gross = p.amount;
      const wht = Math.round(gross * WHT);
      const doc = matched.get(p.id);
      const confirmed = !!doc;
      const net = confirmed ? (doc!.grossAmount ?? gross) - (doc!.whtAmount ?? wht) : gross - wht;
      return { id: p.id, symbol: p.symbol, issuer: p.issuer, installment: p.installment, gross, wht, net, confirmed };
    });
  }, [month, matched]);

  if (!payoutMonths.length || !month) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-3xl bg-card p-8 text-center text-sm text-ink-soft">
        ปีนี้ยังไม่มีกำหนดรับดอกเบี้ยให้เก็บสลิป
      </div>
    );
  }

  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const totalWht = rows.reduce((s, r) => s + r.wht, 0);
  const remaining = rows.filter((r) => !r.confirmed).length;

  return (
    <div className="flex flex-col rounded-3xl bg-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {payoutMonths.length > 1 && (
            <button
              onClick={() => setIdx((focusIdx - 1 + payoutMonths.length) % payoutMonths.length)}
              aria-label="เดือนก่อน"
              className="flex size-9 items-center justify-center rounded-full text-ink/60 hover:bg-brand/5"
            >
              <IconChevronLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-ink">สะสมสลิปประจำเดือน{month.month}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              ดอกเบี้ยรวม ฿<span className="font-nunito">{fmtTHB(totalGross)}</span> · ยอดหักภาษี ณ ที่จ่าย ฿
              <span className="font-nunito">{fmtTHB(totalWht)}</span>
            </p>
          </div>
          {payoutMonths.length > 1 && (
            <button
              onClick={() => setIdx((focusIdx + 1) % payoutMonths.length)}
              aria-label="เดือนถัดไป"
              className="flex size-9 items-center justify-center rounded-full text-ink/60 hover:bg-brand/5"
            >
              <IconChevronRight size={18} />
            </button>
          )}
        </div>
        <span className="rounded-full bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand">
          {remaining > 0 ? (
            <>เหลืออีก <span className="font-nunito">{remaining}</span> ใบ</>
          ) : (
            <span className="flex items-center gap-1 text-success"><IconCircleCheck size={16} /> ครบแล้ว</span>
          )}
        </span>
      </div>

      {/* Slip rows */}
      <div className="mt-5 flex flex-col gap-3">
        {rows.map((r) => {
          const fresh = justConfirmed.has(r.id);
          return (
            <div
              key={r.id}
              className={`relative overflow-hidden rounded-3xl p-5 ${
                r.confirmed ? "bg-linear-to-b from-success-soft via-success-mid to-success-strong text-white" : "bg-card ring-1 ring-line"
              } ${fresh ? "animate-confirm-glow" : ""}`}
            >
              {/* slip thumbnail (decorative, right, clipped) */}
              <img
                src={slipThumb}
                alt=""
                className="pointer-events-none absolute top-1/2 right-4 h-28 w-auto -translate-y-1/2 opacity-90 drop-shadow-sm"
              />

              <div className="relative pr-24">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full ring-2 ring-white/70">
                      <IssuerLogo symbol={r.symbol} name={issuerName(r.symbol, r.issuer)} size={44} />
                    </span>
                    <div>
                      <p className={`font-nunito text-lg font-bold ${r.confirmed ? "text-white" : "text-ink"}`}>{r.symbol}</p>
                      <p className={`text-sm ${r.confirmed ? "text-white/80" : "text-ink-soft"}`}>งวดที่ {r.installment}</p>
                    </div>
                  </div>
                  {r.confirmed ? (
                    <span className="rounded-xl bg-white/20 px-2.5 py-1 text-sm font-medium text-white">ยืนยันแล้ว</span>
                  ) : (
                    <span className="rounded-xl bg-brand/5 px-2.5 py-1 text-sm font-medium text-brand">รอยืนยัน</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-5">
                  <Stat label="ดอกเบี้ยที่จ่าย" value={r.gross} confirmed={r.confirmed} />
                  <Divider confirmed={r.confirmed} />
                  <Stat label="ยอดหักภาษี ณ ที่จ่าย" value={r.wht} confirmed={r.confirmed} />
                  <Divider confirmed={r.confirmed} />
                  <Stat label="คงเหลือจ่ายจริง" value={r.net} confirmed={r.confirmed} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, confirmed }: { label: string; value: number; confirmed: boolean }) {
  return (
    <div>
      <p className={`text-sm ${confirmed ? "text-white/80" : "text-ink-soft"}`}>{label}</p>
      <p className={`mt-1 font-nunito text-xl font-bold ${confirmed ? "text-white" : "text-ink"}`}>฿{fmtTHB(value)}</p>
    </div>
  );
}

function Divider({ confirmed }: { confirmed: boolean }) {
  return <span className={`h-10 w-px rounded-full ${confirmed ? "bg-white/40" : "bg-black/10"}`} />;
}
