import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
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
import TaxIdSheetPOC from "./components/home2/TaxIdSheetPOC";
import OnboardingPOC from "./components/home2/OnboardingPOC";
import LandingPage from "./components/landing/LandingPage";
import PrivacyPolicy from "./components/PrivacyPolicy";
import Learn from "./components/Learn";
import CookieConsent from "./components/CookieConsent";
import HeroScreen3DPOC from "./components/landing/HeroScreen3DPOC";
import LineChatPOC from "./components/landing/line/LineChatPOC";
import LoginPage from "./components/LoginPage";
import ScanFlow from "./components/ScanFlow";
import { notifyPortfolioChanged } from "./hooks/usePortfolio";
import { initAuth, login, logout, liffEnabled, watchSession, type AuthProfile } from "./lib/auth";

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

/**
 * True when this browser already holds a Supabase session. supabase-js keeps it
 * in localStorage under `sb-<project-ref>-auth-token`, so its presence tells us
 * — before auth finishes resolving — whether this visitor is a returning user.
 * Used only to pick the right placeholder while `initAuth()` runs.
 */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Private mode / storage blocked → treat as a fresh visitor.
  }
  return false;
}

function App() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [ready, setReady] = useState(false);
  // Set when a live session expires mid-use (silent re-auth failed) → we drop to
  // the login page and show a banner instead of silently going stale.
  const [sessionExpired, setSessionExpired] = useState(false);
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

  // Live session watchdog: if the session dies while the app is open (and can't
  // be silently refreshed), drop the profile so the UI reacts immediately
  // instead of waiting for the next reload.
  useEffect(() => {
    const stop = watchSession(() => {
      // Toast first (dashboard still mounted → its Toast.Provider is alive), then
      // drop to the login page a beat later so the message is actually seen.
      toast.danger("เซสชันหมดอายุ กำลังพากลับไปเข้าสู่ระบบ…");
      setSessionExpired(true);
      setTimeout(() => setProfile(null), 2500);
    });
    return stop;
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

  // Public policy page. Ahead of every auth gate: the Chrome Web Store reviewer
  // and anyone deciding whether to sign up must be able to read it logged out.
  if (window.location.pathname.startsWith("/privacy")) {
    return <PrivacyPolicy />;
  }

  // Public tax guides. Also the only substantial thing a crawler can read, the
  // rest of the app being behind a LINE login.
  if (window.location.pathname.startsWith("/learn")) {
    return <Learn />;
  }

  // Prototype / tuner routes — DEV builds only, so production can't reach the
  // POC screens or the ack-reset debug tools by guessing a query string.
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(window.location.search);

    // `?anim` — motion prototype playground (flying-paper mailbox).
    if (q.has("anim")) return <MailboxFly />;
    // `?cube` — interactive 3D-cuboid tuner (orbit + dimension sliders).
    if (q.has("cube")) return <CubePOC />;
    // `?stairs` — 3D staircase/podium tuner (rebuild of the flat hero-stairs SVG).
    if (q.has("stairs")) return <HeroStairs3D />;
    // `?tax` — preview the tax story chapter (3D bracket staircase + refund gauge).
    if (q.has("tax")) return <TaxStoryPOC />;
    // `?intro` — debug the goal-chapter opener in a panel mirroring the real column.
    if (q.has("intro")) return <IntroPOC />;
    // `?collect` — debug the LINE-confirm "slip collected into folder" notification.
    if (q.has("collect")) return <SlipCollectPOC />;
    // `?jar` — tune the 3D glass money jar.
    if (q.has("jar")) return <JarPOC />;
    // `?sheet` — tune the payer-tax-id mismatch bottom sheet without a scan.
    if (q.has("sheet")) return <TaxIdSheetPOC />;
    // `?onboard` — step through the first-run walkthrough without an empty account.
    if (q.has("onboard")) return <OnboardingPOC />;
    // `?hero3d` — slider tuner for the landing hero's 3D window.
    if (q.has("hero3d")) return <HeroScreen3DPOC />;
    // `?line` — the LINE chat screen shown inside the landing hero's device.
    if (q.has("line")) return <LineChatPOC />;
    // `?old-landing` — the previous marketing page, kept for comparison.
    if (q.has("old-landing")) return <LoginPage onLogin={handleLogin} />;

    // `?v2` — preview the reworked full-viewport home (works pre-auth with a
    // placeholder profile).
    if (q.has("v2")) {
      const v2Logout = async () => {
        await logout();
        window.location.assign("/");
      };
      if (q.has("old")) {
        return <HomeRework profile={profile ?? { displayName: "beond" }} onLogout={v2Logout} />;
      }
      return <HomeDashboard profile={profile ?? { displayName: "beond" }} onLogout={v2Logout} />;
    }

    // `?skeleton` — preview the old dashboard loading skeleton without auth.
    if (q.has("skeleton")) {
      return (
        <>
          <SidebarRail view="home" onSelect={() => {}} />
          <DashboardSkeleton railSpace />
        </>
      );
    }
  }

  // Auth still resolving. A returning visitor (or one coming back from the LINE
  // redirect) gets the dashboard so its own skeletons fill in; everyone else
  // gets the landing page, which is where they are about to land anyway —
  // otherwise a hard refresh flashes a dashboard at a logged-out visitor.
  if (!ready) {
    if (returningFromLine || hasStoredSession()) {
      return <HomeDashboard profile={{ displayName: "beond" }} onLogout={() => {}} />;
    }
    return <LandingPage onLogin={handleLogin} />;
  }

  if (!profile) {
    return (
      <LandingPage
        onLogin={handleLogin}
        notice={sessionExpired ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" : undefined}
      />
    );
  }

  // Internal ops route — same login gate (needs a session token for the health
  // edge fn), but a separate full-screen view instead of the user dashboard.
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  return (
    <>
      <HomeDashboard profile={profile} onLogout={handleLogout} />
      {/* PDPA: asked once, and only when an ad network is configured. */}
      <CookieConsent />
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
