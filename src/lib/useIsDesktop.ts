import { useEffect, useState } from "react";

// True at Tailwind's `lg` breakpoint and up — the two-column dashboard. Mobile
// (LIFF) gets a single scrolling column with a leaner set of widgets. Lives here
// rather than in a component so the heavy desktop-only subtrees (WebGL scenes,
// the intro cinematic) can be skipped from anywhere without a circular import.
export const isDesktopNow = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktopNow);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}
