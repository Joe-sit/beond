import DashboardLayout from "./components/DashboardLayout";
import BrandHeader from "./components/BrandHeader";
import PortfolioHeader from "./components/PortfolioHeader";
import DividendTimeline from "./components/DividendTimeline";
import PortfolioOverview from "./components/PortfolioOverview";

function App() {
  return (
    <DashboardLayout
      hero={
        <>
          <BrandHeader />
          <PortfolioHeader />
          <DividendTimeline />
        </>
      }
      panel={<PortfolioOverview />}
    />
  );
}

export default App;
