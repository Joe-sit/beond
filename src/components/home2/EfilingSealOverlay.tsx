import { useEffect, useState } from "react";
import { motion } from "motion/react";

// Backdrop + narration for the "sent to e-Filing" celebration. Deliberately
// holds NO jar of its own: the panel's existing jar flies onto this stage (see
// YearlySummaryView), so the coins the user collected all year are the same
// objects being sealed — a second canvas would reset the pile and re-drop
// every coin.
//
// The whole point of this screen is that the user can follow what happened, so
// it plays as three readable beats rather than one blur. These timings are the
// single source of truth: YearlySummaryView imports SEAL_AT to start the lid,
// and Jar3D's LID_FALL / STICKER_DELAY / STICKER_PEEL are tuned to land inside
// the same windows.
export const SEAL_AT = 1000; // jar has landed → lid starts coming down
const STEP_STICKER = 1900; // lid is seated → sticker starts peeling on
const BUTTON_AT = 3400; // sticker is down → hand control back

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function EfilingSealOverlay({
  rowCount,
  year,
  onDone,
}: {
  rowCount: number;
  year: number | null;
  onDone: () => void;
}) {
  // 0 = flying, 1 = sealing, 2 = stamped.
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), SEAL_AT),
      setTimeout(() => setStep(2), STEP_STICKER),
      setTimeout(() => setReady(true), BUTTON_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const captions = [
    { title: `กำลังส่ง ${rowCount} รายการเข้า e-Filing…`, sub: "รวมดอกเบี้ยและภาษีหัก ณ ที่จ่ายของทั้งปี" },
    { title: `ปิดผนึกสลิปปี ${year ?? ""}`, sub: "ข้อมูลชุดนี้พร้อมยื่นแล้ว" },
    { title: "ส่งเข้า e-Filing แล้ว", sub: `${rowCount} รายการ · เปิด e-Filing เพื่อกรอกต่อได้เลย` },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Caption — one line per beat, crossfading in place so the eye stays put
          while the words change. */}
      <div className="pointer-events-none absolute inset-x-0 top-14 grid place-items-center px-6 text-center">
        {captions.map((c, i) => (
          <motion.div
            key={i}
            className="col-start-1 row-start-1 flex flex-col items-center gap-1.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: step === i ? 1 : 0, y: step === i ? 0 : step > i ? -10 : 10 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-xl font-medium text-white">{c.title}</p>
            <p className="text-sm text-white/70">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Beat indicator — makes the sequence explicit instead of leaving the
          user to guess how far along the animation is. */}
      <div className="pointer-events-none absolute inset-x-0 top-36 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 rounded-full bg-white"
            animate={{ width: step === i ? 22 : 6, opacity: clamp(step >= i ? 1 : 0.3, 0.3, 1) }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ))}
      </div>

      <motion.button
        onClick={onDone}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-white px-8 py-3 text-base font-medium text-ink shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 12 }}
        style={{ pointerEvents: ready ? "auto" : "none" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        เรียบร้อย
      </motion.button>
    </motion.div>
  );
}
