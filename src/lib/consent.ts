import { useSyncExternalStore } from "react";

// Whether the user has agreed to advertising cookies.
//
// PDPA wants consent before the data is collected, not after — so nothing about
// the ad network is loaded until this says "granted". "denied" and "unset"
// behave identically for ads; they differ only in whether we are still asking.

export type AdConsent = "granted" | "denied" | "unset";

const KEY = "beond:consent-ads";

let current: AdConsent = ((): AdConsent => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
})();

const subs = new Set<() => void>();

export function setAdConsent(next: AdConsent) {
  if (next === current) return;
  current = next;
  try {
    if (next === "unset") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* private mode — the choice just does not persist */
  }
  subs.forEach((f) => f());
}

export function useAdConsent(): AdConsent {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => current,
  );
}
