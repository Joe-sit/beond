import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import efilingCss from "../../extension/content/efiling.css?raw";
import autodetectJs from "../../extension/content/autodetect.js?raw";
import guideJs from "../../extension/content/guide.js?raw";
import confettiJs from "../../extension/content/confetti.js?raw";
import efilingJs from "../../extension/content/efiling.js?raw";
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRefresh,
} from "@tabler/icons-react";

/**
 * `?extension` — the route from signing in to e-Filing to the 40(4) income
 * screen, played back as an animation.
 *
 * The extension's panel only appears once the user is already on the 40(4)
 * page, which is five clicks deep; on any other page all it can honestly say is
 * that it found no fields. This is the missing half — where those five clicks
 * are — built here on the web first so the wording and the timing can be tuned
 * with a real browser, then lifted into the extension card (backlog item 16).
 *
 * The mock screens are deliberately plain and the page labels itself a guide:
 * efiling.rd.go.th is the Revenue Department's, and an illustration of it must
 * never be mistakable for the site itself. Menu labels are transcribed from the
 * real flow and are the thing most likely to drift — check them against the
 * live site before this ships to users.
 *
 * The page also mounts the REAL panel: the extension's own CSS and content
 * scripts, imported raw and run here with chrome.storage stubbed. Not a mock of
 * it — a mock drifts the moment the extension changes, and the whole point of a
 * debug route is to see what actually ships. A stand-in 40(4) form sits under
 * it, labelled as one, so "กรอกเลย" has something real to fill.
 */

/** Rows the stubbed storage hands the panel. Real shape, invented figures. */
const DEMO_ROWS = [
  { issuer_name: "บมจ. บีทีเอส กรุ๊ป โฮลดิ้งส์", issuer_tax_id: "0107536000421", gross_interest: 47830.14, wht_amount: 7174.52, logo_url: null },
  { issuer_name: "บมจ. แสนสิริ", issuer_tax_id: "0107537002460", gross_interest: 38460, wht_amount: 5769, logo_url: null },
];

/**
 * Run the extension's content scripts against this page, once.
 *
 * They are written for a browser-extension world: top-level `const`s, and a
 * `chrome.storage.local` whose callback must be async (a synchronous one lands
 * in the middle of the script's own initialisation and throws). Both are met
 * here rather than by changing the extension to suit a debug page.
 */
function mountRealPanel(): () => void {
  const w = window as unknown as { __beondPanelMounted?: boolean; chrome?: unknown };
  if (w.__beondPanelMounted) return () => {};
  w.__beondPanelMounted = true;

  const store: Record<string, unknown> = { beond_bond_data: DEMO_ROWS };
  w.chrome = {
    storage: {
      local: {
        get: (keys: string | string[], cb: (o: Record<string, unknown>) => void) =>
          queueMicrotask(() => {
            const out: Record<string, unknown> = {};
            for (const k of ([] as string[]).concat(keys)) if (k in store) out[k] = store[k];
            cb(out);
          }),
        set: (obj: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, obj);
          cb?.();
        },
      },
      onChanged: { addListener: () => {} },
    },
  };

  const style = document.createElement("style");
  style.textContent = efilingCss;
  document.head.append(style);

  // All four in ONE function scope, not four script tags. They share globals
  // with each other (efiling.js calls autodetect's and guide's), so they cannot
  // be wrapped individually — and left at top level their `const`s outlive the
  // removed tag, so StrictMode's second mount dies on "already declared".
  const tag = document.createElement("script");
  tag.textContent = `(function(){\n${[autodetectJs, guideJs, confettiJs, efilingJs].join("\n;\n")}\n})();`;
  document.body.append(tag);
  const nodes: Element[] = [style, tag];

  return () => {
    for (const n of nodes) n.remove();
    document.getElementById("beond-efiling-panel")?.remove();
    w.__beondPanelMounted = false;
  };
}

