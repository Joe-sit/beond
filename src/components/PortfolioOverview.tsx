import PortfolioSummaryCard from "./PortfolioSummaryCard";
import ScanSlipCard from "./ScanSlipCard";
import AllocationCard from "./AllocationCard";
import EmptyPortfolioCard from "./EmptyPortfolioCard";
import { useHoldings } from "../hooks/usePortfolio";

export default function PortfolioOverview() {
  const { holdings, loading } = useHoldings();
  const isEmpty = !loading && holdings.length === 0;

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {isEmpty ? (
        <EmptyPortfolioCard />
      ) : (
        <>
          <PortfolioSummaryCard />
          <ScanSlipCard />
          {/* < lg the card needs its own height (parent grows with content) */}
          <div className="min-h-120 lg:min-h-0 lg:flex-1">
            <AllocationCard />
          </div>
        </>
      )}
    </div>
  );
}
