import { useEffect, useState } from "react";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import DashboardSkeleton from "./components/DashboardSkeleton";
import SidebarRail from "./components/home/SidebarRail";
import HomeRework from "./components/home2/HomeRework";
import HomeDashboard from "./components/home2/HomeDashboard";
import MailboxFly from "./components/home2/MailboxFly";
import CubePOC from "./components/home2/CubePOC";
import HeroStairs3D from "./components/home2/HeroStairs3D";
import TaxStoryPOC from "./components/home2/TaxStoryPOC";
import IntroPOC from "./components/home2/IntroPOC";
import SlipCollectPOC from "./components/home2/SlipCollectPOC";
import JarPOC from "./components/home2/JarPOC";
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
  // True when this page load is a return from the LINE OAuth redirect (fresh
  // ?code/?state or a bundled liff.state). While this is set we keep showing the
  // Home skeleton instead of bouncing to the landing page, and give the session
  // exchange a few retries — isLoggedIn() can lag a tick right after liff.init().
  const [returningFromLine] = useState(
    () => /[?&](code|state|liff\.state)=/.test(window.location.search),
  );

  const closeReview = () => {
    setReviewId(null);
    const url = new URL(window.location.href);
    ["review", "liff.state"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };

  useEffect(() => {
    let cancelled = false;
    const resolveAuth = async (attempt = 0): Promise<void> => {
      const p = await initAuth().catch((err) => {
        console.error("LIFF init failed:", err);
        return null;
      });
      if (cancelled) return;
      if (p) {
        setProfile(p);
        // liff.init() (inside initAuth) unpacks liff.state → the review param may
        // only be readable now; keep an already-resolved id.
        setReviewId((cur) => cur ?? readReviewId());
        setReady(true);
        return;
      }
      // Just came back from LINE but the session isn't ready yet → retry a few
      // times (staying on the skeleton) before falling back to the landing page.
      if (returningFromLine && attempt < 3) {
        setTimeout(() => resolveAuth(attempt + 1), 600);
        return;
      }
      setReady(true);
    };
    resolveAuth();
    return () => {
      cancelled = true;
    };
  }, [returningFromLine]);

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

  // `?anim` — motion prototype playground (flying-paper mailbox).
  if (new URLSearchParams(window.location.search).has("anim")) {
    return <MailboxFly />;
  }

  // `?cube` — interactive 3D-cuboid tuner (orbit + dimension sliders).
  if (new URLSearchParams(window.location.search).has("cube")) {
    return <CubePOC />;
  }

  // `?stairs` — 3D staircase/podium tuner (rebuild of the flat hero-stairs SVG).
  if (new URLSearchParams(window.location.search).has("stairs")) {
    return <HeroStairs3D />;
  }

  // `?tax` — preview the tax story chapter (3D bracket staircase + refund gauge).
  if (new URLSearchParams(window.location.search).has("tax")) {
    return <TaxStoryPOC />;
  }

  // `?intro` — debug the goal-chapter opener (staircase + slip + text) in a
  // panel that mirrors the real right column.
  if (new URLSearchParams(window.location.search).has("intro")) {
    return <IntroPOC />;
  }

  // `?collect` — debug the LINE-confirm "slip collected into folder" notification.
  if (new URLSearchParams(window.location.search).has("collect")) {
    return <SlipCollectPOC />;
  }

  // `?jar` — tune the 3D glass money jar.
  if (new URLSearchParams(window.location.search).has("jar")) {
    return <JarPOC />;
  }

  // `?v2` — preview the reworked full-viewport home (works pre-auth with a
  // placeholder profile). It owns its own loading skeleton, so this must come
  // before the shared skeleton gate below.
  if (new URLSearchParams(window.location.search).has("v2")) {
    // v2 renders regardless of profile, so setProfile(null) alone wouldn't leave
    // the page — clear the session then hard-navigate to the landing/login route.
    const v2Logout = async () => {
      await logout();
      window.location.assign("/");
    };
    if (new URLSearchParams(window.location.search).has("old")) {
      return <HomeRework profile={profile ?? { displayName: "beond" }} onLogout={v2Logout} />;
    }
    return <HomeDashboard profile={profile ?? { displayName: "beond" }} onLogout={v2Logout} />;
  }

  // `?skeleton` — preview the old dashboard loading skeleton without auth.
  if (new URLSearchParams(window.location.search).has("skeleton")) {
    return (
      <>
        <SidebarRail view="home" onSelect={() => {}} />
        <DashboardSkeleton railSpace />
      </>
    );
  }

  // Auth still resolving — show the real home dashboard with a placeholder
  // profile so its own loading skeletons fill in (no stale/old layout flash).
  if (!ready) {
    return <HomeDashboard profile={{ displayName: "beond" }} onLogout={() => {}} />;
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
      <HomeDashboard profile={profile} onLogout={handleLogout} />
      {reviewId && (
        <ScanFlow
          open
          reviewDocId={reviewId}
          onClose={closeReview}
          onSubmit={() => notifyPortfolioChanged()}
        />
      )}
    </>
  );
}

export default App;
