import { useEffect, useState } from "react";
import { Toast } from "@heroui/react";
import DashboardLayout from "./components/DashboardLayout";
import BrandHeader from "./components/BrandHeader";
import PortfolioHeader from "./components/PortfolioHeader";
import DividendTimeline from "./components/DividendTimeline";
import RightPanel from "./components/RightPanel";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import DashboardSkeleton from "./components/DashboardSkeleton";
import ScanFlow from "./components/ScanFlow";
import { notifyPortfolioChanged } from "./hooks/usePortfolio";
import { initAuth, login, logout, liffEnabled, type AuthProfile } from "./lib/auth";

// Resolve the LINE "แก้ไข" deep link (?review=<taxDocId>). In the LINE in-app
// browser LIFF forwards the original query bundled into `liff.state`, which the
// SDK only unpacks after liff.init() runs — so read the plain param first, then
// fall back to liff.state.
function readReviewId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get("review");
  if (direct) return direct;
  const state = params.get("liff.state");
  if (state) {
    const inner = new URLSearchParams(state.startsWith("?") ? state.slice(1) : state);
    return inner.get("review");
  }
  return null;
}

function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [ready, setReady] = useState(false);
  // Deep link → open the OCR review screen for that saved slip. Cleared when the
  // sheet closes.
  const [reviewId, setReviewId] = useState<string | null>(() => readReviewId());

  const closeReview = () => {
    setReviewId(null);
    const url = new URL(window.location.href);
    ["review", "liff.state"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };

  useEffect(() => {
    initAuth()
      .then((p) => {
        setProfile(p);
        // liff.init() (inside initAuth) unpacks liff.state → the review param may
        // only be readable now; keep an already-resolved id.
        setReviewId((cur) => cur ?? readReviewId());
      })
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
    return <DashboardSkeleton />;
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
      {reviewId && (
        <ScanFlow
          open
          reviewDocId={reviewId}
          onClose={closeReview}
          onSubmit={() => notifyPortfolioChanged()}
        />
      )}
      <Toast.Provider placement="bottom end" />
    </>
  );
}

export default App;
