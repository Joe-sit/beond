import { useEffect, useState } from "react";
import { Toast } from "@heroui/react";
import DashboardLayout from "./components/DashboardLayout";
import BrandHeader from "./components/BrandHeader";
import PortfolioHeader from "./components/PortfolioHeader";
import DividendTimeline from "./components/DividendTimeline";
import RightPanel from "./components/RightPanel";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
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
      <div className="flex h-screen flex-col gap-4 bg-[#F6F4F1] p-6">
        <div className="h-14 w-full animate-pulse rounded-2xl bg-black/5" />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="animate-pulse rounded-3xl bg-black/5" />
          <div className="flex flex-col gap-4">
            <div className="h-32 animate-pulse rounded-3xl bg-black/5" />
            <div className="flex-1 animate-pulse rounded-3xl bg-black/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Internal ops route — same login gate (needs a session token for the health
  // edge fn), but a separate full-screen view instead of the user dashboard.
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  return (
    <>
      <DashboardLayout
        hero={
          <>
            <BrandHeader profile={profile} onLogout={handleLogout} />
            <PortfolioHeader />
            <DividendTimeline />
          </>
        }
        panel={<RightPanel profile={profile} onLogout={handleLogout} />}
      />
      <Toast.Provider placement="bottom end" />
    </>
  );
}

export default App;
