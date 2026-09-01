/**
 * Keep the ad library out of the app shell's box model.
 *
 * AdSense makes room for a page-level anchor by writing
 * `height: auto !important; min-height: 0 !important` onto whatever element it
 * takes for the page content. Here that is the shell, whose height IS the
 * layout: it collapses to its contents, shortening the sidebar, and because the
 * style survives a client-side route change every other screen goes with it.
 *
 * Google's own opt-out (`ins.adsbygoogle-noablate`) is declared before the
 * library loads and was not honoured — measured in production with the opt-out
 * present and the style written anyway. An inline `!important` cannot be
 * answered from a stylesheet either. So the sizing declarations are simply
 * taken back off, whenever they appear.
 *
 * Nothing in the app sets an inline height on this element, so anything found
 * there is foreign by definition and removing it is safe. The observer's own
 * writes do not re-trigger it: after the removal there is nothing left to
 * remove and the next callback is a no-op.
 */
const SIZING = ["height", "min-height", "max-height"] as const;

export function guardShellSizing(el: HTMLElement): () => void {
  const strip = () => {
    if (!SIZING.some((p) => el.style.getPropertyValue(p))) return;
    for (const p of SIZING) el.style.removeProperty(p);
    if (!el.getAttribute("style")) el.removeAttribute("style");
  };

  strip();
  const observer = new MutationObserver(strip);
  observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  return () => observer.disconnect();
}
