import AssetAllocationChart from "./AssetAllocationChart";
import SectorLegend from "./SectorLegend";
import BondAssetTable from "./BondAssetTable";
import { TOTAL_ASSET_COUNT } from "../data/mockData";

export default function PortfolioOverview() {
  return (
    <div className="px-8 py-8 md:px-10">
      <h2 className="text-lg font-bold text-gray-900">พอร์ตโฟลิโอของฉัน</h2>
      <p className="mt-1 text-sm text-gray-500">สินทรัพย์หลัก {TOTAL_ASSET_COUNT} สินทรัพย์</p>

      <div className="mt-6">
        <AssetAllocationChart />
        <div className="mt-6">
          <SectorLegend />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">รายการตราสารหนี้</h3>
        <BondAssetTable />
      </div>
    </div>
  );
}
