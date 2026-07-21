import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IconChevronLeft, IconChevronRight, IconEye, IconInfoCircle, IconCheck, IconCircleDotted, IconRestore, IconLogout, IconPuzzle, IconSettings } from "@tabler/icons-react";
import type { AuthProfile } from "../../lib/auth";
import {
  usePortfolioStats,
  useHoldings,
  useTimeline,
  useTaxCredits,
  matchConfirmedPayouts,
} from "../../hooks/usePortfolio";
import { LEVELS, levelIndex } from "../home/ProfileLevelModal";
import { issuerName } from "../../lib/issuerLogo";
import IssuerLogo from "../IssuerLogo";
import wordmark from "../../assets/landing-logo.svg?raw";
import moneyArt from "../../assets/figma-money.svg";
import mascot2d from "../../assets/mascot-2d.png";
import lineQr from "../../assets/line-qr.png";
import mailboxClosed from "../../assets/mailbox-closed.svg";
import mailboxOpen from "../../assets/mailbox-open.svg";
import { estimatedRefund, getMarginalRate } from "../../lib/taxSettings";
import TaxStoryChapter, { type TaxStoryData } from "./TaxStoryChapter";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// beond v3 dashboard — a single fixed two-column page (Figma design system v3):
// left rail of summary cards, right blue panel with the month folder + coupon
// building chart.
export default function HomeDashboard({ profile, onLogout }: { profile: AuthProfile; onLogout?: () => void }) {
  const { totalValue, avgCoupon, avgRemainingYears } = usePortfolioStats();
  const { holdings } = useHoldings();
  const { months } = useTimeline();
  const { docs } = useTaxCredits();
  const matched = useMemo(() => matchConfirmedPayouts(months, docs), [months, docs]);

  const level = LEVELS[levelIndex(totalValue)];
  // couponRate is stored as a percent (e.g. 5.5), so income needs ÷100.
  const annualCoupon = useMemo(() => holdings.reduce((s, h) => s + (h.faceValue * h.couponRate) / 100, 0), [holdings]);
  const monthly = annualCoupon / 12;

  const payoutMonths = months; // continuous timeline
  const currentIdx = useMemo(() => {
    const now = new Date();
    const beY = now.getFullYear() + 543;
    const mi = now.getMonth();
    const exact = payoutMonths.findIndex((m) => Number(m.year) === beY && THAI_MONTHS.indexOf(m.month) === mi);
    if (exact >= 0) return exact;
    const up = payoutMonths.findIndex((m) => {
      const y = Number(m.year);
      return y > beY || (y === beY && THAI_MONTHS.indexOf(m.month) >= mi);
    });
    return up >= 0 ? up : 0;
  }, [payoutMonths]);

  const [monthIdx, setMonthIdx] = useState<number | null>(null);
  const [slipFocus, setSlipFocus] = useState<string | null>(null);
  // The folder card is hidden during the chart's intro, shown once it settles.
  const [chartSettled, setChartSettled] = useState(false);

  // Holdings list scroll-fade: mask the top/bottom edge only when there's more
  // content to scroll toward in that direction.
  const listRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setEdge((c) => (c.top === top && c.bottom === bottom ? c : { top, bottom }));
  };
  const FADE = "24px";
  const listMask = `linear-gradient(to bottom, ${edge.top ? "transparent" : "black"} 0, black ${FADE}, black calc(100% - ${FADE}), ${edge.bottom ? "transparent" : "black"} 100%)`;
  // Recompute on holdings change + on resize so the bottom fade appears when the
  // list overflows even before the user scrolls.
  useLayoutEffect(() => {
    onListScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length]);
  useEffect(() => {
    window.addEventListener("resize", onListScroll);
    return () => window.removeEventListener("resize", onListScroll);
  }, []);
  const idx = monthIdx ?? currentIdx;
  const month = payoutMonths[Math.min(idx, Math.max(0, payoutMonths.length - 1))];

  const folder = useMemo(() => {
    if (!month) return { slips: [] as { id: string; symbol: string; issuer: string; confirmed: boolean }[], remaining: 0, label: "" };
    const slips = month.payouts.map((p) => ({ id: p.id, symbol: p.symbol, issuer: p.issuer, confirmed: matched.has(p.id) }));
    return { slips, remaining: slips.filter((s) => !s.confirmed).length, label: `${month.month} ${month.year}` };
  }, [month, matched]);

  // Year-to-date collection progress (this BE year). `credit` = WHT already
  // secured (confirmed slips); `potentialWht` = WHT across every payout this year
  // (the ceiling if all slips get collected).
  const yearProgress = useMemo(() => {
    const beY = month ? month.year : String(new Date().getFullYear() + 543);
    let total = 0, confirmed = 0, credit = 0, potentialWht = 0;
    for (const m of months) {
      if (m.year !== beY) continue;
      for (const p of m.payouts) {
        total++;
        potentialWht += p.amount * 0.15;
        if (matched.has(p.id)) {
          confirmed++;
          credit += p.amount * 0.15;
        }
      }
    }
    return { total, confirmed, credit, potentialWht, pct: total ? confirmed / total : 0, year: beY };
  }, [months, matched, month]);

  // Caller's marginal tax bracket for the refund story (defaults to 5% until the
  // saved setting loads / when logged out, so the tax chapter still narrates).
  const [taxRate, setTaxRate] = useState(5);
  useEffect(() => {
    let alive = true;
    getMarginalRate().then((r) => {
      if (alive && r !== null) setTaxRate(r);
    });
    return () => { alive = false; };
  }, []);

  const taxStory = useMemo<TaxStoryData>(() => ({
    rate: taxRate,
    year: yearProgress.year,
    collectedRefund: estimatedRefund(yearProgress.credit, taxRate),
    fullRefund: estimatedRefund(yearProgress.potentialWht, taxRate),
    confirmed: yearProgress.confirmed,
    total: yearProgress.total,
  }), [taxRate, yearProgress]);

  // Story chapters in the right panel, in order:
  //   goal  — this year's tax-saving goal (staircase + gauge + text), plays first
  //   income — the coupon cubes rise/tour/settle (only starts after the goal)
  //   slip  — the slip-collection panel slides up once the cubes settle
  const [chapter, setChapter] = useState<"goal" | "income" | "slip">("goal");
  const slipQueued = useRef(false);
  useEffect(() => {
    if (!chartSettled || slipQueued.current) return;
    slipQueued.current = true;
    const t = setTimeout(() => setChapter("slip"), 700);
    return () => clearTimeout(t);
  }, [chartSettled]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#EEF1F5] font-kanit">
      {/* Header hidden for now — kept behind a false guard to re-enable later. */}
      {false && (
        <header className="sticky top-0 z-40 bg-white py-4">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6">
            <div className="leading-tight text-[#43507F]">
              <span
                className="block h-5 w-auto [&_svg]:h-full [&_svg]:w-auto"
                style={{ ["--fill-0" as string]: "#43507F" }}
                aria-label="beond"
                dangerouslySetInnerHTML={{ __html: wordmark }}
              />
              <p className="mt-0.5 text-[10px] font-medium text-[#43507F]/60">Bring Your Bonds Beyond</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                aria-label="ติดตั้งส่วนขยาย"
                className="flex size-12 items-center justify-center rounded-full border border-black/10 bg-white text-ink/70 transition hover:bg-black/5 hover:text-ink"
              >
                <IconPuzzle size={22} stroke={1.75} className="-translate-x-[0.5px] translate-y-[0.5px]" />
              </button>
              <ProfileBadge profile={profile} onLogout={onLogout} />
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* LEFT column */}
        <div className="flex min-h-0 flex-col gap-4">
          {/* Portfolio value card */}
          <section className="relative shrink-0 overflow-hidden rounded-3xl bg-white p-6">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-base text-ink/80">
                พอร์ตโฟลิโอของฉัน <IconEye size={18} className="text-ink/40" />
              </p>
              <span className="flex items-center gap-1 rounded-full bg-[#F0F2F7] px-3 py-1 text-sm text-ink/80">
                {level.label} <IconInfoCircle size={16} className="text-ink/40" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-medium text-ink">฿{fmtTHB(totalValue)}</p>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <p className="text-sm text-ink/60">ดอกเบี้ยเฉลี่ย</p>
                <p className="text-2xl font-medium text-ink">{avgCoupon.toFixed(1)}%</p>
              </div>
              <span className="h-10 w-px bg-black/10" />
              <div>
                <p className="text-sm text-ink/60">อายุคงเหลือเฉลี่ย</p>
                <p className="text-2xl font-medium text-ink">{avgRemainingYears.toFixed(2)} ปี</p>
              </div>
            </div>
            <img src={level.mascot} alt="" aria-hidden className="pointer-events-none absolute right-4 bottom-2 h-28 w-auto" />
          </section>

          {/* Holdings card — header (count + monthly) then a bordered list card.
              Figma node 962:2937. */}
          <section className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white p-6">
            <div className="relative shrink-0">
              <p className="text-base text-ink/80">หุ้นกู้ที่ถืออยู่</p>
              <p className="mt-1 text-4xl font-medium text-ink">{holdings.length} รุ่น</p>
              <p className="mt-1 text-sm text-ink/80">ดอกเบี้ยต่อเดือน&nbsp; ~฿{fmtTHB(monthly)}</p>
              <img src={moneyArt} alt="" aria-hidden className="pointer-events-none absolute -top-2 right-0 h-28 w-auto" />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-3xl border-[0.5px] border-[#d9d9d9] p-1">
              <ul
                ref={listRef}
                onScroll={onListScroll}
                className="flex h-full flex-col overflow-y-auto px-3 py-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
                style={{
                  WebkitMaskImage: listMask,
                  maskImage: listMask,
                }}
              >
                {holdings.map((h, i) => (
                  <li
                    key={h.id}
                    className={`flex items-center justify-between gap-4 py-2 ${i < holdings.length - 1 ? "border-b-[0.5px] border-black/10" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <IssuerLogo symbol={h.symbol} name={issuerName(h.symbol, h.issuer)} size={48} />
                      <div className="min-w-0">
                        <p className="text-xl font-medium text-ink">{h.symbol}</p>
                        <p className="truncate text-sm text-ink/80">{issuerName(h.symbol, h.issuer)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-medium text-ink">{h.couponRate.toFixed(1)}%</p>
                      <p className="text-sm text-ink/80">{h.rating ?? "—"}</p>
                    </div>
                  </li>
                ))}
                {holdings.length === 0 && <li className="py-6 text-center text-sm text-ink/40">ยังไม่มีหุ้นกู้</li>}
              </ul>
            </div>
          </section>

          {/* LINE CTA */}
          <section className="relative shrink-0 overflow-hidden rounded-3xl bg-[#06C755] p-6 text-white">
            <p className="max-w-[60%] text-lg font-medium">สแกนใบสลิปดอกเบี้ยหุ้นกู้ผ่าน LINE OA</p>
            <p className="mt-1 text-sm text-white/90">แอดเพื่อนเลย @beond</p>
            <div className="absolute right-4 bottom-3 flex items-end gap-2">
              <img src={mascot2d} alt="" aria-hidden className="h-24 w-auto" />
              <img src={lineQr} alt="LINE QR" className="size-24 rounded-lg bg-white p-1" />
            </div>
          </section>
        </div>

        {/* RIGHT blue panel */}
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-[#779BC6] to-white p-6">
          {/* Income chapter — folder card + coupon building chart. Always mounted +
              visible: during the tax chapter the cubes stay on screen (only the
              folder card fades out, letting the gauge overlay take its place). */}
          <div className="flex min-h-0 flex-1 flex-col">
          {/* Folder summary card. The month tab + restore live in one flex row
              ABOVE the card; the row sits behind the card (z-0) so the restore
              can rise up from behind the card's top edge. Hidden (keeps its space)
              while the tax chapter's gauge overlays this region. */}
          <div
            className="relative z-10 mt-14"
            style={{
              opacity: chapter === "slip" ? 1 : 0,
              transform: chapter === "slip" ? "translateY(0)" : "translateY(40px)",
              pointerEvents: chapter === "slip" ? "auto" : "none",
              transition: "opacity 500ms ease, transform 600ms cubic-bezier(.34,1.2,.5,1)",
            }}
          >
            {/* Tab row — pill + restore, spaced by the flex gap (no magic offset) */}
            <div className="absolute bottom-full left-6 z-0 flex items-end gap-2">
              <div className="flex items-center gap-2 rounded-t-2xl border border-b-0 border-black/10 bg-white/95 p-2 backdrop-blur">
                <button onClick={() => setMonthIdx((idx - 1 + payoutMonths.length) % payoutMonths.length)} aria-label="เดือนก่อน" className="flex size-8 items-center justify-center rounded-full border border-black/10 text-ink transition hover:bg-black/5">
                  <IconChevronLeft size={22} />
                </button>
                <span className="min-w-[120px] text-center text-base font-medium text-ink">{folder.label}</span>
                <button onClick={() => setMonthIdx((idx + 1) % payoutMonths.length)} aria-label="เดือนถัดไป" className="flex size-8 items-center justify-center rounded-full border border-black/10 text-ink transition hover:bg-black/5">
                  <IconChevronRight size={22} />
                </button>
              </div>
              <AnimatePresence>
                {idx !== currentIdx && (
                  <motion.button
                    key="restore"
                    onClick={() => setMonthIdx(currentIdx)}
                    aria-label="กลับสู่เดือนปัจจุบัน"
                    initial={{ y: 48, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 48, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.9 }}
                    className="flex size-12 items-center justify-center rounded-t-2xl border border-b-0 border-black/10 bg-white/95 text-ink/80 backdrop-blur transition-colors hover:bg-black/5"
                  >
                    <IconRestore size={22} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="relative z-10 rounded-[24px] bg-white/95 px-5 pb-5 pt-5 shadow-sm backdrop-blur">

            {/* Mailbox illustration — the grey backdrop panel baked into the SVG
                (y24→184, 86% of its 186 height) is sized to exactly fill the card
                height; the mailbox flag bleeds above the top, the fence base is
                cropped at the bottom-right rounded corner. Open flap while slips
                remain to collect, closed once all are confirmed. */}
            <div
              className="pointer-events-none absolute right-0 bottom-0 z-0 w-[380px] overflow-hidden rounded-br-[24px]"
              style={{ top: "-15%" }}
            >
              <img
                src={folder.remaining > 0 ? mailboxOpen : mailboxClosed}
                alt=""
                aria-hidden
                className="absolute right-0 top-0 translate-x-12"
                style={{ height: "101.1%", width: "auto", maxWidth: "none" }}
              />
            </div>

            {/* Left content — kept clear of the slips on the right */}
            <div className="relative z-10 max-w-[58%]">
              <p className="text-sm text-ink/80">สลิปที่ต้องสะสมของเดือน</p>
              {/* Fixed row height (= issuer-logo size) so months with 0 logos
                  don't shrink the row and shift the chart below. */}
              <div className="mt-0.5 flex h-9 items-center gap-2">
                <span className="text-3xl font-medium text-ink">{folder.remaining} ใบ</span>
                {/* Issuer logo per slip (+ status badge). Click focuses the slip
                    in the 3D stack. */}
                {folder.slips.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSlipFocus((cur) => (cur === s.id ? null : s.id))}
                    className={`relative rounded-full transition ${slipFocus === s.id ? "ring-2 ring-[#3FA35B] ring-offset-2" : "hover:scale-105"}`}
                  >
                    <IssuerLogo symbol={s.symbol} name={issuerName(s.symbol, s.issuer)} size={36} />
                    {s.confirmed ? (
                      <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-[#3FA35B] text-white ring-2 ring-white">
                        <IconCheck size={12} />
                      </span>
                    ) : (
                      <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-[#F2F4F6] text-ink/40 ring-2 ring-white">
                        <IconCircleDotted size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 w-3/5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-ink/70">สะสมได้ตลอดปี ({yearProgress.confirmed}/{yearProgress.total} ใบ)</p>
                  <p className="text-base font-medium text-ink">฿{fmtTHB(yearProgress.credit)}</p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-[#3FA35B]" style={{ width: `${yearProgress.pct * 100}%` }} />
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Building chart (year summary overlays inside it, so it doesn't
              steal vertical space from the cube stage). */}
          <BuildingChart
            months={payoutMonths}
            activeIdx={idx}
            matched={matched}
            onSelect={setMonthIdx}
            onSettled={() => setChartSettled(true)}
            showWidgets={chapter === "slip"}
            start={chapter === "income"}
          />
          </div>

          {/* Tax goal chapter — the opener; hands off to the income cubes. */}
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{ opacity: chapter === "goal" ? 1 : 0, transition: "opacity 500ms ease" }}
          >
            <TaxStoryChapter
              data={taxStory}
              active={chapter === "goal"}
              onDone={() => setChapter("income")}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

// Header avatar → click opens a dropdown with profile info, settings, logout.
function ProfileBadge({ profile, onLogout }: { profile: AuthProfile; onLogout?: () => void }) {
  const [open, setOpen] = useState(false);
  const name = profile.displayName ?? "ผู้ใช้";
  const Avatar = ({ size }: { size: number }) =>
    profile.pictureUrl ? (
      <img src={profile.pictureUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    ) : (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-[#43507F]/10 font-bold text-[#43507F]"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {name.slice(0, 1)}
      </div>
    );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="โปรไฟล์"
        className="flex size-12 items-center justify-center rounded-full transition hover:opacity-90"
      >
        <Avatar size={40} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-black/10 p-4">
                <Avatar size={44} />
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-ink">{name}</p>
                  <p className="text-xs text-ink/50">บัญชี beond</p>
                </div>
              </div>
              <div className="p-1.5">
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/80 transition hover:bg-black/5">
                  <IconSettings size={18} /> ตั้งค่า
                </button>
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#e4463c] transition hover:bg-[#e4463c]/10"
                >
                  <IconLogout size={18} /> ออกจากระบบ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// The coupon-income skyline as a perspective deck of real 3D buildings: the
// focused month sits centre, largest (scale 1); neighbours shrink and bunch with
// depth — past months recede BEHIND (lower z), future months stack in FRONT
// (higher z). A month with multiple payouts stacks one cuboid per payout. Click
// any building to swap it to centre. Paged with ‹ ›.
// Deck depth: neighbours aren't scaled down — they're pushed BACK in Z so the
// deck's own perspective foreshortens them (real 3D distance, not a resize).
const XUNIT = 116; // horizontal fan per month (saturating → overlap)
const XFALLOFF = 0.72; // <1 → far months bunch outward
const SCALE_FALLOFF = 0.8; // farther month (past OR future) → smaller
// Paint order: future stacks in FRONT (higher zIndex), past recedes BEHIND.
const B_W = 190; // building on-screen footprint width (px)
const S = Math.round(B_W * 0.72); // 3D base side (rotateY 45° projects it ≈ B_W wide)
const CUBE_H = 200; // fixed height of ONE cube (one payout) — uniform everywhere
const PERSP = 2600; // large → near-orthographic (less lean/convergence)
const VIEW = "rotateX(16deg) rotateY(-45deg)"; // camera angle tuned in the ?cube POC
// Cuboid face palettes — front (darker), right (lighter), top (lightest).
const FACE_L = { green: "#5E9129", grey: "#94969B" };
const FACE_R = { green: "#80BA44", grey: "#C4C6CB" };
const FACE_T = { green: "#8FC258", grey: "#CDCFD4" };

interface Seg {
  id: string;
  symbol: string;
  issuer: string;
  amount: number;
  confirmed: boolean;
}

function BuildingChart({
  months,
  activeIdx,
  matched,
  onSelect,
  onSettled,
  showWidgets = false,
  start = true,
}: {
  months: ReturnType<typeof useTimeline>["months"];
  activeIdx: number;
  matched: ReturnType<typeof matchConfirmedPayouts>;
  onSelect: (i: number) => void;
  onSettled?: () => void;
  showWidgets?: boolean; // month total — held back until the slip panel
  start?: boolean; // gate the intro so it waits for the goal chapter to finish
}) {
  // Intro storytelling (plays once): bars grow out of the ground in the iso view
  // — you feel the 3D dimension — then the camera turns them face-on into a flat
  // bar chart (the resting state), and finally the ฿ amounts fade up.
  const [grown, setGrown] = useState(false); // false → collapsed on the ground
  const [faced, setFaced] = useState(false); // false → iso 3D, true → front-on
  const [tourIdx, setTourIdx] = useState<number | null>(null); // camera visiting ordered[i]
  const introDone = useRef(false);
  // 3D transforms need pixel heights, so measure the stage.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState(0);
  const [stageW, setStageW] = useState(0);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      setStageH(el.clientHeight);
      setStageW(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // All months of the focused month's year, positioned by distance (d) from the
  // focused one so the whole year recedes into depth around the centre.
  const focusYear = months[activeIdx]?.year;
  // Show all 12 months of the focused year (empty ones render a faint
  // placeholder cube); the camera tour, though, only visits months with income.
  const items = months
    .map((m, g) => ({ m, g, d: g - activeIdx }))
    .filter(({ m }) => m.year === focusYear);

  // Render far→near so DOM order matches stacking (zIndex still set explicitly).
  const ordered = [...items].sort((a, b) => a.d - b.d);

  // Horizontal fan offset for a given distance (shared by the layout + the
  // camera tour, which slides the deck to centre each building it visits).
  const xOf = (d: number) => (d === 0 ? 0 : Math.sign(d) * XUNIT * ((1 - Math.pow(XFALLOFF, Math.abs(d))) / (1 - XFALLOFF)));

  // Intro storytelling (once): bars rise in iso → the camera tours each cube
  // left→right (turns it front, centres + spotlights it) → pulls back to the
  // full front-on bar chart with every amount revealed.
  const orderedRef = useRef(ordered);
  orderedRef.current = ordered;
  // No cleanup that clears the timers: under React StrictMode the effect is
  // mounted → unmounted → remounted, and clearing on the throwaway cleanup would
  // cancel the whole sequence before it runs. introDone guards against a double
  // schedule instead; the chart lives for the session so the timers are safe.
  useEffect(() => {
    if (!start || stageH <= 0 || introDone.current || orderedRef.current.length === 0) return;
    introDone.current = true;
    // Only visit months with income — empty placeholder cubes are shown but the
    // camera skips over them.
    const visit = orderedRef.current.map((it, i) => ({ it, i })).filter(({ it }) => it.m.payouts.length > 0).map(({ i }) => i);
    // Story order: the year-overview text reads FIRST (alone), then the cubes
    // rise, get toured, and settle.
    const GROW = 1900; // let the income text land before the bars rise
    setTimeout(() => setGrown(true), GROW);
    let t = GROW + 1000; // after the grow settles
    for (const i of visit) {
      setTimeout(() => setTourIdx(i), t);
      t += 1300; // hold on each cube long enough to read it
    }
    setTimeout(() => {
      setTourIdx(null);
      setFaced(true); // pull back to the flat bar chart, reveal all amounts
      onSettled?.(); // tell the parent the intro finished
    }, t + 150);
    // Depend on the cube count too: real data loads async, so ordered.length
    // goes 0 → N after stageH is already set — without this the intro would only
    // fire on a later stageH change (e.g. a window resize).
  }, [stageH, ordered.length, start]);

  // Slide the whole deck so the currently-toured building sits at centre.
  const deckShift = faced || tourIdx == null || !ordered[tourIdx] ? 0 : -xOf(ordered[tourIdx].d);

  // Intro story — a one-line year overview shown while the bars explore, gone
  // once they settle into the chart.
  const yearMs = months.filter((m) => m.year === focusYear);
  const incomeMs = yearMs.filter((m) => m.payouts.length > 0);
  const storyTotal = incomeMs.reduce((s, m) => s + m.payouts.reduce((a, p) => a + p.amount, 0), 0);
  const topMonth = incomeMs.reduce<{ month: string; t: number } | null>((best, m) => {
    const t = m.payouts.reduce((a, p) => a + p.amount, 0);
    return t > (best?.t ?? -1) ? { month: m.month, t } : best;
  }, null);

  // Fit-to-height: one cube unit is CUBE_H, but if the busiest month of the year
  // would overflow the stage, shrink the unit so its tower fills ~85% instead.
  // Every cube stays the same size as every other (uniform) — the unit just
  // adapts to the tallest stack so a 3-payout month never clips the top.
  const maxCubes = Math.max(1, ...months.filter((m) => m.year === focusYear).map((m) => m.payouts.length));
  const cubeH = stageH > 0 ? Math.min(CUBE_H, (stageH * 0.85) / maxCubes) : CUBE_H;

  // Resting bar-chart layout (after the intro settles): evenly spaced, no fan
  // overlap, no depth scaling — a flat, far-camera stacked bar chart.
  const nBars = ordered.length;
  const barSlot = stageW > 0 ? Math.min(170, (stageW * 0.92) / Math.max(1, nBars)) : 150;
  const barScale = Math.min(1, (barSlot * 0.8) / S);

  return (
    <div className="relative z-10 mt-2 flex-1">
      {/* Year summary — absolute overlays so they never steal stage height:
          bars top-left. */}
      {/* Month total — hidden during the intro, revealed with the slip panel. */}
      <div className="absolute left-0 top-0" style={{ zIndex: 120, opacity: showWidgets ? 1 : 0, pointerEvents: showWidgets ? "auto" : "none", transition: "opacity 500ms ease" }}>
        <p className="text-sm text-white/85">รายได้เดือน {months[activeIdx]?.month} {months[activeIdx]?.year}</p>
        <p className="text-3xl font-medium text-white">
          ฿{fmtTHB((months[activeIdx]?.payouts ?? []).reduce((s, p) => s + p.amount, 0))}
        </p>
      </div>

      {/* Intro story — year overview narration. Lines rise + fade in on a stagger
          as the story opens, then the whole block fades out once the bars settle. */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 text-center"
        style={{ top: -150, zIndex: 110 }}
        initial="hidden"
        animate={start && !faced ? "show" : "gone"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
          gone: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {[
          <span key="0" className="text-sm text-ink/55">ดอกเบี้ยเข้าปี {focusYear} · {incomeMs.length} เดือน</span>,
          <span key="1" className="text-3xl font-medium text-ink">เก็บสลิปทุกเดือน รวม ฿{fmtTHB(storyTotal)}</span>,
          <span key="2" className="text-sm text-ink/70">สะสมให้ครบ เพื่อขอคืนภาษีปลายปี{topMonth ? ` · เดือนเด่น ${topMonth.month}` : ""}</span>,
        ].map((node, i) => (
          <motion.p
            key={i}
            className={i === 0 ? "" : "mt-1"}
            variants={{
              hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
              show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 26 } },
              gone: { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.35 } },
            }}
          >
            {node}
          </motion.p>
        ))}
      </motion.div>

      {/* Baseline stage — lifted off the panel bottom so the whole bar chart
          floats above the x-axis. */}
      <div ref={stageRef} className="absolute inset-x-0 bottom-12 top-2">
        {/* Y axis (left) + X axis (baseline) — the chart frame; fades in only
            after the intro has settled into the bar chart. */}
        <div className="pointer-events-none absolute left-0 bottom-0 top-8" style={{ width: 1.5, background: "rgba(0,0,0,0.14)", zIndex: 1, opacity: faced ? 1 : 0, transition: "opacity 500ms ease" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: 1.5, background: "rgba(0,0,0,0.14)", zIndex: 1, opacity: faced ? 1 : 0, transition: "opacity 500ms ease" }} />
        {/* Deck — slides horizontally so the camera-toured building sits centre. */}
        <div
          className="absolute inset-0"
          style={{ transform: `translateX(${deckShift}px) translateY(${faced ? 0 : 72}px)`, transition: "transform 620ms cubic-bezier(.45,0,.25,1)" }}
        >
        {stageH > 0 &&
          ordered.map(({ d, g, m }, oi) => {
            // Two layouts: the intro deck (fan + depth scaling) while animating,
            // and the resting bar chart (even slots, no overlap, flat) once faced.
            const barX = (oi - (nBars - 1) / 2) * barSlot;
            const x = faced ? barX : xOf(d);
            const scale = faced ? barScale : Math.pow(SCALE_FALLOFF, Math.abs(d));
            // Camera-tour state for this building.
            const onTour = !faced && tourIdx != null; // a visit is in progress
            const isVisited = !faced && tourIdx === oi; // the one being looked at
            // Cubes stay iso during the explore; only the final settle turns them
            // front-on. Amounts still reveal on the cube being visited.
            const showFront = faced;
            // Largest payout at the base, smaller ones stacked on top.
            const segs: Seg[] = [...m.payouts]
              .sort((a, b) => b.amount - a.amount)
              .map((p) => ({ id: p.id, symbol: p.symbol, issuer: p.issuer, amount: p.amount, confirmed: matched.has(p.id) }));
            // Uniform cubes: height = one fixed CUBE_H per payout (empty → 1),
            // so every cube is the same real size; only distance shrinks it.
            const nCubes = Math.max(1, segs.length);
            const hpx = nCubes * cubeH;
            const baseBlur = Math.max(0, Math.abs(d) - 2) * 6;
            return (
              <button
                key={g}
                onClick={() => onSelect(g)}
                aria-label={`${m.month} ${m.year}`}
                className="absolute bottom-0 left-1/2 origin-bottom cursor-pointer"
                style={{
                  width: B_W,
                  height: hpx,
                  // scaleY grows the bar out of the ground; a visited cube snaps to
                  // a FIXED focus scale (same for every month → equal closeness to
                  // camera), otherwise it keeps its depth/rest scale.
                  transform: `translateX(calc(-50% + ${x}px)) scale(${isVisited ? 1.2 : scale}) scaleY(${grown ? 1 : 0.02})`,
                  // Flat, uniform stacking order in the resting chart; deck order during intro.
                  zIndex: faced ? 100 : isVisited ? 130 : 100 + d,
                  // No depth blur/brightness in the resting chart; deck effects during intro.
                  filter: faced ? "none" : `brightness(${1 - 0.05 * Math.abs(d)}) blur(${isVisited ? 0 : baseBlur}px)`,
                  // During the tour, non-visited cubes dim; all solid in the resting chart.
                  opacity: faced ? 1 : onTour ? (isVisited ? 1 : 0.22) : Math.abs(d) >= 3 ? 0.5 : 1,
                  // Slow, smooth ease-in-out for the zoom/pan feel.
                  transition: "transform 620ms cubic-bezier(.45,0,.25,1), filter 620ms cubic-bezier(.45,0,.25,1), opacity 620ms ease",
                  transitionDelay: faced || onTour ? "0ms" : `${Math.abs(d) * 70}ms`,
                }}
              >
                <Building3D hpx={hpx} segments={segs} label={faced ? undefined : m.month} frontView={showFront} reveal={faced || isVisited} delay={isVisited ? 0 : Math.abs(d) * 70} />
              </button>
            );
          })}
        </div>

        {/* X-axis month labels under each bar — appear with the resting chart. */}
        {stageH > 0 &&
          ordered.map(({ g, m }, oi) => {
            const barX = (oi - (nBars - 1) / 2) * barSlot;
            return (
              <div
                key={g}
                className="pointer-events-none absolute bottom-0 left-1/2 text-center text-xs text-ink/70"
                style={{
                  width: barSlot,
                  transform: `translateX(calc(-50% + ${barX}px)) translateY(20px)`,
                  opacity: faced ? 1 : 0,
                  transition: "opacity 450ms ease 200ms",
                  zIndex: 2,
                }}
              >
                {THAI_MONTHS_ABBR[THAI_MONTHS.indexOf(m.month)] ?? m.month}
              </div>
            );
          })}
      </div>

    </div>
  );
}

// A building rendered as real 3D cuboids: one stacked box per payout (largest at
// the base). Confirmed payouts are green, pending grey. Empty months render a
// single faint translucent cuboid. hpx = the building's pixel height.
function Building3D({ hpx, segments, label, frontView, reveal = true, delay = 0 }: { hpx: number; segments: Seg[]; label?: string; frontView?: boolean; reveal?: boolean; delay?: number }) {
  // Camera pans between the iso VIEW and a straight-on front view (rotateX/Y 0).
  const camera = frontView ? "rotateX(0deg) rotateY(0deg)" : VIEW;
  const camStyle = { transformStyle: "preserve-3d" as const, transform: `translateX(-50%) ${camera}`, transition: `transform 720ms cubic-bezier(.45,0,.25,1) ${delay}ms` };
  // Month label floating above the cube, on the SAME plane as the front face
  // (translateZ(S/2)) so it inherits the identical perspective skew. Fades up
  // with the amounts once the bar has turned front-on.
  const monthLabel = label ? (
    <div className="absolute bottom-0 left-1/2" style={{ transformStyle: "preserve-3d", transform: `translateY(${-(hpx + 12)}px)` }}>
      <div
        className="absolute bottom-0 left-0 text-center font-medium leading-none text-ink/80"
        style={{
          width: S,
          marginLeft: -S / 2,
          transform: `translateZ(${S / 2}px) translateY(${reveal ? 0 : 6}px)`,
          fontSize: 20,
          opacity: reveal ? 1 : 0,
          transition: "opacity 500ms ease 350ms, transform 500ms ease 350ms",
        }}
      >
        {label}
      </div>
    </div>
  ) : null;

  if (segments.length === 0) {
    return (
      <div className="absolute inset-0" style={{ perspective: PERSP }}>
        <div className="absolute bottom-0 left-1/2" style={camStyle}>
          {monthLabel}
          <Cuboid y={hpx / 2} h={hpx} front="rgba(255,255,255,0.5)" right="rgba(255,255,255,0.32)" top="rgba(255,255,255,0.68)" dashed />
        </div>
      </div>
    );
  }
  // Equal-height stacked boxes (like a stacked bar) — one cube per payout, split
  // evenly, flush against each other (no gap).
  const h = hpx / segments.length;
  let cum = 0; // running height from the base
  return (
    <div className="absolute inset-0" style={{ perspective: PERSP }}>
      <div className="absolute bottom-0 left-1/2" style={camStyle}>
        {monthLabel}
        {segments.map((s, i) => {
          const y = cum + h / 2;
          cum += h;
          const pal = s.confirmed ? "green" : "grey";
          return (
            <Cuboid
              key={s.id}
              y={y}
              h={h}
              front={FACE_L[pal]}
              right={FACE_R[pal]}
              top={FACE_T[pal]}
              showTop={i === segments.length - 1}
              showBottom={i === 0}
              seg={s}
              reveal={reveal}
            />
          );
        })}
      </div>
    </div>
  );
}

// One 3D box, centred at (0, −y) in the world (y = px above the base). Renders
// the two camera-facing side faces plus the top; a logo lives on the front face
// so it inherits the face's perspective.
function Cuboid({
  y,
  h,
  front,
  right,
  top,
  seg,
  dashed,
  showTop = true,
  showBottom = false,
  reveal = true,
}: {
  y: number;
  h: number;
  front: string;
  right: string;
  top: string;
  seg?: Seg;
  dashed?: boolean;
  showTop?: boolean;
  showBottom?: boolean;
  reveal?: boolean;
}) {
  const border = dashed ? "1px dashed rgba(255,255,255,0.7)" : undefined;
  return (
    <div className="absolute bottom-0 left-0" style={{ transformStyle: "preserve-3d", transform: `translateY(${-y}px)` }}>
      {/* front (darker) — logo sized to the segment so it never overflows a
          short box; hidden when the box is too small to hold it. */}
      <div
        className="absolute left-1/2 top-1/2 flex items-center justify-center"
        style={{ width: S, height: h, marginLeft: -S / 2, marginTop: -h / 2, background: front, border, transform: `translateZ(${S / 2}px)` }}
      >
        {seg && (() => {
          const box = Math.min(56, Math.round(Math.min(h, S) * 0.5));
          if (box < 30) return null;
          const badge = Math.round(box * 0.4);
          return (
            <div className="flex flex-col items-center gap-1.5">
              {/* Amount fades up on reveal; the logo shows from the start. */}
              <span
                className="font-medium leading-none text-white drop-shadow-sm"
                style={{
                  fontSize: Math.max(11, Math.round(box * 0.3)),
                  opacity: reveal ? 1 : 0,
                  transform: `translateY(${reveal ? 0 : 8}px)`,
                  transition: "opacity 500ms ease 350ms, transform 500ms ease 350ms",
                }}
              >
                ฿{fmtTHB(seg.amount)}
              </span>
              <span className="relative flex items-center justify-center" style={{ width: box, height: box }}>
                <IssuerLogo symbol={seg.symbol} name={issuerName(seg.symbol, seg.issuer)} size={box} />
                <span
                  className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full ring-2 ring-white ${seg.confirmed ? "bg-[#3AA55B] text-white" : "bg-[#F2F4F6] text-ink/40"}`}
                  style={{ width: badge, height: badge }}
                >
                  {seg.confirmed ? <IconCheck size={Math.round(badge * 0.7)} /> : <IconCircleDotted size={Math.round(badge * 0.7)} />}
                </span>
              </span>
            </div>
          );
        })()}
      </div>
      {/* right (lighter) */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: S, height: h, marginLeft: -S / 2, marginTop: -h / 2, background: right, border, transform: `rotateY(90deg) translateZ(${S / 2}px)` }}
      />
      {/* top (lightest) — only the topmost cube in a stack gets a roof, so
          flush internal boundaries don't z-fight into a seam line. */}
      {showTop && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: S, height: S, marginLeft: -S / 2, marginTop: -S / 2, background: top, border, transform: `rotateX(90deg) translateZ(${h / 2}px)` }}
        />
      )}
      {/* bottom (darkest) — closes the base so the iso view doesn't show a hollow
          underside. Only the base cube needs it. */}
      {showBottom && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: S, height: S, marginLeft: -S / 2, marginTop: -S / 2, background: front, border, transform: `rotateX(90deg) translateZ(${-h / 2}px)` }}
        />
      )}
    </div>
  );
}
