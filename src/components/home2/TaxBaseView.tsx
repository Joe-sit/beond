import { useRef, useState } from "react";
import { toast } from "@heroui/react";
import { TAX_BRACKETS, saveMarginalRate, estimatedRefund } from "../../lib/taxSettings";
import { useT } from "../../lib/i18n";
import CashStairsScene from "./CashStairsScene";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Full bracket rates — the staircase renders one step per bracket (0 … 35%).
const RATES = TAX_BRACKETS.map((b) => b.rate);
// The slider only lets you pick up to 10%, and reads high → low (first stop =
// 10%). Stairs still show every bracket.
const SLIDER_RATES = RATES.filter((r) => r <= 10).reverse(); // [10, 5, 0]
const SLIDER_STOPS = SLIDER_RATES.length;
// Brackets below 15% are the refund ("claim") zone — the steps you climb out of.
const isRefund = (i: number) => TAX_BRACKETS[i].rate < 15;

// "ฐานภาษี" page (Figma 1068:3310) — a sky-gradient panel with a slider to pick
// the caller's marginal tax bracket, saved to their profile. A three.js
// staircase sits behind it; changing the bracket rains cash that lands on the
// top step (real rapier physics).
export default function TaxBaseView({ rate, wht, loading = false, onSaved }: { rate: number; wht: number; loading?: boolean; onSaved: (r: number) => void }) {
  const t = useT();
  const found = SLIDER_RATES.indexOf(rate);
  const [idx, setIdx] = useState(found >= 0 ? found : 0);
  const [saving, setSaving] = useState(false);
  const pickedRate = SLIDER_RATES[idx];
  // Index of the picked rate within the full bracket list — drives which stair
  // step is highlighted.
  const stairIndex = RATES.indexOf(pickedRate);

  // Cash = tax withheld that's still reclaimable at the selected bracket. Higher
  // bracket → less refund → cash vanishes; ฿0 at 15%+ (nothing to claim).
  const refund = estimatedRefund(wht, pickedRate);
  // Bundle count tracks the *refund* as a share of the max possible refund (the
  // full WHT, reclaimed at 0%). Proportional so the pile visibly shrinks as the
  // bracket rises, instead of always maxing out the physics budget.
  const bundleCount = wht > 0 ? Math.round((refund / wht) * 100) : 0;

  const save = async () => {
    setSaving(true);
    const res = await saveMarginalRate(pickedRate);
    setSaving(false);
    if (res.ok) {
      toast.success(t("tax_base_saved"));
      onSaved(pickedRate);
    } else {
      toast.danger(res.error ?? "Error");
    }
  };

  return (
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-white from-[28%] to-[#779BC6] p-10">
      {/* three.js staircase + falling cash (physics) — cash lands on the top
          step whenever the bracket changes. */}
      {!loading && (
        <div className="pointer-events-none absolute inset-0 select-none">
          <CashStairsScene steps={RATES.length} activeIndex={stairIndex} bundleCount={bundleCount} refundZone={isRefund} />
        </div>
      )}

      <div className="relative flex w-[423px] max-w-full flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink/60">{t("tax_base_label")}</p>
          <h2 className="text-2xl font-medium leading-snug text-ink">{t("tax_base_title")}</h2>
          <p className="text-base leading-normal text-ink/60">{t("tax_base_desc")}</p>
        </div>

        {/* Two figures: LEFT = all tax withheld at source this year (static);
            RIGHT = how much of it is reclaimable at the selected bracket (the
            cash pile). */}
        <div className="flex items-end gap-8">
          <div className="flex flex-col">
            <p className="text-sm leading-snug text-ink/60">{t("tax_wht_total")}</p>
            {loading ? (
              <span className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-black/10" />
            ) : (
              <p className="mt-1 font-nunito text-3xl font-extrabold text-ink">฿{fmtTHB(wht)}</p>
            )}
          </div>
          <span className="mb-2 h-10 w-px bg-black/10" />
          <div className="flex flex-col">
            <p className="text-sm leading-snug text-ink/60">{t("tax_claimable")}</p>
            {loading ? (
              <span className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-black/10" />
            ) : (
              <p className="mt-1 font-nunito text-3xl font-extrabold text-[#2E8B57]">฿{fmtTHB(refund)}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/60">{t("nav_tax_base")}</span>
            <span className="text-2xl font-medium text-brand-blue">{pickedRate}%</span>
          </div>

          {/* Custom step slider — snaps to the bracket stops. */}
          <StepSlider count={SLIDER_STOPS} idx={idx} onChange={setIdx} label={t("nav_tax_base")} valueText={`${pickedRate}%`} />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex h-[54px] items-center justify-center rounded-2xl bg-brand-blue px-3 text-base font-medium text-white transition hover:bg-[#215688] disabled:opacity-60"
        >
          {t("save")}
        </button>
      </div>
    </section>
  );
}

// A ground-up step slider: a tall pill track with a tick per stop, a blue fill,
// and a white knob that snaps to the nearest stop (smoothly, via a CSS
// transition). Drag / click the track, or arrow-key it.
function StepSlider({
  count,
  idx,
  onChange,
  label,
  valueText,
}: {
  count: number;
  idx: number;
  onChange: (i: number) => void;
  label: string;
  valueText: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const frac = idx / (count - 1);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const next = Math.round(f * (count - 1));
    if (next !== idx) onChange(next);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={idx}
      aria-valuetext={valueText}
      tabIndex={0}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) setFromClientX(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, idx - 1)); }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(count - 1, idx + 1)); }
        if (e.key === "Home") onChange(0);
        if (e.key === "End") onChange(count - 1);
      }}
      className="relative h-[31px] w-full cursor-pointer touch-none select-none rounded-full bg-black/10 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand-blue/50"
    >
      {/* fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand-blue transition-[width] duration-150 ease-out"
        style={{ width: `calc(${frac} * (100% - 27px) + 27px)` }}
      />
      {/* tick per stop */}
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full ${i <= idx ? "bg-white/70" : "bg-black/20"}`}
          style={{ left: `calc(${i / (count - 1)} * (100% - 27px) + 13.5px)`, transform: "translate(-50%, -50%)" }}
        />
      ))}
      {/* knob */}
      <div
        className="absolute top-1/2 size-[27px] -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-[left] duration-150 ease-out"
        style={{ left: `calc(${frac} * (100% - 27px))` }}
      />
    </div>
  );
}
