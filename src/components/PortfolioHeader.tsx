import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useAnnualIncome, currentTaxYearBE, useViewedYear } from "../hooks/usePortfolio";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(Math.round(value));
}

// Count-up the income headline whenever it changes (year swap / live refresh)
// so the number rolls to its new value instead of snapping.
function AnimatedTHB({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => formatTHB(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, mv]);
  return <motion.span className="font-nunito">{text}</motion.span>;
}

export default function PortfolioHeader() {
  // Track whichever year the timeline chart is showing; fall back to the
  // current tax year before the timeline has picked one.
  const viewed = useViewedYear();
  const yearBE = viewed ? Number(viewed) : currentTaxYearBE();
  const { total } = useAnnualIncome(yearBE - 543);

  return (
    // Bottom padding clears the podium in the hero band — the calc() variants
    // track each breakpoint's hero height (88vw / 52vw / 22vw).
    <div className="px-6 pt-4 pb-[calc(88vw-200px)] text-center sm:px-8 sm:pt-6 sm:pb-[calc(52vw-190px)] md:px-12 lg:pb-[calc(22vw-180px)]">
      <p className="text-sm font-medium text-white/80">
        รายได้ดอกเบี้ยรวมปี <span className="font-nunito">{yearBE}</span>
      </p>
      <p className="mt-2 font-nunito text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        ฿<AnimatedTHB value={total} />
      </p>
    </div>
  );
}
