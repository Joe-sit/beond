import PortfolioSummaryCard from "./PortfolioSummaryCard";
import ScanSlipCard from "./ScanSlipCard";
import AllocationCard from "./AllocationCard";
import EmptyPortfolioCard from "./EmptyPortfolioCard";
import { useHoldings } from "../hooks/usePortfolio";

export default function PortfolioOverview() {
  const { holdings, loading } = useHoldings();
  const isEmpty = !loading && holdings.length === 0;

  return (
    <div className="flex min-h-full flex-col gap-4">
      {isEmpty ? (
        <EmptyPortfolioCard />
      ) : (
        <>
          <PortfolioSummaryCard />
          <ScanSlipCard />
          <div className="min-h-110 flex-1">
            <AllocationCard />
          </div>
        </>
      )}
    </div>
  );
}
