import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Chip } from "@heroui/react";
import { IconCalendarDollar } from "@tabler/icons-react";
import { type TimelineMonth, type TimelinePayout } from "../data/mockData";
import { useTimeline } from "../hooks/usePortfolio";
import AddBondModal from "./AddBondModal";
import IssuerLogo from "./IssuerLogo";
import { issuerName } from "../lib/issuerLogo";
import TicketPlusIcon from "./icons/TicketPlusIcon";
import banknote from "../assets/timeline-banknote.png";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

// Thai bond coupon interest is taxed 15% withholding at source; the timeline
// shows what actually lands in the account (net).
const WHT_RATE = 0.15;
function netAfterWht(gross: number): number {
  return Math.round(gross * (1 - WHT_RATE));
}

function formatShortTHB(value: number): string {
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

// Group the flat month list into per-year buckets (keeping each row's global
// index for the entrance-stagger + connector-line logic).
interface YearGroup {
  year: string;
  items: { entry: TimelineMonth; idx: number }[];
}
function groupByYear(months: TimelineMonth[]): YearGroup[] {
  const groups: YearGroup[] = [];
  months.forEach((entry, idx) => {
    const last = groups[groups.length - 1];
    if (last && last.year === entry.year) {
      last.items.push({ entry, idx });
    } else {
      groups.push({ year: entry.year, items: [{ entry, idx }] });
    }
  });
  return groups;
}

type FilterKey = "all" | "payout";

interface FilterToggleProps {
  value: FilterKey;
  onChange: (value: FilterKey) => void;
}

function FilterToggle({ value, onChange }: FilterToggleProps) {
  const options: { key: FilterKey; label: string }[] = [
    { key: "all", label: "ทุกเดือน" },
    { key: "payout", label: "เฉพาะเดือนที่ได้รับ" },
  ];
  return (
    <div className="flex items-center gap-2 text-sm">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Chip
            key={opt.key}
            role="button"
            tabIndex={0}
            onClick={() => onChange(opt.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(opt.key);
              }
            }}
            color={active ? "accent" : "default"}
            variant={active ? "primary" : "secondary"}
            className="cursor-pointer select-none transition-colors"
          >
            {opt.label}
          </Chip>
        );
      })}
    </div>
  );
}

