import liff from "@line/liff";

export interface AuthProfile {
  displayName: string;
  pictureUrl?: string;
}

const AUTH_KEY = "beond-logged-in";
const LIFF_ID = import.meta.env.VITE_LIFF_ID as string | undefined;

export const liffEnabled = Boolean(LIFF_ID);

// Returns the LINE profile when a LIFF session already exists,
// null otherwise. Falls back to the mock flag when LIFF is not configured.
export async function initAuth(): Promise<AuthProfile | null> {
  if (!liffEnabled) {
    return localStorage.getItem(AUTH_KEY) === "1"
      ? { displayName: "joeomlet_xd" }
      : null;
  }
  await liff.init({ liffId: LIFF_ID! });
  if (!liff.isLoggedIn()) return null;
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

export function logout(): void {
  if (liffEnabled && liff.isLoggedIn()) liff.logout();
  localStorage.removeItem(AUTH_KEY);
}
