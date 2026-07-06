import { useEffect, useState } from "react";
import { Toast } from "@heroui/react";
import DashboardLayout from "./components/DashboardLayout";
import BrandHeader from "./components/BrandHeader";
import PortfolioHeader from "./components/PortfolioHeader";
import DividendTimeline from "./components/DividendTimeline";
import TaxCard from "./components/TaxCard";
import RightPanel from "./components/RightPanel";
import LoginPage from "./components/LoginPage";
import { initAuth, login, logout, liffEnabled, type AuthProfile } from "./lib/auth";

function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAuth()
      .then(setProfile)
      .catch((err) => console.error("LIFF init failed:", err))
      .finally(() => setReady(true));
  }, []);

  const handleLogout = () => {
    logout();
    setProfile(null);
  };

  const handleLogin = () => {
    login();
    if (!liffEnabled) {
      // Mock path resolves in place; LIFF redirects to LINE instead.
      setProfile({ displayName: "joeomlet_xd" });
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F6F4F1]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#43507F]/30 border-t-[#43507F]" />
      </div>
    );
  }

  if (!profile) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      <DashboardLayout
        hero={
          <>
            <BrandHeader profile={profile} onLogout={handleLogout} />
            <PortfolioHeader />
            <DividendTimeline />
            <TaxCard />
          </>
        }
        panel={<RightPanel profile={profile} onLogout={handleLogout} />}
      />
      <Toast.Provider placement="bottom end" />
    </>
  );
}

export default App;
