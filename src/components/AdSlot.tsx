import { useEffect, useRef } from "react";
import { useAdConsent } from "../lib/consent";

/**
 * A Google AdSense unit, in a box that never changes size.
 *
 * The height is fixed and the whole thing is `shrink-0`, so whatever the ad
 * network does — arrive late, arrive tall, fail to arrive — it cannot move the
 * user's own figures around it. Nothing is requested from Google until consent
 * is granted, and with no publisher or slot id configured the component renders
 * nothing at all.
 */

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
// Draw the box, but do not fetch Google's script — the default everywhere.
//
// The adsbygoogle library edits the document it lands in: it inserts units of
// its own between elements, docks an anchor bar to the screen, and writes
// margins onto <html>/<body>. It also outlives a client-side route change, so
// one placement rearranges every other screen. That is what happened in
// production on 2026-09-01, and the CSS guards in index.css did not hold.
//
// So loading it is opt-in, not opt-out: set VITE_ADSENSE_DRYRUN=0 once the
// site's Auto ads AND Auto optimize are both off in AdSense, which is what
// gives the library licence to place things for itself. Until then the slot is
// an empty box that costs the page nothing.
const DRY_RUN = import.meta.env.VITE_ADSENSE_DRYRUN !== "0";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptLoading: Promise<void> | null = null;

/** Fetch the AdSense library once per page, on the first consented render. */
function loadAdSense(client: string): Promise<void> {
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("adsense failed to load"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export default function AdSlot({
  slot,
  height = 90,
  className = "",
}: {
  /** AdSense ad-unit id; each placement gets its own. */
  slot?: string;
  /** Fixed height in px — matched to the unit created in AdSense. */
  height?: number;
  className?: string;
}) {
  const consent = useAdConsent();
  const ins = useRef<HTMLModElement | null>(null);
  const active = Boolean(CLIENT && slot) && consent === "granted";

  useEffect(() => {
    if (!active || !CLIENT || DRY_RUN) return;
    let cancelled = false;
    loadAdSense(CLIENT)
      .then(() => {
        const el = ins.current;
        // StrictMode runs effects twice in development, and AdSense throws if
        // the same <ins> is filled again — it stamps the element when it has.
        if (cancelled || !el || el.dataset.adsbygoogleStatus) return;
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      })
      .catch(() => {
        /* blocked or offline — the fixed box simply stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-3xl bg-white ${className}`}
      style={{ height }}
    >
      <span className="absolute left-3 top-1 z-10 text-[10px] leading-none text-ink/40">
        {DRY_RUN ? "โฆษณา (ปิดไว้ตอน dev)" : "โฆษณา"}
      </span>
      <ins
        ref={ins}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
