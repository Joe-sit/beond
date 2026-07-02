import { useState } from "react";
import { Banknote } from "lucide-react";
import { mockTimeline, type TimelineEntry } from "../data/mockData";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
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
                ? "bg-white font-semibold text-[#1e3a5f] shadow-sm"
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

function IssuerLogo({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#f2994a] to-[#1e3a5f] text-sm font-bold text-white">
      {initial}
    </div>
  );
}

function PayoutCard({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <IssuerLogo label={entry.issuer} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{entry.issuer}</p>
          <p className="text-xs text-gray-500">
            <span className="font-nunito font-semibold text-gray-700">{entry.symbol}</span>{" "}
            งวดที่ <span className="font-nunito">{entry.installment}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-nunito text-xs text-gray-400">{entry.payoutDate}</p>
        <p className="font-nunito text-lg font-bold text-gray-900">฿{formatTHB(entry.amount)}</p>
      </div>
    </div>
  );
}

export default function DividendTimeline() {
  const [filter, setFilter] = useState<FilterKey>("all");

  return (
    <div className="px-8 pb-12 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1e3a5f]">ไทม์ไลน์การได้รับดอกเบี้ย</h2>
        <FilterToggle value={filter} onChange={setFilter} />
      </div>

      <div className="mt-6 space-y-5">
        {mockTimeline.map((entry, idx) => (
          <div key={entry.id} className="flex items-start gap-4">
            <div className="relative flex w-28 shrink-0 flex-col">
              <p className="text-sm font-bold text-[#1e3a5f]">{entry.month}</p>
              <p className="font-nunito text-xs text-gray-500">{entry.year}</p>
              <div className="mt-3 flex items-center gap-2">
                <Banknote size={22} className="shrink-0 text-emerald-500" />
                <div className="leading-tight">
                  <p className="text-[11px] text-gray-500">ดอกเบี้ยรวม</p>
                  <p className="font-nunito text-lg font-bold text-[#1e3a5f]">฿{entry.total}</p>
                </div>
              </div>
              {idx < mockTimeline.length - 1 && (
                <span className="absolute left-2.5 top-18.5 h-[calc(100%-40px)] border-l-2 border-dashed border-gray-300" />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-6">
              <PayoutCard entry={entry} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
