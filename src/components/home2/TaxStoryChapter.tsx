import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Stairs3D from "./Stairs3D";
import Folder3D from "./Folder3D";
import PaperFly from "./PaperFly";

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
    setTimeout(() => setPhase(4), 8200); // leave — after the 10 slips have landed
    setTimeout(() => onDone?.(), 8900); // hand off to income
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const leaving = phase >= 4;
  const steps = Array.from({ length: 6 }, () => ({}));

  return (
    <motion.div
      className="relative h-full"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Staircase — big "steps to success", spanning bottom-left → top-right,
          with the 50-ทวิ slip standing on the top step. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute" style={{ left: "16%", bottom: "0%" }}>
          <Stairs3D steps={steps} hero play={phase >= 1} rx={-31} ry={-45} rz={0} persp={2081} w={400} tread={85} rise={50} topTreadMul={2.6} scale={1.5} />
        </div>
        {/* Folder split into layers so the flying slips sit BETWEEN the white
            sheet (back) and the orange cover (front): sheet z0 → papers z1 →
            cover z2. The cover then shuts over the landed slips. */}
        <div
          className="absolute z-0"
          style={{ right: "6%", top: "6%", transformOrigin: "bottom center", opacity: phase >= 1 ? 1 : 0, transition: "opacity 500ms ease 500ms" }}
        >
          <Folder3D scale={0.72} rx={6} ry={-45} part="sheet" />
        </div>
        {/* Slips pirouette in IN FRONT of the cover (z3 while flying), then drop
            behind it (z1) when it shuts so the cover closes over them. */}
        <div className="absolute inset-0" style={{ zIndex: closed ? 1 : 3 }}>
          <PaperFly play={phase >= 2 && !leaving} />
        </div>
        <div
          className="absolute z-2"
          style={{ right: "6%", top: "6%", transformOrigin: "bottom center", opacity: phase >= 1 ? 1 : 0, transition: "opacity 500ms ease 500ms" }}
        >
          <Folder3D scale={0.72} rx={6} ry={-45} part="cover" open={phase >= 2 && !closed} />
        </div>
      </div>

      {/* Left — goal text over the sky */}
      <div className="absolute left-8 top-12 z-10 flex w-[46%] flex-col">
        <motion.div initial="hidden" animate={leaving ? "gone" : "show"} variants={{ show: { transition: { staggerChildren: 0.13, delayChildren: 0.1 } }, gone: { transition: { staggerChildren: 0.05 } } }}>
          <motion.p variants={LINE} className="text-sm text-ink/55">เป้าหมายภาษีปี {data.year}</motion.p>
          <motion.p variants={LINE} className="mt-1 text-2xl font-medium leading-snug text-ink">
            สะสมสลิป 50 ทวิให้ครบ<br />ขอคืนได้สูงสุด
          </motion.p>
          <motion.p variants={LINE} className="mt-2 font-nunito text-4xl font-extrabold text-[#2E8B57]">
            ฿{fmtTHB(data.fullRefund)}
          </motion.p>
          <motion.p variants={LINE} className="mt-2 text-xs text-ink/55">
            ฐานภาษี {data.rate}%
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
