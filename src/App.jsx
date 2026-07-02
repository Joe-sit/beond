import DashboardLayout from "./components/DashboardLayout";
import TopNav from "./components/TopNav";
import PortfolioHeader from "./components/PortfolioHeader";
import DividendTimeline from "./components/DividendTimeline";
import PortfolioOverview from "./components/PortfolioOverview";

function App() {
  return (
    <DashboardLayout
      hero={
        <>
          <TopNav />
          <PortfolioHeader />
          <DividendTimeline />
        </>
      }
      panel={<PortfolioOverview />}
    />
  );
}

export default App;
