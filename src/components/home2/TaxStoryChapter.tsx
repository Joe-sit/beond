import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Folder3D from "./Folder3D";
import PaperFly from "./PaperFly";
import { useT, useLang } from "../../lib/i18n";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Staggered narration line: rises + de-blurs in, lifts out on exit.
const LINE = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
  gone: { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.35 } },
};

// Tax goal data — everything the opener needs, computed by the caller.
export interface TaxStoryData {
  rate: number; // caller's marginal bracket %
  year: string; // BE year
  collectedRefund: number; // refund secured from confirmed slips so far
  fullRefund: number; // refund if every payout this year is claimed (the GOAL)
  confirmed: number; // slips confirmed
  total: number; // slips this year
}

// Chapter 1 (opener) — this year's tax-saving GOAL: a "steps to success"
// staircase climbs on the right while the goal text + progress gauge reveal on
// the left. Beats: 0 text → 1 stairs climb → 2 gauge sweep → 3 hold → 4 leave.
// `active` triggers the timeline once; `onDone` hands off to the income chapter.
export default function TaxStoryChapter({
  data,
  active,
  onDone,
}: {
  data: TaxStoryData;
  active: boolean;
  onDone?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const year = lang === "en" ? String(Number(data.year) - 543) : data.year;
  const [phase, setPhase] = useState(0);
  const [closed, setClosed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    // No cleanup-clear (StrictMode would cancel the sequence); the started ref
    // guards a real re-trigger.
    setTimeout(() => setPhase(1), 700); // stairs climb
    setTimeout(() => setPhase(2), 2000); // folder opens + slips pirouette in
    setTimeout(() => setPhase(3), 3400); // hold to read
    setTimeout(() => setClosed(true), 7600); // last slip landed (~7.46s) → shut the cover
    setTimeout(() => setPhase(4), 8800); // leave — brief hold on the closed folder
    setTimeout(() => onDone?.(), 9500); // hand off to income
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const leaving = phase >= 4;

  return (
    <motion.div
      className="relative h-full"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Folder + pirouetting slips, centred. Split into layers so the flying
          slips sit BETWEEN the white sheet (back z0) and the orange cover (front
          z2); the cover shuts over the landed slips. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute z-0"
          style={{ left: "50%", top: "34%", transformOrigin: "bottom center", transform: "translateX(-50%) translateY(-70px)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 500ms ease 500ms" }}
        >
          <Folder3D scale={0.72} rx={8} ry={-28} part="sheet" blank />
        </div>
        <div className="absolute inset-0" style={{ zIndex: closed ? 1 : 3 }}>
          <PaperFly play={phase >= 2 && !leaving} left="50%" top="34%" />
        </div>
        <div
          className="absolute z-2"
          style={{ left: "50%", top: "34%", transformOrigin: "bottom center", transform: "translateX(-50%) translateY(-70px)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 500ms ease 500ms" }}
        >
          <Folder3D scale={0.72} rx={8} ry={-28} part="cover" open={phase >= 2 && !closed} />
        </div>
      </div>

      {/* Goal text — centred, matching the income chapter's layout. */}
      <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex flex-col items-center text-center">
        <motion.div initial="hidden" animate={leaving ? "gone" : "show"} variants={{ show: { transition: { staggerChildren: 0.13, delayChildren: 0.1 } }, gone: { transition: { staggerChildren: 0.05 } } }}>
          <motion.p variants={LINE} className="text-sm text-ink/55">{t("goal_year_title", { year })}</motion.p>
          <motion.p variants={LINE} className="mt-1 text-2xl font-medium leading-snug text-ink">
            {t("goal_collect_all")}<br />{t("goal_max_refund")}
          </motion.p>
          <motion.p variants={LINE} className="mt-2 font-nunito text-4xl font-extrabold text-[#2E8B57]">
            ฿{fmtTHB(data.fullRefund)}
          </motion.p>
          <motion.p variants={LINE} className="mt-2 text-xs text-ink/55">
            {t("tax_base_rate", { rate: data.rate })}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
