import { type MouseEvent, useRef, useState } from "react";
import { motion } from "motion/react";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";

const PEEL = 64; // px size of the folded corner when peeled

export interface SlipPaperData {
  id: string;
  symbol: string;
  issuer: string;
  installment: string;
  wht: number;
  net: number;
}

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));
// Code128-style bar/gap widths (px): even index = black bar, odd = gap.
const BARCODE = [3, 1, 1, 2, 2, 1, 3, 1, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 2, 3, 1, 1, 1, 2, 3, 1, 2];

// Static isometric stack of the month's 50-ทวิ slip papers still to collect.
export default function BondScanStack({ slips, focusId }: { slips: SlipPaperData[]; focusId?: string | null }) {
  // Hovered card index from pointing directly at a slip.
  const [hovered, setHovered] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestHover = (i: number | null) => {
    clearTimeout(timerRef.current);
    if (i === null) {
      setHovered(null);
      return;
    }
    setHovered(i);
  };

  if (!slips.length) {
    return (
      <div className="flex h-[470px] items-center justify-center text-sm text-ink-soft">
        เดือนนี้ไม่มีใบหุ้นกู้ให้สแกน
      </div>
    );
  }

  const shown = slips.slice(0, 3);
  // A slip can also be focused by hovering its row in the folder list — that
  // arrives as focusId. Direct pointing wins; otherwise fall back to focusId.
  const externalIdx = focusId ? shown.findIndex((s) => s.id === focusId) : -1;
  const active = hovered ?? (externalIdx >= 0 ? externalIdx : null);

  // No deck reordering — every card keeps its slot. Only the active card moves,
  // popping forward (see hover target) to be read. Swapping slots made the far
  // card travel the whole stack, which felt like too much motion.
  const slotOf = (i: number) => i;

  // Hover detection from pointer-x, not per-card 3D hit boxes. The cards are a
  // left→right staircase (base 24px, +84px per slot); each owns an 84px strip,
  // the last extends to its right edge. Pure geometry → identical hit behaviour
  // across browsers (the 3D-transformed hit divs picked wrong cards on Chrome).
  const BASE = 24;
  const STEP = 84;
  const CARD_W = 310;
  const rightEdge = BASE + (shown.length - 1) * STEP + CARD_W;
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < BASE || x > rightEdge || y < 60 || y > 560) {
      requestHover(null);
      return;
    }
    requestHover(Math.min(shown.length - 1, Math.floor((x - BASE) / STEP)));
  };

  return (
    <div
      className="relative mx-auto h-[600px] w-[520px]"
      style={{ perspective: 2800, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={() => requestHover(null)}
    >
      {shown.map((s, i) => (
        <StackCard key={s.id} slip={s} slot={slotOf(i)} index={i} hovered={active === i} />
      ))}
    </div>
  );
}

// One slip in the isometric stack. When hovered it flies to the front slot,
// rotates flat, floats forward and peels — so any slip can be read in the front
// spot regardless of its stacking order.
function StackCard({
  slip,
  index,
  slot,
  hovered,
}: {
  slip: SlipPaperData;
  index: number;
  slot: number;
  hovered: boolean;
}) {
  // Visual position comes from the slot; the hovered card flies flat to the
  // front. Hover hit-testing is handled by the parent via pointer-x, so this is
  // purely presentational (pointer-events-none).
  const slotPos = { x: slot * 84, y: -slot * 52, z: -slot * 80, rotateY: -22, rotateX: 6, scale: 1, opacity: 1 };
  const target = hovered
    ? { x: 0, y: -20, z: 200, rotateY: 0, rotateX: 0, scale: 1.04, opacity: 1 }
    : slotPos;

  return (
    // Wave entrance: rise from below + fade, staggered per card.
    <motion.div
      className="pointer-events-none absolute top-28 left-6 w-[310px] [transform-style:preserve-3d]"
      initial={{ ...slotPos, y: slotPos.y + 80, opacity: 0 }}
      animate={target}
      transition={{ type: "spring", stiffness: 90, damping: 20, mass: 1.1, delay: index * 0.12 }}
    >
      <SlipPaper slip={slip} dimmed={slot > 0 && !hovered} peel={hovered} />
    </motion.div>
  );
}

// 50-ทวิ withholding-tax certificate, data-bound. Rebuilt from Figma doc art:
// header (issuer + title) → key info → detail table → summary → barcode.
function SlipPaper({ slip, dimmed, peel }: { slip: SlipPaperData; dimmed: boolean; peel: boolean }) {
  const s = peel ? PEEL : 0;
  return (
    <div
      className={`relative aspect-[210/297] w-[310px] rounded-none transition-[filter] duration-500 ease-out ${dimmed ? "brightness-[0.97]" : ""}`}
    >
      {/* The sheet — its bottom-right corner is clipped away as it peels, so
          whatever sits behind shows through the gap. */}
      <div
        className="absolute inset-0 overflow-hidden border border-black/10 bg-white transition-[clip-path] duration-500 ease-out"
        style={{ clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${s}px), calc(100% - ${s}px) 100%, 0 100%)` }}
      >
        <SlipInner slip={slip} />
      </div>

      {/* Folded flap — the lifted corner reflected back across the crease onto
          the sheet, showing the paper's shaded underside. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 z-20 transition-all duration-500 ease-out"
        style={{
          width: s,
          height: s,
          clipPath: "polygon(0 0, 0 100%, 100% 0)",
          background: "linear-gradient(315deg, #ffffff 0%, #ededed 55%, #dcdcdc 100%)",
          filter: "drop-shadow(-3px -3px 4px rgba(0,0,0,0.22))",
        }}
      />
    </div>
  );
}

// Inner content of the slip, split out so the peeling sheet can wrap it.
function SlipInner({ slip }: { slip: SlipPaperData }) {
  return (
      <div className="relative flex h-full flex-col p-6">
        {/* Header — issuer + รอยืนยัน */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <IssuerLogo symbol={slip.symbol} name={issuerName(slip.symbol, slip.issuer)} size={44} />
            <div className="min-w-0">
              <p className="text-xl font-bold text-ink">{slip.symbol}</p>
              <p className="truncate text-sm text-ink-soft">{issuerName(slip.symbol, slip.issuer)}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-[#2968A5] px-2 py-0.5 text-sm text-white">รอยืนยัน</span>
        </div>

        {/* Two stat columns with divider */}
        <div className="mt-5 flex items-center gap-4">
          <Field label="ยอดหักภาษี ณ ที่จ่าย" value={slip.wht} />
          <span className="h-11 w-px rounded-full bg-black/20" />
          <Field label="คงเหลือจ่ายจริง" value={slip.net} />
        </div>

        {/* Document body — faux table + paragraph lines */}
        <div className="mt-5 flex-1 overflow-hidden border border-[#D9D9D9]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr]">
            {Array.from({ length: 18 }).map((_, i) => {
              const head = i < 3;
              return (
                <div key={i} className={`border-b border-r border-[#D9D9D9] px-2 py-2 ${head ? "bg-[#F5F5F5]" : ""}`}>
                  <div className="h-1.5 rounded-sm bg-[#D9D9D9]" style={{ width: `${head ? 80 : 50 + ((i * 13) % 45)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="space-y-2 p-3">
            {[92, 78, 64].map((w, i) => (
              <div key={i} className="h-1.5 rounded-sm bg-[#D9D9D9]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        {/* Footer: installment + barcode */}
        <div className="mt-4 flex items-end justify-between">
          <span className="text-sm text-ink-soft">งวดที่ {slip.installment}</span>
          <div className="flex h-9 items-stretch">
            {BARCODE.map((w, i) => (
              <span
                key={i}
                className={i % 2 === 0 ? "bg-[#353535]" : "bg-transparent"}
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
      </div>
  );
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1">
      <p className="text-sm text-ink/80">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-ink">฿{fmtTHB(value)}</p>
    </div>
  );
}