function PayoutCard({ payout }: { payout: TimelinePayout }) {
  const completed = payout.completed;
  const company = issuerName(payout.symbol, payout.issuer);
  return (
    <div className={`relative h-19.25 min-w-0 ${completed ? "opacity-55" : ""}`}>
      <div className="absolute inset-x-0 top-0 flex h-19.25 items-center justify-between gap-3 rounded-2xl bg-white p-4">
        <div className="flex min-w-0 items-center gap-2">
          <IssuerLogo symbol={payout.symbol} name={company} size={40} />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-xs font-medium text-[#181D20]/80">
              {company}
            </p>
            <div className="flex items-center gap-1">
              <p className="font-nunito text-base font-bold text-[#181D20]">
                {payout.symbol}
              </p>
              {completed ? (
                <span className="rounded-xl bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                  ครบแล้ว
                </span>
              ) : (
                <span className="rounded-xl bg-black/5 px-2 py-1 text-xs text-[#181D20]/80">
                  งวดที่ <span className="font-nunito">{payout.installment}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-25 shrink-0 flex-col justify-center text-right">
          <p className="font-nunito text-base font-bold text-[#181D20]">
            ฿{formatTHB(netAfterWht(payout.amount))}
          </p>
          <p className="text-[10px] leading-tight text-black/40">หลังหักภาษี 15%</p>
        </div>
      </div>
    </div>
  );
}

// One payout shows as a plain card; several in a month collapse into a stack
// that fans out into the full list on hover with a staggered expand.
function PayoutStack({ payouts }: { payouts: TimelinePayout[] }) {
  const [open, setOpen] = useState(false);

  if (payouts.length <= 1) {
    return (
      <>
        {payouts.map((p) => (
          <PayoutCard key={p.id} payout={p} />
        ))}
      </>
    );
  }
  const rest = payouts.slice(1);

  return (
    <div
      className="flex flex-col"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Top card with peeks behind; peeks fade away as the stack expands. */}
      <div className="relative">
        <AnimatePresence>
          {!open && (
            <>
              <motion.div
                key="peek1"
                aria-hidden
                className="absolute inset-x-3 top-0 h-19.25 rounded-2xl bg-gray-300"
                initial={{ opacity: 0, y: 0, scale: 1 }}
                animate={{ opacity: 1, y: 11, scale: 0.955 }}
                exit={{ opacity: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
              <motion.div
                key="peek2"
                aria-hidden
                className="absolute inset-x-1.5 top-0 h-19.25 rounded-2xl bg-gray-200"
                initial={{ opacity: 0, y: 0, scale: 1 }}
                animate={{ opacity: 1, y: 5.5, scale: 0.978 }}
                exit={{ opacity: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </>
          )}
        </AnimatePresence>
        <motion.div className="relative" whileHover={{ scale: 1.006 }}>
          <PayoutCard payout={payouts[0]} />
        </motion.div>
      </div>

      {/* Remaining payouts slide out from under the stack: the height wrapper
          grows continuously (pushing the rows below), while the inner card
          eases down from the top card's position — so it reads as un-stacking. */}
      <AnimatePresence initial={false}>
        {open &&
          rest.map((p, i) => (
            <motion.div
              key={p.id}
              className="overflow-hidden"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
            >
              <motion.div
                className="pt-2"
                initial={{ y: -32, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -32, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
                whileHover={{ scale: 1.006 }}
              >
                <PayoutCard payout={p} />
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

function MonthRow({ entry, isLast }: { entry: TimelineMonth; isLast: boolean }) {
  const total = entry.payouts.reduce((sum, p) => sum + netAfterWht(p.amount), 0);
  const hasPayout = entry.payouts.length > 0;

  return (
    <div className="flex gap-6">
      {/* Month */}
      <div className="flex w-14 shrink-0 flex-col justify-center">
        <p className="text-center text-base font-bold text-[#43507F]">
          {entry.month}
        </p>
      </div>

      {/* Banknote icon + connector */}
      <div className="flex w-10 shrink-0 flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl">
          <img
            src={banknote}
            alt=""
            className={`h-6 w-9.5 ${hasPayout ? "" : "opacity-30 grayscale"}`}
          />
        </div>
        {!isLast && <span className="mt-1 w-px flex-1 bg-[#D9D9D9]" />}
      </div>

      {/* Total interest */}
      <div className="flex w-21 shrink-0 flex-col">
        <p className="text-sm font-medium text-[#43507F]/80">ได้รับสุทธิ</p>
        <p
          className={`text-2xl font-bold ${hasPayout ? "text-[#43507F]" : "text-[#43507F]/30"}`}
        >
          ฿<span className="font-nunito">{hasPayout ? formatShortTHB(total) : 0}</span>
        </p>
      </div>

      {/* Payout cards, or an empty note */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-4">
        {hasPayout ? (
          <PayoutStack payouts={entry.payouts} />
        ) : (
          <div className="flex h-19.25 items-center justify-center rounded-2xl border border-dashed border-[#43507F]/20">
            <p className="text-xs font-medium text-black/40">
              ไม่มีการจ่ายดอกเบี้ยในเดือนนี้
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DividendTimeline() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [addOpen, setAddOpen] = useState(false);
  const { months: timeline, refetch } = useTimeline();
  const hasAny = timeline.some((m) => m.payouts.length > 0);
  const months =
    filter === "all" ? timeline : timeline.filter((m) => m.payouts.length > 0);

  // Frost the title only once it's actually stuck (content scrolling under it),
  // not while it sits over the hero — a sentinel just above the header flags it.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="px-8 pb-12 md:px-12">
      <div ref={sentinelRef} className="h-0" aria-hidden />
      <div className="sticky top-0 z-30 -mx-8 px-8 pt-6 pb-3 md:-mx-12 md:px-12 md:pt-8">
        {/* Progressive blur: stacked layers, each masked so blur is strongest
            at the top and fades to none toward the bottom. Only fades in once
            the header is stuck, so it never frosts the hero illustration. */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-32 transition-opacity duration-300 ${
            stuck ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        >
          <div className="absolute inset-0 backdrop-blur-[2px] mask-[linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]" />
          <div className="absolute inset-0 backdrop-blur-md mask-[linear-gradient(to_bottom,black_0%,black_30%,transparent_75%)]" />
          <div className="absolute inset-0 backdrop-blur-lg mask-[linear-gradient(to_bottom,black_0%,transparent_45%)]" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#43507F]">ไทม์ไลน์การได้รับดอกเบี้ย</h2>
          {hasAny && <FilterToggle value={filter} onChange={setFilter} />}
        </div>
      </div>

      {hasAny ? (
        <motion.div key={filter} className="mt-4 flex flex-col">
          {groupByYear(months).map((group) => (
            <div key={group.year}>
              <div className="py-2">
                <span className="font-nunito text-lg font-bold text-[#43507F]">
                  {group.year}
                </span>
              </div>
              <div className="flex flex-col gap-4 pt-2 pb-2">
                {group.items.map(({ entry, idx }) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 1, 0.36, 1],
                      delay: Math.min(idx, 10) * 0.045,
                    }}
                  >
                    <MonthRow entry={entry} isLast={idx === months.length - 1} />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[#43507F]/20 bg-white/40 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#43507F]/5 text-[#43507F]">
            <IconCalendarDollar size={28} />
          </div>
          <div>
            <p className="text-base font-bold text-[#43507F]">ยังไม่มีข้อมูลการจ่ายดอกเบี้ย</p>
            <p className="mt-1 text-sm text-black/50">
              เพิ่มหุ้นกู้ที่คุณถือ เพื่อดูไทม์ไลน์การได้รับดอกเบี้ยรายเดือน
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-[14px] bg-[#43507F] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#525f92]"
          >
            <TicketPlusIcon size={20} />
            เพิ่มหุ้นกู้
          </button>
        </div>
      )}

      <AddBondModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={refetch}
      />
    </div>
  );
}
