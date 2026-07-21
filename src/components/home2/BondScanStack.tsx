import { useRef, useState } from "react";
import { motion } from "motion/react";
import { IconCircleDotted } from "@tabler/icons-react";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";

const PEEL = 64; // px size of the folded corner when peeled

// Messy-pile layout per slot — papers tossed on top of each other with uneven
// offsets and a bit of rotation, rather than a tidy isometric staircase.
const PILE = [
  { x: 0, y: 0, z: 0, rz: -6, ry: 0, rx: 0 },
  { x: 20, y: -12, z: -1, rz: 8, ry: 0, rx: 0 },
  { x: 44, y: -24, z: -2, rz: -11, ry: 0, rx: 0 },
];
const pileAt = (slot: number) => PILE[Math.min(slot, PILE.length - 1)];
// Show the pointer-x hit bands. Enable with ?hitdebug in the URL.
const HIT_DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("hitdebug");

export interface SlipPaperData {
  id: string;
  symbol: string;
  issuer: string;
  installment: string;
  wht: number;
  net: number;
}

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Payer's 13-digit tax ID for the doc art. No real value in the payout feed, so
// derive a stable juristic-person number (leading 0) from the symbol and format
// it Thai-style: 0-0000-00000-00-0.
function payerTaxId(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  const rest = String(h).padStart(12, "0").slice(0, 12);
  const d = "0" + rest;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}
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

  // No slips to collect this month → a single dotted placeholder slip in the
  // front slot instead of the stack, so the layout stays put.
  if (!slips.length) {
    return (
      <div className="relative mx-auto h-[600px] w-[520px]" style={{ perspective: 2800, transformStyle: "preserve-3d" }}>
        {/* Same motion.div + animate object as a real front slip, so framer
            emits the exact same transform order (translate→rotateX→rotateY) and
            the placeholder sits at the identical 3D angle. */}
        <motion.div
          className="absolute top-28 left-6 w-[310px] [transform-style:preserve-3d]"
          animate={{ x: 0, y: 0, z: 0, rotateY: -22, rotateX: 6, scale: 1 }}
        >
          <div className="flex aspect-[210/297] w-[310px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-black/20 bg-white/50 text-ink-soft">
            <IconCircleDotted size={44} className="text-black/25" />
            <p className="text-sm">เดือนนี้ไม่มีสลิปต้องสะสม</p>
          </div>
        </motion.div>
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

  return (
    <div
      className="relative mx-auto h-[600px] w-[520px]"
      style={{ perspective: 2800, transformStyle: "preserve-3d" }}
      onMouseLeave={() => requestHover(null)}
    >
      {shown.map((s, i) => (
        <StackCard
          key={s.id}
          slip={s}
          slot={slotOf(i)}
          index={i}
          count={shown.length}
          hovered={active === i}
          onHover={() => requestHover(i)}
        />
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
  count,
  hovered,
  onHover,
}: {
  slip: SlipPaperData;
  index: number;
  slot: number;
  count: number;
  hovered: boolean;
  onHover: () => void;
}) {
  const p = pileAt(slot);
  const slotPos = { x: p.x, y: p.y, z: p.z, rotateY: p.ry, rotateX: p.rx, rotate: p.rz, scale: 1, opacity: 1 };
  const target = hovered
    ? { x: 0, y: -20, z: 200, rotateY: 0, rotateX: 0, rotate: 0, scale: 1.04, opacity: 1 }
    : slotPos;

  // Hit zone stays parked at the card's RESTING slot transform (never follows
  // the pop-forward), so it wraps the slip 1:1 and the pointer maps to the same
  // card whatever the active one does. Under preserve-3d the nearest slot (0) is
  // topmost, so overlaps resolve to the front card — exactly what's visible.
  const restTransform = `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateY(${p.ry}deg) rotateX(${p.rx}deg) rotate(${p.rz}deg)`;

  return (
    <>
      <div
        className="absolute top-28 left-6 aspect-[210/297] w-[310px] cursor-pointer"
        style={{
          transform: restTransform,
          zIndex: count - slot,
          border: HIT_DEBUG ? `2px dashed ${hovered ? "#e11d48" : "#3b82f6"}` : undefined,
          background: HIT_DEBUG ? (hovered ? "rgba(225,29,72,0.12)" : "rgba(59,130,246,0.06)") : undefined,
        }}
        onMouseEnter={onHover}
      >
        {HIT_DEBUG && <span className="absolute top-1 left-1 bg-black/70 px-1 text-[10px] text-white">{index}</span>}
      </div>

      {/* Wave entrance: rise from below + fade, staggered per card. */}
      <motion.div
        className="pointer-events-none absolute top-28 left-6 w-[310px] [transform-style:preserve-3d]"
        initial={{ ...slotPos, y: slotPos.y + 80, opacity: 0 }}
        animate={target}
        transition={{ type: "spring", stiffness: 90, damping: 20, mass: 1.1, delay: index * 0.12 }}
      >
        <SlipPaper slip={slip} dimmed={slot > 0 && !hovered} peel={hovered} />
      </motion.div>
    </>
  );
}

// 50-ทวิ withholding-tax certificate, data-bound. Rebuilt from Figma doc art:
// header (issuer + title) → key info → detail table → summary → barcode.
export function SlipPaper({ slip, dimmed = false, peel = false }: { slip: SlipPaperData; dimmed?: boolean; peel?: boolean }) {
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

        {/* Payer's 13-digit tax ID */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-ink-soft">เลขผู้เสียภาษี (ผู้จ่าย)</span>
          <span className="font-mono text-sm text-ink">{payerTaxId(slip.symbol)}</span>
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
