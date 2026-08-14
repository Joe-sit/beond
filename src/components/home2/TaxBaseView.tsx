import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
import { TAX_BRACKETS, refundFromIncome, bracketIndexForIncome, marginalRateForIncome, PERSONAL_ALLOWANCE, getAnnualIncome, saveAnnualIncome } from "../../lib/taxSettings";
import { notifyPortfolioChanged } from "../../hooks/usePortfolio";
import { useT } from "../../lib/i18n";
import CashStairsScene from "./CashStairsScene";
import { useIsDesktop } from "../../lib/useIsDesktop";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtInt = (n: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);

// Full bracket rates — the staircase renders one step per bracket (0 … 35%).
const RATES = TAX_BRACKETS.map((b) => b.rate);
// Brackets below 15% are the refund ("claim") zone — the steps you climb out of.
const isRefund = (i: number) => TAX_BRACKETS[i].rate < 15;

// "ฐานภาษี" page — enter your actual annual (net taxable) income; the bond
// coupon is stacked on top and taxed up the progressive staircase to reveal how
// much of the 15% WHT was over-withheld. Income auto-snaps to its bracket.
export default function TaxBaseView({ wht, loading = false, onSaved }: { rate?: number; wht: number; loading?: boolean; onSaved: (r: number) => void }) {
  const t = useT();
  const isDesktop = useIsDesktop();
  const [income, setIncome] = useState<number>(0);
  // Load the saved income (per-user, DB) on mount so it syncs across devices.
  useEffect(() => {
    let alive = true;
    getAnnualIncome().then((v) => {
      if (alive && v !== null) setIncome(v);
    });
    return () => { alive = false; };
  }, []);
  const [mode, setMode] = useState<"year" | "month">("year"); // how the income is entered
  const [saving, setSaving] = useState(false);

  // The value shown in the field for the current mode (income is stored annual).
  const shown = mode === "month" ? Math.round(income / 12) : income;
  const setShown = (v: number) => setIncome(mode === "month" ? v * 12 : v);

  // Coupon interest before its flat 15% WHT, stacked on top of the income.
  const interest = wht > 0 ? wht / 0.15 : 0;
  // Taxable income applies the personal allowance first (per the ภ.ง.ด. sheet).
  const taxableWithout = Math.max(0, income - PERSONAL_ALLOWANCE);
  const taxableWith = Math.max(0, income + interest - PERSONAL_ALLOWANCE);
  const baseIdx = bracketIndexForIncome(taxableWithout);
  const topIdx = bracketIndexForIncome(taxableWith);
  const pickedRate = marginalRateForIncome(taxableWithout);
  // Overpaid WHT at this real income — the reclaimable cash pile.
  const refund = refundFromIncome(wht, income);
  const bundleCount = wht > 0 ? Math.round((refund / wht) * 100) : 0;

  const save = async () => {
    setSaving(true);
    const res = await saveAnnualIncome(income);
    setSaving(false);
    if (!res.ok) { toast.danger(res.error ?? t("tax_base_saved")); return; }
    toast.success(t("tax_base_saved"));
    onSaved(pickedRate);
    // Let the tax cards (TaxCard / summary) re-read the new income immediately.
    notifyPortfolioChanged();
  };

  return (
    /* No h-full: the parent <main> gets its height from flex, so a percentage
       height resolves against auto and collapses to the content. Letting the
       flex row stretch this item instead fills the screen on every breakpoint. */
    <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-white from-[28%] to-[#779BC6] p-5 lg:p-10">
      {/* three.js staircase + falling cash — cash lands on the step the interest
          climbs to (topIdx) whenever the income changes. Desktop only: on a
          402px card the form covers the whole stage, so the scene would burn a
          WebGL context and the animation loop for pixels nobody sees. */}
      {!loading && isDesktop && (
        <div className="pointer-events-none absolute inset-0 select-none">
          <CashStairsScene steps={RATES.length} activeIndex={topIdx} bundleCount={bundleCount} refundZone={isRefund} />
        </div>
      )}

      {/* Full width on mobile; the fixed column keeps the staircase clear of the
          text on desktop, where the scene has room beside it. */}
      <div className="relative flex w-full flex-col gap-5 lg:w-[423px] lg:gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink/60">{t("tax_base_label")}</p>
          <h2 className="text-2xl font-medium leading-snug text-ink">{t("tax_base_title")}</h2>
          <p className="text-base leading-normal text-ink/60">{t("tax_base_desc")}</p>
        </div>

        {/* Income input — the base the coupon interest stacks on top of.
            Enter it as a whole-year figure or per-month (× 12 internally). */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm text-ink/60">{t("income_label")}</label>
            {/* Year / month segmented toggle */}
            <div className="flex rounded-full bg-black/5 p-0.5 text-sm">
              {(["year", "month"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 font-medium transition ${
                    mode === m ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {t(m === "year" ? "income_per_year" : "income_per_month")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border-[0.5px] border-black/10 bg-white px-4 py-3">
            <span className="shrink-0 text-lg text-black/40">฿</span>
            <input
              inputMode="numeric"
              value={shown > 0 ? fmtInt(shown) : ""}
              onChange={(e) => {
                const d = e.target.value.replace(/[^\d]/g, "");
                setShown(d ? Number(d) : 0);
              }}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent font-nunito text-2xl font-medium text-ink outline-none"
            />
            <span className="shrink-0 text-sm text-black/40">/{t(mode === "year" ? "year_unit" : "month_unit")}</span>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-blue/10 px-2.5 py-1 text-sm font-medium text-brand-blue">
              {t("bracket_rate", { rate: String(pickedRate) })}
            </span>
          </div>
          {/* Echo the annual figure when entering per-month, so it's unambiguous. */}
          {mode === "month" && income > 0 && (
            <p className="text-xs text-ink/50">{t("income_year_equiv", { amount: fmtInt(income) })}</p>
          )}
          {/* Show the interest that's being stacked so the math is legible. */}
          {interest > 0 && (
            <p className="text-xs text-ink/50">
              {t("interest_stacked", { amount: fmtInt(Math.round(interest)) })}
              {topIdx > baseIdx && <> · {t("interest_climbs", { rate: String(RATES[topIdx]) })}</>}
            </p>
          )}
          <p className="text-xs text-ink/40">{t("allowance_note", { amount: fmtInt(PERSONAL_ALLOWANCE) })}</p>
        </div>

        {/* Two figures: LEFT = all tax withheld at source this year (static);
            RIGHT = how much of it is over-withheld at this real income. */}
        <div className="flex items-end gap-5 lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col lg:flex-none">
            <p className="text-sm leading-snug text-ink/60">{t("tax_wht_total")}</p>
            {loading ? (
              <span className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-black/10" />
            ) : (
              <p className="mt-1 font-nunito text-2xl font-extrabold lg:text-3xl text-ink">฿{fmtTHB(wht)}</p>
            )}
          </div>
          <span className="mb-2 h-10 w-px bg-black/10" />
          <div className="flex min-w-0 flex-1 flex-col lg:flex-none">
            <p className="text-sm leading-snug text-ink/60">{t("tax_overpaid")}</p>
            {loading ? (
              <span className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-black/10" />
            ) : (
              <p className="mt-1 font-nunito text-2xl font-extrabold lg:text-3xl text-[#2E8B57]">฿{fmtTHB(refund)}</p>
            )}
          </div>
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
