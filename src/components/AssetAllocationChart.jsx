import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { mockPortfolioData, sectorMeta, TOTAL_ASSET_COUNT } from "../data/mockData";

function buildSectorData() {
  const bySector = {};
  for (const bond of mockPortfolioData) {
    bySector[bond.sector] = (bySector[bond.sector] || 0) + bond.principal;
  }
  return Object.entries(bySector).map(([sector, value]) => ({
    sector,
    value,
    color: sectorMeta[sector]?.color ?? "#94a3b8",
  }));
}

export default function AssetAllocationChart() {
  const data = buildSectorData();

  return (
    <div className="relative mx-auto h-56 w-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="sector"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.sector} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs font-medium text-gray-500">สินทรัพย์หลัก</p>
        <p className="text-lg font-bold text-gray-900">{TOTAL_ASSET_COUNT} สินทรัพย์</p>
      </div>
    </div>
  );
}
