import { mockPortfolioData, sectorMeta } from "../data/mockData";

function buildSectorSummary() {
  const bySector = {};
  let total = 0;
  for (const bond of mockPortfolioData) {
    bySector[bond.sector] = (bySector[bond.sector] || 0) + bond.principal;
    total += bond.principal;
  }
  return Object.entries(bySector)
    .map(([sector, value]) => ({ sector, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

export default function SectorLegend() {
  const summary = buildSectorSummary();

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {summary.map(({ sector, pct }) => {
        const meta = sectorMeta[sector] ?? { icon: "•", color: "#94a3b8" };
        return (
          <li key={sector} className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
              style={{ backgroundColor: `${meta.color}20` }}
            >
              {meta.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-gray-700">{sector}</span>
            <span className="font-semibold text-gray-900">{pct.toFixed(0)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
