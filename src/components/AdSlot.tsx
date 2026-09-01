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
// Skip Google's script entirely — the default in development, where localhost
// is not an approved domain and no ad can be served anyway. Set
// VITE_ADSENSE_DRYRUN=1 to switch the slot off in production too.
const DRY_RUN = import.meta.env.DEV || import.meta.env.VITE_ADSENSE_DRYRUN === "1";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptLoading: Promise<void> | null = null;

/**
 * Opt out of "ablation" before the library has a chance to do it.
 *
 * Left to itself, AdSense adds a page-level anchor unit and makes room for it by
 * writing `height: auto !important` onto whichever element it decides holds the
 * page content — in beond's case the app shell, whose height is the whole
 * layout. The shell collapsed from 900px to the height of its contents, taking
 * the sidebar and every other screen with it, and an inline `!important` cannot
 * be overridden from a stylesheet. Declaring this empty unit is Google's own
 * switch for that behaviour: with it present the anchor is not placed and the
 * shell is left alone. Measured both ways against the real ad on the production
 * domain before this was written.
 */
function declineAblation() {
  if (document.querySelector("ins.adsbygoogle-noablate")) return;
  const optOut = document.createElement("ins");
  optOut.className = "adsbygoogle adsbygoogle-noablate";
  optOut.style.display = "none";
  document.body.appendChild(optOut);
}

/** Fetch the AdSense library once per page, on the first consented render. */
function loadAdSense(client: string): Promise<void> {
  if (scriptLoading) return scriptLoading;
  declineAblation(); // must be in the document before the library runs
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
  // DRY_RUN means the library is not loaded, so there is nothing to show and
  // nothing to reserve room for — an empty labelled box would read as a broken
  // ad rather than an absent one.
  const active = Boolean(CLIENT && slot) && consent === "granted" && !DRY_RUN;

  useEffect(() => {
    if (!active || !CLIENT) return;
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
      <span className="absolute left-3 top-1 z-10 text-[10px] leading-none text-ink/40">โฆษณา</span>
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
