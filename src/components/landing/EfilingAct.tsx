/**
 * The e-Filing chapter: the browser extension filling the Revenue Department's
 * 40(4) form, told by scrolling.
 *
 * It is a re-enactment, not a screenshot — the same four fields the real
 * extension maps (extension/content/efiling.js, FIELDS), the same panel it
 * injects beside the form, and the same rows the app sends over the bridge
 * (src/lib/efilingSync.ts). Scroll drives the fill: the panel arrives, the
 * button is pressed, then each payer's four values are typed into the form in
 * the order the extension writes them.
 */
import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { IconLock, IconPointer } from "@tabler/icons-react";
import wordmark from "../../assets/landing-logo.svg?raw";

/** The four fields the extension maps, in the order it fills them. */
const FIELDS = [
  { key: "issuer_name", label: "ชื่อผู้จ่ายเงินได้" },
  { key: "issuer_tax_id", label: "เลขประจำตัวผู้เสียภาษีผู้จ่าย" },
  { key: "gross_interest", label: "จำนวนเงินได้" },
  { key: "wht_amount", label: "ภาษีหัก ณ ที่จ่าย" },
] as const;

/** One year of confirmed slips, already grouped per payer the way
 *  buildEfilingRows does — e-Filing files one row per ผู้จ่ายเงินได้. */
