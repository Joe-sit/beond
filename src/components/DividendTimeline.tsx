import { useState } from "react";
import { type TimelineMonth, type TimelinePayout } from "../data/mockData";
import { useTimeline } from "../hooks/usePortfolio";
import banknote from "../assets/timeline-banknote.png";
import originLogo from "../assets/origin-property-logo.svg";
import cardDecor from "../assets/timeline-card-decor.svg";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

function formatShortTHB(value: number): string {
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
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
    <div className="flex items-center gap-1 text-sm">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              active
                ? "bg-white font-semibold text-[#43507F] shadow-sm"
                : "font-medium text-gray-400 hover:text-gray-600"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function IssuerLogo({ payout }: { payout: TimelinePayout }) {
  if (payout.symbol.startsWith("ORI")) {
    return (
      <img
        src={originLogo}
        alt={payout.issuer}
        className="h-10 w-10 shrink-0 rounded-full bg-[#F0F3FA]"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F3FA] font-nunito text-sm font-bold text-[#43507F]">
      {payout.issuer.charAt(0)}
    </div>
  );
}

function PayoutCard({ payout }: { payout: TimelinePayout }) {
  return (
    <div className="relative h-21.75 min-w-0">
      {/* Decorative connector behind the card */}
      <img
        src={cardDecor}
        alt=""
        className="pointer-events-none absolute top-4.25 left-1.5 h-17.5 w-[calc(100%-11px)]"
      />
      <div className="absolute inset-x-0 top-0 flex h-19.25 items-center justify-between gap-3 rounded-2xl bg-white p-4 transition-shadow hover:shadow-md">
        <div className="flex min-w-0 items-center gap-2">
          <IssuerLogo payout={payout} />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-xs font-medium text-[#181D20]/80">
              {payout.issuer}
            </p>
            <div className="flex items-center gap-1">
              <p className="font-nunito text-base font-bold text-[#181D20]">
                {payout.symbol}
              </p>
              <span className="rounded-xl bg-black/5 px-2 py-1 text-xs text-[#181D20]/80">
                งวดที่ <span className="font-nunito">{payout.installment}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-25 shrink-0 flex-col text-right">
          <p className="font-nunito text-xs font-medium text-[#181D20]/80">
            {payout.payoutDate}
          </p>
          <p className="font-nunito text-base font-bold text-[#181D20]">
            ฿{formatTHB(payout.amount)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MonthRow({ entry, isLast }: { entry: TimelineMonth; isLast: boolean }) {
  const total = entry.payouts.reduce((sum, p) => sum + p.amount, 0);
  const hasPayout = entry.payouts.length > 0;

  return (
    <div className="flex gap-6">
      {/* Month + year */}
      <div className="flex w-14 shrink-0 flex-col">
        <p className="text-center text-base font-bold text-[#43507F]">
          {entry.month}
        </p>
        <p className="text-center font-nunito text-base font-medium text-[#43507F]/80">
          {entry.year}
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
        <p className="text-sm font-medium text-[#43507F]/80">ดอกเบี้ยรวม</p>
        <p
          className={`text-2xl font-bold ${hasPayout ? "text-[#43507F]" : "text-[#43507F]/30"}`}
        >
          ฿<span className="font-nunito">{hasPayout ? formatShortTHB(total) : 0}</span>
        </p>
      </div>

      {/* Payout cards, or an empty note */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-4">
        {hasPayout ? (
          entry.payouts.map((p) => <PayoutCard key={p.id} payout={p} />)
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
  const timeline = useTimeline();
  const months =
    filter === "all" ? timeline : timeline.filter((m) => m.payouts.length > 0);

  return (
    <div className="px-8 pb-12 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#43507F]">ไทม์ไลน์การได้รับดอกเบี้ย</h2>
        <FilterToggle value={filter} onChange={setFilter} />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {months.map((entry, idx) => (
          <MonthRow key={entry.id} entry={entry} isLast={idx === months.length - 1} />
        ))}
      </div>
    </div>
  );
}