/** One captioned box, worded the way the real form captions its own. */
function DemoField({ label }: { label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink/55">
      {label}
      <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-ink outline-none focus:border-[#2968A5]" />
    </label>
  );
}

interface Step {
  /** What the user is doing, in the caption under the mock. */
  caption: string;
  /** Address shown in the mock's URL bar. */
  url: string;
  /** The screen's own heading. */
  heading: string;
  /** Rows on the screen; `hit` is the one to click. */
  items: string[];
  hit: number;
  /** Optional aside — why this step trips people up. */
  note?: string;
}

const STEPS: Step[] = [
  {
    caption: "เข้าเว็บกรมสรรพากรแล้วเข้าสู่ระบบ",
    url: "efiling.rd.go.th",
    heading: "ยื่นแบบและชำระภาษีออนไลน์",
    items: ["เข้าสู่ระบบ", "สมัครสมาชิก", "ตรวจสอบผลการยื่นแบบ"],
    hit: 0,
    note: "ใช้เลขบัตรประชาชน 13 หลัก · ถ้าลืมรหัสผ่านต้องกู้คืนก่อน",
  },
  {
    caption: "เลือกแบบภาษีเงินได้บุคคลธรรมดา",
    url: "efiling.rd.go.th / หน้าหลัก",
    heading: "เลือกแบบที่ต้องการยื่น",
    items: ["ภ.ง.ด.90/91 — ภาษีเงินได้บุคคลธรรมดา", "ภ.ง.ด.94 — ครึ่งปี", "ภ.พ.30 — ภาษีมูลค่าเพิ่ม"],
    hit: 0,
    note: "ดอกเบี้ยหุ้นกู้อยู่ใน ภ.ง.ด.90 (มีเงินได้นอกเหนือเงินเดือน)",
  },
  {
    caption: "ผ่านหน้าข้อมูลผู้เสียภาษีไปยังขั้นตอนรายได้",
    url: "ภ.ง.ด.90/91 · ขั้นตอนที่ 1",
    heading: "ขั้นตอนการยื่นแบบ",
    items: ["ข้อมูลผู้เสียภาษี", "ระบุเงินได้", "ระบุค่าลดหย่อน", "ตรวจสอบข้อมูล"],
    hit: 1,
  },
  {
    caption: "เลือกหมวดเงินได้จากการลงทุน",
    url: "ภ.ง.ด.90/91 · ระบุเงินได้",
    heading: "เลือกประเภทเงินได้ที่ได้รับ",
    items: [
      "เงินได้จากการจ้างงาน (มาตรา 40(1))",
      "เงินได้จากทรัพย์สิน / การลงทุน (มาตรา 40(4))",
      "เงินได้จากวิชาชีพอิสระ (มาตรา 40(6))",
      "เงินได้จากธุรกิจ (มาตรา 40(8))",
    ],
    hit: 1,
    note: "ต้องติ๊กหมวดนี้ก่อน หัวข้อดอกเบี้ยถึงจะโผล่ในหน้าถัดไป",
  },
  {
    caption: "เปิดหัวข้อดอกเบี้ยและเงินปันผล",
    url: "ภ.ง.ด.90/91 · เงินได้ 40(4)",
    heading: "เงินได้จากทรัพย์สิน การลงทุน",
    items: [
      "ดอกเบี้ย เงินปันผล เงินเทียบเท่าเงินปันผล (มาตรา 40(4))",
      "ขายอสังหาริมทรัพย์ (มาตรา 40(8))",
      "เงินได้จากการขายหน่วยลงทุน",
    ],
    hit: 0,
  },
  {
    caption: "ถึงหน้ากรอกแล้ว — เปิดส่วนขยาย beond กด “กรอกเลย”",
    url: "ภ.ง.ด.90/91 · ดอกเบี้ย 40(4)",
    heading: "ผู้จ่ายเงินได้รายที่ 1",
    items: ["ประเภทธุรกิจ", "จำนวนเงินได้", "ภาษีหัก ณ ที่จ่าย", "เลขประจำตัวผู้เสียภาษีผู้จ่าย"],
    hit: -1,
    note: "การ์ด beond จะโผล่ที่ขอบขวาเอง · ไม่ต้องกรอกทีละช่อง",
  },
];

const DWELL = 2800; // ms per step when playing

export default function ExtensionGuide() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const go = useCallback((n: number) => {
    setI(Math.min(Math.max(n, 0), STEPS.length - 1));
  }, []);

  // Auto-advance, and stop at the end rather than looping: the last screen is
  // the destination, and yanking the user back to step one reads as a failure.
  useEffect(() => {
    if (!playing || last) return;
    const t = setTimeout(() => setI((n) => n + 1), DWELL);
    return () => clearTimeout(t);
  }, [playing, i, last]);

  useEffect(() => {
    if (last) setPlaying(false);
  }, [last]);

  // The real panel, floating over this page exactly as it floats over the RD
  // form. Mounted last so it sits above everything the guide draws.
  useEffect(() => mountRealPanel(), []);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[#EEF1F5] px-4 py-8 font-kanit lg:px-8 lg:py-12">
      <header className="w-full max-w-[860px]">
        <p className="text-base text-ink/45">ส่วนขยาย beond</p>
        <h1 className="text-3xl leading-tight font-medium text-ink">ไปหน้ากรอก 40(4) ยังไง</h1>
        <p className="mt-2 text-sm text-ink/50">
          {STEPS.length} ขั้นตอน จากหน้าแรกของ e-Filing จนถึงช่องที่ส่วนขยายกรอกให้
        </p>
      </header>

      {/* The mock. Labelled on the frame itself, not only in the copy — a
          screenshot of this page taken out of context must still say what it
          is. */}
      <div className="mt-6 w-full max-w-[860px] overflow-hidden rounded-3xl border border-black/8 bg-white">
        <div className="flex items-center gap-3 border-b border-black/6 px-4 py-3">
          <span className="flex gap-1.5">
            {["#E8746A", "#E8B04B", "#5FB865"].map((c) => (
              <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-black/5 px-3 py-1 text-xs text-ink/50">
            {step.url}
          </span>
          <span className="shrink-0 rounded-full bg-[#E8A33D]/12 px-2.5 py-1 text-[11px] font-medium text-[#B97C1E]">
            ภาพจำลอง ไม่ใช่หน้าเว็บจริง
          </span>
        </div>

        <div className="min-h-[330px] p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-lg font-medium text-ink">{step.heading}</h2>
              <ul className="mt-4 flex flex-col gap-2">
                {step.items.map((label, n) => {
                  const target = n === step.hit;
                  return (
                    <li
                      key={label}
                      className={`relative flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                        target
                          ? "border-[#2968A5] bg-[#2968A5]/6 text-ink"
                          : "border-black/8 bg-white text-ink/45"
                      }`}
                    >
                      <span className="min-w-0 truncate">{label}</span>
                      {target && (
                        <>
                          {/* One ring pulse per step — the click itself. */}
                          <motion.span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#2968A5]"
                            initial={{ opacity: 0.6, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.04 }}
                            transition={{ duration: 0.9, delay: 0.45, repeat: Infinity, repeatDelay: 0.9 }}
                          />
                          {/* The pointer travels between rows on its own via a
                              shared layout id, so each step reads as one hand
                              moving rather than a cursor teleporting. */}
                          <motion.span
                            layoutId="guide-cursor"
                            transition={{ type: "spring", stiffness: 260, damping: 26 }}
                            className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2968A5] text-white"
                          >
                            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                              <path d="M5 3l14 8-6 1.5L10 19z" />
                            </svg>
                          </motion.span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Caption + controls */}
      <div className="mt-5 flex w-full max-w-[860px] flex-col gap-4">
        <div>
          <p className="text-base font-medium text-ink">
            <span className="mr-2 text-[#2968A5]">{i + 1}.</span>
            {step.caption}
          </p>
          {step.note && <p className="mt-1 text-sm text-ink/50">{step.note}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="flex size-10 items-center justify-center rounded-full transition hover:bg-black/5 disabled:opacity-30"
            aria-label="ขั้นก่อนหน้า"
          >
            <IconArrowLeft size={18} />
          </button>
          <button
            onClick={() => (last ? (setI(0), setPlaying(true)) : setPlaying((p) => !p))}
            className="flex size-10 items-center justify-center rounded-full bg-[#2968A5] text-white transition hover:bg-[#2f76b8]"
            aria-label={last ? "เล่นใหม่" : playing ? "หยุด" : "เล่น"}
          >
            {last ? (
              <IconRefresh size={18} />
            ) : playing ? (
              <IconPlayerPauseFilled size={16} />
            ) : (
              <IconPlayerPlayFilled size={16} />
            )}
          </button>
          <button
            onClick={() => go(i + 1)}
            disabled={last}
            className="flex size-10 items-center justify-center rounded-full transition hover:bg-black/5 disabled:opacity-30"
            aria-label="ขั้นถัดไป"
          >
            <IconArrowRight size={18} />
          </button>

          {/* Step dots double as a jump target — a guide someone is following
              along with needs to be scrubbable, not only playable. */}
          <div className="ml-3 flex items-center gap-1.5">
            {STEPS.map((s, n) => (
              <button
                key={s.caption}
                onClick={() => { setPlaying(false); go(n); }}
                aria-label={`ขั้นที่ ${n + 1}`}
                aria-current={n === i ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-[#2968A5]" : "w-1.5 bg-black/15 hover:bg-black/30"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* The stand-in form the mounted panel fills. Labelled on the page, not
          only in a comment: this is a drawing of a government form and must
          never be mistakable for one. */}
      <section className="mt-10 w-full max-w-[860px]">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-medium text-ink">การ์ดส่วนขยายตัวจริง</h2>
          <span className="rounded-full bg-[#E8A33D]/12 px-2.5 py-1 text-[11px] font-medium text-[#B97C1E]">
            แบบฟอร์มสาธิต ไม่ใช่ของกรมสรรพากร
          </span>
        </div>
        <p className="mb-4 text-sm text-ink/50">
          CSS และ content script ของส่วนขยายจริง ทำงานบนหน้านี้โดยต่อ chrome.storage ปลอมไว้ · กด “กรอกเลย”
          ที่การ์ดขอบขวาแล้วช่องด้านล่างจะถูกกรอก
        </p>
        <div className="rounded-3xl border border-black/8 bg-white p-5 lg:p-6">
          {[1, 2].map((n) => (
            <fieldset key={n} className="mb-4 rounded-2xl border border-black/8 px-4 pt-2 pb-4 last:mb-0">
              <legend className="px-2 text-sm text-ink/45">ผู้จ่ายเงินได้รายที่ {n}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <DemoField label="ชื่อผู้จ่ายเงินได้" />
                <DemoField label="เลขประจำตัวผู้เสียภาษีผู้จ่าย" />
                <DemoField label="จำนวนเงินได้" />
                <DemoField label="ภาษีหัก ณ ที่จ่าย" />
              </div>
            </fieldset>
          ))}
        </div>
      </section>
    </main>
  );
}
