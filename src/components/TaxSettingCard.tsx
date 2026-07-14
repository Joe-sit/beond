import { useEffect, useRef, useState } from "react";
import { IconCheck, IconLoader2, IconCircleCheck, IconAlertTriangle, IconEqual } from "@tabler/icons-react";
import { TAX_BRACKETS, getMarginalRate, saveMarginalRate, taxAdvice, estimatedRefund, type TaxVerdict } from "../lib/taxSettings";
import { useTaxCredits } from "../hooks/usePortfolio";

const fmt = (n: number) => n.toLocaleString("th-TH");
const rangeText = (min: number, max: number) =>
  max === Infinity ? `${fmt(min)} บาทขึ้นไป` : `${fmt(min)} – ${fmt(max)} บาท`;

// Warm→cool colour ramp per bracket (index 0 = 0% … 7 = 35%), like the classic
// Thai tax-staircase infographic.
const RAMP = ["#F5A623", "#EE6B2D", "#D2418C", "#7A52B3", "#2E7FD1", "#27A6C4", "#4CAE50", "#8BC34A"];

// Darken a hex colour toward black (for the 2.5D extruded riser/side face).
function darken(hex: string, amt = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `rgb(${r}, ${g}, ${b})`;
}

// Colour + icon per recommendation verdict.
const VERDICT_STYLE: Record<TaxVerdict, { tone: string; bg: string; Icon: typeof IconCircleCheck }> = {
  claim: { tone: "text-[#12BC59]", bg: "bg-[#12BC59]/8", Icon: IconCircleCheck },
  neutral: { tone: "text-[#2968A5]", bg: "bg-[#2968A5]/8", Icon: IconEqual },
  final: { tone: "text-[#C0563B]", bg: "bg-[#C0563B]/8", Icon: IconAlertTriangle },
};

// TaxSetting — the user records their marginal personal-income-tax bracket via a
// slider (0/5/…/35%). Persisted per user; used to reason about WHT credit vs.
// their real bracket. Lives in the "จัดการภาษี" panel.
export default function TaxSettingCard() {
  const [idx, setIdx] = useState(0); // bracket index (slider position)
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the saved rate once. Unset → default to the first bracket, unsaved.
  useEffect(() => {
    let alive = true;
    getMarginalRate().then((rate) => {
      if (!alive) return;
      if (rate !== null) {
        const i = TAX_BRACKETS.findIndex((b) => b.rate === rate);
        if (i >= 0) setIdx(i);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const commit = (i: number) => {
    setIdx(i);
    setState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await saveMarginalRate(TAX_BRACKETS[i].rate);
      setState(res.ok ? "saved" : "idle");
      if (res.ok) setTimeout(() => setState("idle"), 1800);
    }, 400);
  };

  const bracket = TAX_BRACKETS[idx];
  const advice = taxAdvice(bracket.rate);
  const vs = VERDICT_STYLE[advice.verdict];

  // Total WHT already withheld (confirmed slips) → estimate the refundable part
  // at the chosen bracket, shown only when it's worth claiming.
  const { docs } = useTaxCredits();
  const totalWht = docs
    .filter((d) => d.status === "confirmed")
    .reduce((s, d) => s + Number(d.whtAmount ?? 0), 0);
  const refund = estimatedRefund(totalWht, bracket.rate);

  return (
    <div className="rounded-3xl border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#43507F]">อัตราภาษีเงินได้ของคุณ</p>
          <p className="mt-0.5 text-xs text-black/45">เลือกฐานภาษีตามช่วงเงินได้สุทธิต่อปี</p>
        </div>
        {state === "saving" ? (
          <span className="flex items-center gap-1 text-[11px] text-black/40">
            <IconLoader2 size={13} className="animate-spin" /> กำลังบันทึก
          </span>
        ) : state === "saved" ? (
          <span className="flex items-center gap-1 text-[11px] text-[#12BC59]">
            <IconCheck size={13} /> บันทึกแล้ว
          </span>
        ) : null}
      </div>

      {/* Interactive 2.5D staircase — highest bracket at the top, most indented;
          each step is an extruded block (offset dark riser). Tap to pick. */}
      <div className="mt-4 flex flex-col gap-2.5 pr-2">
        {TAX_BRACKETS.slice().reverse().map((b) => {
          const i = TAX_BRACKETS.indexOf(b);
          const selected = i === idx;
          const color = RAMP[i];
          const depth = selected ? 7 : 5;
          return (
            <button
              key={b.rate}
              onClick={() => loaded && commit(i)}
              aria-pressed={selected}
              style={{
                marginLeft: `${i * 9}%`,
                background: `linear-gradient(180deg, ${color} 0%, ${darken(color, 0.12)} 100%)`,
                boxShadow: `${depth}px ${depth}px 0 ${darken(color)}${selected ? ", 0 8px 16px rgba(0,0,0,.18)" : ""}`,
                opacity: selected ? 1 : 0.68,
              }}
              className={`flex items-center justify-between gap-2 rounded-lg py-2 pr-2.5 pl-3 text-left transition-all duration-150 ${
                selected ? "scale-[1.03]" : "hover:opacity-90"
              }`}
            >
              <span className="truncate text-[11px] font-bold text-white drop-shadow-sm">
                {b.rate === 0 ? "0 – 150,000" : rangeText(b.min, b.max).replace(" บาท", "")}
              </span>
              <span className="font-nunito text-sm font-extrabold text-white drop-shadow-sm">{b.rate}%</span>
            </button>
          );
        })}
      </div>

      {/* Actionable recommendation: claim / neutral / final tax */}
      <div className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 ${vs.bg}`}>
        <vs.Icon size={17} className={`mt-0.5 shrink-0 ${vs.tone}`} />
        <div>
          <p className={`text-xs font-bold ${vs.tone}`}>{advice.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-black/55">{advice.detail}</p>
          {advice.verdict === "claim" && refund > 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-black/70">
              ประเมินขอคืนได้ ~<span className="font-nunito font-bold text-[#12BC59]">
                ฿{refund.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
