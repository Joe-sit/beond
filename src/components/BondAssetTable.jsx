import { mockPortfolioData, sectorMeta } from "../data/mockData";

function formatTHB(value) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function MicroLogo({ company }) {
  const initial = company.trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
      {initial}
    </div>
  );
}

const RATING_STYLES = {
  AAA: "bg-emerald-50 text-emerald-700",
  "AA-": "bg-emerald-50 text-emerald-700",
  "A+": "bg-blue-50 text-blue-700",
  A: "bg-blue-50 text-blue-700",
  "A-": "bg-blue-50 text-blue-700",
  "BBB+": "bg-amber-50 text-amber-700",
};

export default function BondAssetTable() {
  return (
    <div className="max-h-80 overflow-auto rounded-2xl border border-gray-100">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
          <tr className="whitespace-nowrap text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3 text-right">Coupon</th>
            <th className="px-4 py-3 text-right">Principal</th>
            <th className="px-4 py-3">Next Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {mockPortfolioData.map((bond) => (
            <tr key={bond.symbol} className="hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <a href={`#${bond.symbol}`} className="font-semibold text-blue-700 hover:underline">
                  {bond.symbol}
                </a>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <MicroLogo company={bond.company} />
                  <span className="text-gray-700">{bond.company}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    RATING_STYLES[bond.rating] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {bond.rating}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{bond.couponRate.toFixed(1)}%</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                ฿{formatTHB(bond.principal)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-500">{bond.nextDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
