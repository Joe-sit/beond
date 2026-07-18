import { IconCheck, IconCircleDotted, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";

export interface FolderSlip {
  id: string;
  symbol: string;
  issuer: string;
  installment: string;
  confirmed: boolean;
}

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Folder UI — the 50-ทวิ slips still to collect for the focused month. White
// info header sits over an orange "folder" holding one row per bond. Figma
// node 870:2698.
export default function MonthFolderCard({
  monthLabel,
  totalInterest,
  slips,
  onPrev,
  onNext,
  onRowHover,
}: {
  monthLabel: string;
  totalInterest: number;
  slips: FolderSlip[];
  onPrev?: () => void;
  onNext?: () => void;
  onRowHover?: (id: string | null) => void;
}) {
  const remaining = slips.filter((s) => !s.confirmed).length;
  return (
    <div className="relative w-full max-w-[449px]">
      {/* White card — full-height rounded trapezoid stacked BEHIND the orange
          pocket. Its bottom aligns with the orange bottom and its gentler 2%
          taper lets it peek out as a rim around the orange. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 449 320" preserveAspectRatio="none" aria-hidden>
        <path
          d="M24,0 L425,0 Q449,0 447.32,23.94 L428.23,296.06 Q426.55,320 402.55,320 L46.45,320 Q22.45,320 20.77,296.06 L1.680,23.94 Q0,0 24,0 Z"
          fill="#FFFFFF"
        />
      </svg>
      {/* Header content */}
      <div className="relative flex items-start justify-between px-8 pt-6 pb-8">
        <div>
          <p className="text-base text-ink/80">สลิปที่ต้องสะสม</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-4xl font-medium text-ink">
              <span>{remaining}</span> ใบ
            </span>
            {/* One status pip per slip — green check if its 50-ทวิ is confirmed,
                dotted grey while still pending. */}
            {slips.map((s) =>
              s.confirmed ? (
                <span key={s.id} className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-[#80BA44] text-white">
                  <IconCheck size={24} />
                </span>
              ) : (
                <span key={s.id} className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-[#F5F5F5] text-ink/40">
                  <IconCircleDotted size={24} />
                </span>
              ),
            )}
          </div>
          <p className="mt-2 text-sm text-ink/80">
            ดอกเบี้ยรวม ฿<span>{fmtTHB(totalInterest)}</span>
          </p>
        </div>

        {/* This month's collectable withholding tax (15% of coupon interest) */}
        <div className="text-right">
          <p className="text-sm text-ink/80">ภาษีที่จะสะสมได้</p>
          <p className="text-xl font-medium text-ink">฿{fmtTHB(totalInterest * 0.15)}</p>
        </div>
      </div>

      {/* Folder region — spaced below the white card so the month tab (which
          hangs above the orange top) clears the header avatars. Only the orange
          block animates height on month change, so the ‹ › cursor never moves. */}
      <div className="relative">
        {/* Month selector tab */}
        <div className="absolute right-8 bottom-full z-10 flex w-[190px] items-center gap-2 rounded-t-2xl border border-b-0 border-black/10 bg-white p-2">
          <button onClick={onPrev} aria-label="เดือนก่อน" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5">
            <IconChevronLeft size={24} />
          </button>
          <span className="flex-1 truncate whitespace-nowrap text-center text-base text-ink/80">{monthLabel}</span>
          <button onClick={onNext} aria-label="เดือนถัดไป" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:bg-black/5">
            <IconChevronRight size={24} />
          </button>
        </div>

        <motion.div
          layout
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="relative min-h-[240px]"
        >
        {/* Orange pocket — rounded trapezoid: square top (flush to white),
            bottom corners rounded r=24 to match the white card radius, sides
            taper in 5% each. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 449 240"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M24,0 L425,0 Q449,0 446.77,23.90 L428.78,216.10 Q426.55,240 402.55,240 L46.45,240 Q22.45,240 20.22,216.10 L2.234,23.90 Q0,0 24,0 Z"
            fill="#FF8D27"
          />
        </svg>
        <motion.div key={monthLabel} layout className="relative flex flex-col gap-4 px-8 py-6">
          <AnimatePresence mode="popLayout">
            {slips.map((s, i) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 28 }}
                transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.07 }}
                className="-mx-3 flex cursor-pointer items-center justify-between rounded-2xl px-3 py-1.5 transition-colors hover:bg-white/15"
                onMouseEnter={() => onRowHover?.(s.id)}
                onMouseLeave={() => onRowHover?.(null)}
              >
                <div className="flex items-center gap-4">
                  <IssuerLogo symbol={s.symbol} name={issuerName(s.symbol, s.issuer)} size={40} />
                  <div>
                    <p className="text-xl font-medium text-white">{s.symbol}</p>
                    <p className="text-sm text-white/80">งวดที่ {s.installment}</p>
                  </div>
                </div>
                {s.confirmed ? (
                  <span className="rounded-xl bg-white/25 px-2 py-1 text-sm text-white">ยืนยันแล้ว</span>
                ) : (
                  <span className="rounded-xl bg-[#2968A5] px-2 py-1 text-sm text-white">รอยืนยัน</span>
                )}
              </motion.div>
            ))}
            {slips.length === 0 && (
              <motion.p
                key="empty"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 text-center text-sm text-white/90"
              >
                เดือนนี้ไม่มีสลิปต้องสะสม
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
