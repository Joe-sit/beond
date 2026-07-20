import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IconSmartHome, IconChartBar, IconWallet, IconLogout } from "@tabler/icons-react";
import type { AuthProfile } from "../../lib/auth";
import { useTimeline, useTaxCredits, matchConfirmedPayouts } from "../../hooks/usePortfolio";
import wordmark from "../../assets/landing-logo.svg?raw";
import mascot from "../../assets/mascot-2d.png";
import lineQr from "../../assets/line-qr.png";
import HomeReworkSkeleton from "./HomeReworkSkeleton";
import MonthFolderCard, { type FolderSlip } from "./MonthFolderCard";
import BondScanStack, { type SlipPaperData } from "./BondScanStack";
import PortfolioSection from "./PortfolioSection";

const WHT = 0.15;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const SECTIONS = [
  { id: "home", icon: IconSmartHome, label: "หน้าหลัก" },
  { id: "portfolio", icon: IconChartBar, label: "พอร์ตโฟลิโอ" },
  { id: "tax", icon: IconWallet, label: "ภาษี" },
] as const;

// Reworked home — full-viewport scroll-snap sections with a sticky brand (top
// left), LINE avatar (top right), and a left anchor-nav rail whose active icon
// tracks the section in view. Figma node 846:2596.
export default function HomeRework({ profile, onLogout }: { profile: AuthProfile; onLogout?: () => void }) {
  const { months, loading } = useTimeline();
  const { docs } = useTaxCredits();
  const matched = useMemo(() => matchConfirmedPayouts(months, docs), [months, docs]);

  const forceSkeleton = new URLSearchParams(window.location.search).has("skeleton");
  const showSkeleton = loading || forceSkeleton;

  // Navigate the whole continuous timeline (every month, chronological), not
  // just months with coupons — so the current month is always selectable (even
  // when it pays nothing) and the tab can still page to the final installment.
  // Empty months simply read as 0 ใบ / dotted.
  const payoutMonths = months;

  // Index of the current month in payoutMonths — exact if it pays a coupon,
  // else the nearest upcoming payout month. Drives the default tab and the
  // "back to current month" button.
  const currentIdx = useMemo(() => {
    const now = new Date();
    const beYear = now.getFullYear() + 543;
    const mIdx = now.getMonth();
    const exact = payoutMonths.findIndex((m) => Number(m.year) === beYear && THAI_MONTHS.indexOf(m.month) === mIdx);
    if (exact >= 0) return exact;
    const upcoming = payoutMonths.findIndex((m) => {
      const y = Number(m.year);
      const mi = THAI_MONTHS.indexOf(m.month);
      return y > beYear || (y === beYear && mi >= mIdx);
    });
    return upcoming >= 0 ? upcoming : 0;
  }, [payoutMonths]);

  const [monthIdx, setMonthIdx] = useState(0);
  // Start on the current month. Runs once, when the payout months first arrive.
  const didInitMonth = useRef(false);
  useEffect(() => {
    if (didInitMonth.current || !payoutMonths.length) return;
    didInitMonth.current = true;
    setMonthIdx(currentIdx);
  }, [payoutMonths, currentIdx]);
  // Slip id focused by hovering its row in the folder list — drives the stack.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Avatar hover card (name + logout).
  const [userOpen, setUserOpen] = useState(false);
  // Title card art swaps mascot → LINE add-friend QR while hovered.
  const [showQr, setShowQr] = useState(false);
  const month = payoutMonths[Math.min(monthIdx, Math.max(0, payoutMonths.length - 1))];

  const { folderSlips, certSlips, totalInterest, monthLabel } = useMemo(() => {
    if (!month) return { folderSlips: [] as FolderSlip[], certSlips: [] as SlipPaperData[], totalInterest: 0, monthLabel: "" };
    const folder: FolderSlip[] = [];
    const certs: SlipPaperData[] = [];
    let total = 0;
    // Only slips still TO COLLECT (unconfirmed) drive the card — the folder
    // list, status pips, ดอกเบี้ยรวม and ภาษีที่จะสะสมได้ all reflect this same
    // set, matching the slip stack. A confirmed slip is collected → it drops
    // out of every count, so a fully-collected month reads as 0 / empty.
    for (const p of month.payouts) {
      if (matched.has(p.id)) continue;
      const wht = Math.round(p.amount * WHT);
      total += p.amount;
      folder.push({ id: p.id, symbol: p.symbol, issuer: p.issuer, installment: p.installment, confirmed: false, amount: p.amount });
      certs.push({ id: p.id, symbol: p.symbol, issuer: p.issuer, installment: p.installment, wht, net: p.amount - wht });
    }
    return { folderSlips: folder, certSlips: certs, totalInterest: total, monthLabel: `${month.month} ${month.year}` };
  }, [month, matched]);

  // For an empty month — the nearest FUTURE month that still has a slip to
  // collect, so the folder can point the user at what's coming next.
  const nextPayout = useMemo(() => {
    for (let j = monthIdx + 1; j < payoutMonths.length; j++) {
      const m = payoutMonths[j];
      const pending = m.payouts.filter((p) => !matched.has(p.id));
      if (pending.length) {
        const p = pending[0];
        return {
          idx: j,
          monthLabel: `${m.month} ${m.year}`,
          symbol: p.symbol,
          issuer: p.issuer,
          payoutDate: p.payoutDate,
          amount: p.amount,
          count: pending.length,
        };
      }
    }
    return null;
  }, [payoutMonths, monthIdx, matched]);

  // Anchor-nav active section via IntersectionObserver on the scroll wrapper.
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const els = SECTIONS.map((s) => root.querySelector(`#sec-${s.id}`)).filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = SECTIONS.findIndex((s) => `sec-${s.id}` === e.target.id);
            if (i >= 0) setActive(i);
          }
        }
      },
      { root, threshold: 0.55 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    scrollRef.current?.querySelector(`#sec-${id}`)?.scrollIntoView({ behavior: "smooth" });
  };

  if (showSkeleton) return <HomeReworkSkeleton profile={profile} />;

  return (
    <div ref={scrollRef} className="relative h-dvh overflow-y-auto bg-surface font-kanit">
      {/* Sticky brand — top left. Wordmark is the real asset, tinted navy via
          its --fill-0 CSS var (defaults to white in the SVG). */}
      <div className="pointer-events-none fixed top-8 left-10 z-30 flex items-center gap-2">
        <div className="leading-tight text-[#43507F]">
          <span
            className="block h-4 w-auto [&_svg]:h-full [&_svg]:w-auto"
            style={{ ["--fill-0" as string]: "#43507F" }}
            aria-label="beond"
            dangerouslySetInnerHTML={{ __html: wordmark }}
          />
          <p className="mt-0.5 text-[10px] font-medium text-[#43507F]/60">Bring Your Bonds Beyond</p>
        </div>
      </div>

      {/* User pill — top right. Collapsed = just the avatar; hovering expands
          the pill leftward to reveal [avatar, username, logout] in one row. */}
      <div
        className="fixed top-8 right-10 z-30"
        onMouseEnter={() => setUserOpen(true)}
        onMouseLeave={() => setUserOpen(false)}
      >
        <div className="flex items-center rounded-full border border-black/10 bg-white p-1.5 shadow-sm">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt={profile.displayName ?? "profile"} className="size-11 shrink-0 cursor-pointer rounded-full border border-black/10 object-cover" />
          ) : (
            <div className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-[#43507F]/10 text-lg font-bold text-[#43507F]">
              {(profile.displayName ?? "?").slice(0, 1)}
            </div>
          )}
          <AnimatePresence initial={false}>
            {userOpen && (
              <motion.div
                key="user-expand"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{
                  width: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.22, ease: "easeOut" },
                }}
                className="overflow-hidden"
              >
                {/* Spacing lives INSIDE the clipped segment so the collapsed
                    pill has no leftover gap to jump from. */}
                <div className="flex items-center gap-3 whitespace-nowrap pl-3 pr-1">
                  <span className="truncate text-sm font-medium text-ink">{profile.displayName ?? "ผู้ใช้"}</span>
                  <button
                    onClick={onLogout}
                    aria-label="ออกจากระบบ"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D64545]/10 text-[#D64545] transition-colors hover:bg-[#D64545]/20"
                  >
                    <IconLogout size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Left anchor nav */}
      <nav className="fixed top-1/2 left-10 z-30 flex -translate-y-1/2 flex-col items-center gap-6 rounded-full border border-black/10 bg-white px-4 py-8">
        {SECTIONS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              aria-label={s.label}
              aria-current={on}
              className={`flex size-14 items-center justify-center rounded-full transition-colors ${
                on ? "bg-[#43507F] text-white" : "bg-[#43507F]/10 text-[#43507F]/60 hover:bg-[#43507F]/20"
              }`}
            >
              <s.icon size={24} />
            </button>
          );
        })}
      </nav>

      {/* Section: หน้าหลัก */}
      <section id="sec-home" className="flex min-h-dvh items-center px-6 lg:pl-40 lg:pr-24">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            {/* Title card — white rounded panel with a mascot poking out the
                top-right. Figma node 904:2780. */}
            <div
              className="relative flex w-full max-w-[451px] flex-col items-start gap-2 rounded-3xl bg-white p-4"
              onMouseEnter={() => setShowQr(true)}
              onMouseLeave={() => setShowQr(false)}
            >
              <p className="self-stretch text-base font-medium leading-6 text-ink">
                สแกนใบสลิปดอกเบี้ยหุ้นกู้ผ่าน LINE OA
              </p>
              <p className="self-stretch text-base leading-6 text-ink/60">แอดเพื่อน @beond</p>
              {/* Mascot ⇄ LINE QR — rises up from below on each swap. */}
              <div className="pointer-events-none absolute right-4 bottom-0 z-10 h-[124px] w-[88px] overflow-hidden">
                <AnimatePresence initial={false}>
                  <motion.img
                    key={showQr ? "qr" : "mascot"}
                    src={showQr ? lineQr : mascot}
                    alt=""
                    aria-hidden
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{ y: { type: "spring", stiffness: 220, damping: 26 }, opacity: { duration: 0.25 } }}
                    className={`absolute inset-0 h-full w-full object-contain ${showQr ? "object-center" : "object-bottom"}`}
                  />
                </AnimatePresence>
              </div>
            </div>
            <MonthFolderCard
              monthLabel={monthLabel}
              totalInterest={totalInterest}
              slips={folderSlips}
              onPrev={() => setMonthIdx((i) => (i - 1 + payoutMonths.length) % payoutMonths.length)}
              onNext={() => setMonthIdx((i) => (i + 1) % payoutMonths.length)}
              onCurrent={() => setMonthIdx(currentIdx)}
              isCurrent={monthIdx === currentIdx}
              nextPayout={nextPayout}
              onGoNext={() => nextPayout && setMonthIdx(nextPayout.idx)}
              onRowHover={setFocusId}
            />
          </div>

          <div className="flex justify-center lg:translate-x-24 lg:translate-y-10">
            <BondScanStack key={monthLabel} slips={certSlips} focusId={focusId} />
          </div>
        </div>
      </section>

      {/* Section: พอร์ตโฟลิโอ */}
      <section id="sec-portfolio" className="flex min-h-dvh items-center justify-center px-6 py-16 lg:pl-40 lg:pr-24">
        <PortfolioSection />
      </section>

      {/* Section: ภาษี (placeholder) */}
      <section id="sec-tax" className="flex min-h-dvh items-center justify-center px-6 lg:pl-40">
        <p className="text-sm text-ink/40">ภาษี — เร็วๆ นี้</p>
      </section>
    </div>
  );
}
