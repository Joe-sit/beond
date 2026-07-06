import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, Button } from "@heroui/react";
import { IconCalendarDollar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTimeline, currentTaxYearBE } from "../hooks/usePortfolio";
import InterestBarChart from "./InterestBarChart";
import AddBondModal from "./AddBondModal";
import TicketPlusIcon from "./icons/TicketPlusIcon";

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

export default function DividendTimeline() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [addOpen, setAddOpen] = useState(false);
  const { months: timeline, refetch } = useTimeline();
  const hasAny = timeline.some((m) => m.payouts.length > 0);

  // The chart shows one year at a time; ◀ ▶ steps between the years that have data.
  const years = useMemo(
    () => [...new Set(timeline.map((m) => m.year))].sort(),
    [timeline],
  );
  const [year, setYear] = useState<string | null>(null);
  useEffect(() => {
    if (year || !years.length) return;
    const cur = String(currentTaxYearBE());
    const withPayout = years.filter((y) =>
      timeline.some((m) => m.year === y && m.payouts.length > 0),
    );
    setYear(years.includes(cur) ? cur : withPayout[0] ?? years[0]);
  }, [years, year, timeline]);

  const activeYear = year && years.includes(year) ? year : years[0] ?? "";
  const yearIdx = years.indexOf(activeYear);
  const monthsOfYear = timeline.filter((m) => m.year === activeYear);
  const months =
    filter === "all" ? monthsOfYear : monthsOfYear.filter((m) => m.payouts.length > 0);

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
          <h2 className="text-base font-bold text-[#43507F]">ไทม์ไลน์การได้รับดอกเบี้ย</h2>
          {hasAny && <FilterToggle value={filter} onChange={setFilter} />}
        </div>
      </div>

      {hasAny ? (
        <div className="mt-1">
          <div className="relative">
            <InterestBarChart months={months} />
            <button
              type="button"
              disabled={yearIdx <= 0}
              onClick={() => setYear(years[yearIdx - 1])}
              aria-label="ปีก่อนหน้า"
              className="absolute top-1/2 left-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#43507F] shadow-md transition enabled:hover:bg-[#43507F]/5 disabled:opacity-0"
            >
              <IconChevronLeft size={18} />
            </button>
            <button
              type="button"
              disabled={yearIdx >= years.length - 1}
              onClick={() => setYear(years[yearIdx + 1])}
              aria-label="ปีถัดไป"
              className="absolute top-1/2 right-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#43507F] shadow-md transition enabled:hover:bg-[#43507F]/5 disabled:opacity-0"
            >
              <IconChevronRight size={18} />
            </button>
          </div>

          {/* Year label + dot indicator */}
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <span className="font-nunito text-xs font-bold text-[#43507F]">{activeYear}</span>
            {years.length > 1 && (
              <div className="flex items-center gap-1.5">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    aria-label={`ปี ${y}`}
                    className={`h-1.5 rounded-full transition-all ${
                      y === activeYear ? "w-4 bg-[#43507F]" : "w-1.5 bg-black/15 hover:bg-black/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
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
          <Button variant="primary" onPress={() => setAddOpen(true)}>
            <TicketPlusIcon size={20} />
            เพิ่มหุ้นกู้
          </Button>
        </div>
      )}

      <AddBondModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refetch} />
    </div>
  );
}
