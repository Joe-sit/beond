import liff from "@line/liff";
import { supabase, supabaseEnabled } from "./supabase";

export interface AuthProfile {
  displayName: string;
  pictureUrl?: string;
}

const AUTH_KEY = "beond-logged-in";
const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const liffEnabled = Boolean(LIFF_ID);

// Exchange the LIFF id_token for a real Supabase session via the line-auth Edge
// Function, then redeem the returned magic-link token so every DB request is
// authenticated as this user (RLS scopes rows to them).
async function exchangeSupabaseSession(): Promise<AuthProfile | null> {
  if (!supabaseEnabled || !supabase || !SUPABASE_URL) return null;

  // Skip if a valid session is already persisted.
  const { data: current } = await supabase.auth.getSession();
  if (current.session) {
    const meta = current.session.user.user_metadata ?? {};
    if (liffEnabled) {
      const p = await liff.getProfile();
      return { displayName: p.displayName, pictureUrl: p.pictureUrl };
    }
    return { displayName: meta.name ?? "beond", pictureUrl: meta.picture };
  }

  const idToken = liff.getIDToken();
  if (!idToken) return null;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/line-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SUPABASE_ANON ? { apikey: SUPABASE_ANON } : {}),
    },
    body: JSON.stringify({ id_token: idToken }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.error ?? `line-auth ${res.status}`);

  const { error } = await supabase.auth.verifyOtp({
    token_hash: body.token_hash,
    type: "magiclink",
  });
  if (error) throw error;

  return { displayName: body.user.displayName, pictureUrl: body.user.pictureUrl ?? undefined };
}

// Returns the profile when a session exists, null otherwise. With LIFF it also
// bootstraps the Supabase session; without LIFF it falls back to the mock flag.
export async function initAuth(): Promise<AuthProfile | null> {
  if (!liffEnabled) {
    return localStorage.getItem(AUTH_KEY) === "1"
      ? { displayName: "joeomlet_xd" }
      : null;
  }
  // liff.init can reject with "invalid authorization code" when the page
  // reloads with a stale ?code/?state left in the URL — the session is still
  // valid, so treat init errors as non-fatal and rely on isLoggedIn().
  try {
    await liff.init({ liffId: LIFF_ID! });
  } catch (err) {
    console.warn("[beond-auth] liff.init warning (continuing):", err);
  }
  // Strip the leftover OAuth params so the next reload doesn't re-trigger it.
  if (typeof window !== "undefined" && /[?&]code=/.test(window.location.search)) {
    const url = new URL(window.location.href);
    ["code", "state", "liffClientId", "liffRedirectUri"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  if (!liff.isLoggedIn()) return null;

  try {
    const profile = await exchangeSupabaseSession();
    if (profile) return profile;
  } catch (err) {
    console.error("Supabase session exchange failed:", err);
  }
  // Fall back to the LINE profile even if the DB session couldn't be minted, so
  // the UI still renders (reads will just be empty under RLS).
  const p = await liff.getProfile();
  return { displayName: p.displayName, pictureUrl: p.pictureUrl };
}

// Starts the login flow. With LIFF this redirects to LINE and never
// resolves; the mock path resolves immediately.
export function login(): void {
  if (liffEnabled) {
    liff.login({ redirectUri: window.location.href });
    return;
  }
  localStorage.setItem(AUTH_KEY, "1");
}

// Watch for the Supabase session dying (JWT + refresh token both expired →
// supabase-js can't silently refresh and emits SIGNED_OUT). When that happens we
// first try a *silent* re-auth: the LINE LIFF session usually outlives the
// Supabase one, so we can mint a fresh session with no user interaction. Only if
// that fails do we surface it via `onLost` (the app then prompts a re-login).
// Returns an unsubscribe fn. No-op without Supabase.
export function watchSession(onLost: () => void): () => void {
  if (!supabaseEnabled || !supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(async (event) => {
    // Only a real sign-out (incl. a failed token refresh) counts. INITIAL_SESSION
    // with no session = a plain unauthenticated visit, not an expiry.
    if (event !== "SIGNED_OUT") return;
    // Explicit logout — let it through, don't re-auth back in.
    if (signingOut) return;
    // Try to recover without bouncing the user to the login page.
    if (liffEnabled && liff.isLoggedIn()) {
      try {
        const p = await exchangeSupabaseSession();
        if (p) return; // recovered — new session minted
      } catch (err) {
        console.warn("[beond-auth] silent re-auth failed:", err);
      }
    }
    onLost();
  });
  return () => data.subscription.unsubscribe();
}

// Set while an explicit logout is in flight, so watchSession doesn't try to
// silently re-authenticate the user right back in.
let signingOut = false;

export async function logout(): Promise<void> {
  signingOut = true;
  try {
    if (supabaseEnabled && supabase) await supabase.auth.signOut();
    if (liffEnabled && liff.isLoggedIn()) liff.logout();
    localStorage.removeItem(AUTH_KEY);
  } finally {
    signingOut = false;
  }
}
