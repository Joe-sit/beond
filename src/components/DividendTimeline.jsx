import { Banknote } from "lucide-react";
import { mockTimelineData } from "../data/mockData";

function formatTHB(value) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function IssuerLogo({ label, className = "" }) {
  const initial = label.trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white ${className}`}
    >
      {initial}
    </div>
  );
}

function StandardPayoutCard({ data }) {
  const payout = data.payouts[0];
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <IssuerLogo label={payout.issuer} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{payout.issuer}</p>
          <p className="text-xs text-gray-500">{payout.symbol} {payout.rate}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-gray-400">{payout.payoutDate}</p>
        <p className="text-lg font-bold text-gray-900">฿{formatTHB(payout.amount)}</p>
      </div>
    </div>
  );
}

function MultiPayoutCard({ data }) {
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {data.payouts.map((p) => (
        <div key={p.issuer} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <IssuerLogo label={p.issuer} className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-medium text-gray-700">{p.issuer}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">฿{formatTHB(p.amount)}</p>
            <p className="text-[11px] text-gray-400">{p.etaText}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClusteredPayoutCard({ data }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap gap-2">
        {data.issuers.map((ticker) => (
          <span
            key={ticker}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
          >
            {ticker}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExpandedPayoutCard({ data }) {
  if (data.isClustered) return <ClusteredPayoutCard data={data} />;
  if (data.payouts.length > 1) return <MultiPayoutCard data={data} />;
  return <StandardPayoutCard data={data} />;
}

function MonthLabel({ month, year }) {
  return (
    <div className="leading-tight">
      <p className="text-sm font-bold text-[#1e3a5f]">{month}</p>
      <p className="text-xs text-gray-400">{year}</p>
    </div>
  );
}

export default function DividendTimeline() {
  return (
    <div className="px-6 pb-10 md:px-10">
      <h2 className="text-lg font-bold text-[#1e3a5f]">ไทม์ไลน์การได้รับดอกเบี้ย</h2>

      <div className="mt-6 space-y-6">
        {mockTimelineData.map((entry) => {
          const [month, year] = entry.month.split(" ");
          return (
            <div key={entry.month} className="flex items-start gap-4">
              <div className="flex w-32 shrink-0 flex-col gap-3">
                <MonthLabel month={month} year={year} />
                {entry.isPayout && (
                  <div className="relative border-l-2 border-gray-100 pl-3">
                    <span className="absolute top-1 -left-[7px] h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Banknote size={14} className="text-emerald-500" />
                      <span>ดอกเบี้ยทั้งหมด</span>
                    </div>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      ฿{formatTHB(entry.totalAmount)}
                    </p>
                  </div>
                )}
                {!entry.isPayout && (
                  <span className="mt-1 h-2 w-2 rounded-full bg-gray-300" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-6">
                {entry.isPayout && <ExpandedPayoutCard data={entry} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