const ROWS = [
  { name: "บมจ. บีทีเอส กรุ๊ป โฮลดิ้งส์", taxId: "0107545000322", gross: 47830.14, wht: 7174.52 },
  { name: "บมจ. แสนสิริ", taxId: "0107537002460", gross: 38460.0, wht: 5769.0 },
  { name: "บมจ. บริทาเนีย", taxId: "0107563000371", gross: 24120.55, wht: 3618.08 },
] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtTaxId = (d: string) => `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;

const TOTAL_WHT = ROWS.reduce((s, r) => s + r.wht, 0);

/** Where in the section's scroll the panel lands and the fill runs. */
const PANEL_IN = 0.1;
const FILL_FROM = 0.26;
const FILL_TO = 0.92;
const CELLS = ROWS.length * FIELDS.length;

/**
 * One cell of the form. It types itself over its own slice of the fill, and
 * carries the extension's highlight while the caret is inside it.
 */
function Cell({
  p,
  index,
  value,
  align = "left",
}: {
  p: MotionValue<number>;
  index: number;
  value: string;
  align?: "left" | "right";
}) {
  const span = (FILL_TO - FILL_FROM) / CELLS;
  const from = FILL_FROM + index * span;
  // The last fifth of a cell's slice is left empty, so the caret rests on a
  // finished field for a beat before moving to the next one.
  const to = from + span * 0.8;

  const chars = useTransform(p, (v) => {
    const t = Math.min(1, Math.max(0, (v - from) / (to - from)));
    return value.slice(0, Math.round(t * value.length));
  });
  const active = useTransform(p, (v) => (v >= from && v < from + span ? 1 : 0));
  const done = useTransform(p, (v) => (v >= to ? 1 : 0));
  const ring = useTransform(active, (a) => (a ? "#43507F" : "#E3E6EE"));
  const glow = useTransform(active, (a) => (a ? "0 0 0 3px rgba(67,80,127,0.18)" : "0 0 0 0 rgba(0,0,0,0)"));
  const bg = useTransform(done, (d) => (d ? "#F7F8FB" : "#FFFFFF"));

  return (
    <motion.div
      style={{ borderColor: ring, boxShadow: glow, backgroundColor: bg }}
      className="flex h-9 items-center rounded-[4px] border px-2 text-[13px] text-[#1B1C1D] transition-none"
    >
      <motion.span className={`w-full truncate ${align === "right" ? "text-right" : ""}`}>
        {chars}
      </motion.span>
    </motion.div>
  );
}

/** A row of the beond panel: what the extension is about to write. */
function PanelRow({ row, p, index }: { row: (typeof ROWS)[number]; p: MotionValue<number>; index: number }) {
  const span = (FILL_TO - FILL_FROM) / ROWS.length;
  const from = FILL_FROM + index * span;
  const state = useTransform(p, (v) => (v >= from + span ? 2 : v >= from ? 1 : 0));
  const label = useTransform(state, (s): string => (s === 2 ? "กรอกแล้ว" : s === 1 ? "กำลังกรอก…" : "รอกรอก"));
  const color = useTransform(state, (s) => (s === 2 ? "#12BC59" : s === 1 ? "#43507F" : "#9AA0AE"));

  return (
    <div className="rounded-[10px] bg-[#F0F2F7] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-[#1B1C1D]">{row.name}</span>
        <motion.span style={{ color }} className="shrink-0 text-[11px] font-medium">
          {label}
        </motion.span>
      </div>
      <div className="mt-1 text-[11px] text-[#8A8A8A]">{fmtTaxId(row.taxId)}</div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-[#6B6B6B]">ภาษีหัก ณ ที่จ่าย</span>
        <span className="font-semibold text-[#43507F]">฿{fmt(row.wht)}</span>
      </div>
    </div>
  );
}

export default function EfilingAct() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: raw } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // With motion off the whole act is simply shown finished.
  const p = useTransform(raw, (v) => (reduce ? 1 : v));

  const panelX = useTransform(p, (v) => `${(1 - Math.min(1, v / PANEL_IN)) * 120}%`);
  const panelOpacity = useTransform(p, (v) => Math.min(1, v / PANEL_IN));
  const pressed = useTransform(p, (v) => (v >= FILL_FROM - 0.04 && v < FILL_FROM + 0.03 ? 1 : 0));
  const btnScale = useTransform(pressed, (x) => (x ? 0.96 : 1));
  const cursorOpacity = useTransform(p, (v) =>
    v > PANEL_IN * 0.6 && v < FILL_FROM + 0.05 ? 1 : 0,
  );
  const totalOpacity = useTransform(p, (v) => Math.min(1, Math.max(0, (v - FILL_TO) / 0.05)));
  const filled = useTransform(p, (v) =>
    Math.min(ROWS.length, Math.floor(((v - FILL_FROM) / (FILL_TO - FILL_FROM)) * ROWS.length + 0.0001)),
  );
  const progressWidth = useMotionTemplate`${useTransform(p, (v) =>
    Math.min(100, Math.max(0, ((v - FILL_FROM) / (FILL_TO - FILL_FROM)) * 100)),
  )}%`;

  return (
    <section
      ref={ref}
      id="efiling"
      className="relative scroll-mt-24 bg-[#F0F2F5]"
      style={{ height: reduce ? undefined : "320svh" }}
    >
      <div className={`${reduce ? "" : "sticky top-0"} flex h-svh flex-col justify-center px-5 py-10 lg:px-12`}>
        <div className="mx-auto w-full max-w-[1160px]">
          <h2 className="text-[clamp(1.75rem,3.4vw,3rem)] leading-tight font-medium text-[#2F3C6B]">
            ยื่นภาษีคืน โดยไม่ต้องพิมพ์เอง
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-[#5A6480] lg:text-lg">
            เปิด e-Filing ของกรมสรรพากร แล้วให้ส่วนเสริม beond กรอกเงินได้มาตรา 40(4)
            ของทั้งปีลงในแบบให้ — ชื่อผู้จ่าย เลข 13 หลัก ดอกเบี้ย และภาษีหัก ณ ที่จ่าย
          </p>

          {/* Browser window. */}
          <div className="mt-6 overflow-hidden rounded-[16px] bg-white shadow-[0_24px_60px_rgba(31,45,80,0.18)]">
            <div className="flex items-center gap-3 border-b border-black/5 bg-[#F3F4F7] px-4 py-2.5">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="size-2.5 rounded-full bg-[#28C840]" />
              </span>
              <span className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] text-[#5A6480]">
                <IconLock size={13} />
                efiling.rd.go.th
              </span>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
              {/* The RD form. */}
              <div className="min-w-0 p-5 lg:p-7">
                <div className="text-[13px] font-semibold text-[#1B1C1D]">
                  ภ.ง.ด.90 — เงินได้มาตรา 40(4)(ก) ดอกเบี้ย
                </div>
                <div className="mt-1 text-[11px] text-[#8A8A8A]">
                  ระบุผู้จ่ายเงินได้แต่ละราย พร้อมภาษีที่ถูกหัก ณ ที่จ่าย
                </div>

                <div className="mt-5 space-y-4">
                  {ROWS.map((row, r) => (
                    <div key={row.taxId} className="rounded-[10px] border border-[#E3E6EE] p-3">
                      <div className="text-[11px] font-medium text-[#8A8A8A]">
                        ผู้จ่ายเงินได้รายที่ {r + 1}
                      </div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {FIELDS.map((f, i) => {
                          const value =
                            f.key === "issuer_name"
                              ? row.name
                              : f.key === "issuer_tax_id"
                                ? fmtTaxId(row.taxId)
                                : f.key === "gross_interest"
                                  ? fmt(row.gross)
                                  : fmt(row.wht);
                          return (
                            <label key={f.key} className="block">
                              <span className="mb-1 block text-[11px] text-[#6B6B6B]">{f.label}</span>
                              <Cell
                                p={p}
                                index={r * FIELDS.length + i}
                                value={value}
                                align={f.key === "issuer_name" ? "left" : "right"}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* The panel the extension injects, brand side. */}
              <motion.aside
                style={{ x: panelX, opacity: panelOpacity }}
                className="relative border-l border-black/5 bg-white"
              >
                <div className="flex items-center justify-between bg-[#43507F] px-4 py-3 text-white">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span
                      className="block h-3.5 w-auto [&_svg]:h-full [&_svg]:w-auto"
                      style={{ ["--fill-0" as string]: "#FFFFFF" }}
                      aria-label="beond"
                      dangerouslySetInnerHTML={{ __html: wordmark }}
                    />
                    · 40(4)
                  </span>
                  <span className="text-[11px] text-white/70">ปีภาษี 2569</span>
                </div>

                <div className="space-y-3 p-4">
                  <motion.p className="text-[11px] text-[#6B6B6B]">
                    <motion.span>{filled}</motion.span>/{ROWS.length} ผู้จ่ายเงินได้ · จับคู่ช่องแล้ว
                  </motion.p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEFF5]">
                    <motion.div style={{ width: progressWidth }} className="h-full bg-[#43507F]" />
                  </div>

                  {ROWS.map((row, i) => (
                    <PanelRow key={row.taxId} row={row} p={p} index={i} />
                  ))}

                  <motion.p
                    style={{ opacity: totalOpacity }}
                    className="rounded-[10px] bg-[#EAF7EF] px-3 py-2 text-[12px] font-semibold text-[#137A3B]"
                  >
                    รวมภาษีหัก ณ ที่จ่าย ฿{fmt(TOTAL_WHT)}
                  </motion.p>

                  <div className="relative">
                    <motion.span
                      style={{ scale: btnScale }}
                      className="block rounded-[8px] bg-[#43507F] px-3 py-2 text-center text-[13px] font-semibold text-white"
                    >
                      กรอกอัตโนมัติ
                    </motion.span>
                    {/* The pointer that presses it. */}
                    <motion.span
                      style={{ opacity: cursorOpacity }}
                      className="pointer-events-none absolute top-1/2 left-1/2 text-[#1B1C1D]"
                    >
                      <IconPointer size={22} fill="white" />
                    </motion.span>
                  </div>
                </div>
              </motion.aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
