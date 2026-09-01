import { setAdConsent, useAdConsent } from "../lib/consent";

/**
 * The PDPA consent bar for advertising cookies.
 *
 * Asked once, and only where there is something to consent to — with no
 * publisher id configured there are no ad cookies and so no question. Declining
 * is one click, the same size as accepting: a banner where "no" is harder to
 * find than "yes" is not consent.
 *
 * `pointer-events-none` on the wrapper so the bar never blocks the page around
 * it; only the card itself takes clicks.
 */

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

export default function CookieConsent() {
  const consent = useAdConsent();
  if (!CLIENT || consent !== "unset") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] p-3">
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-3 rounded-3xl bg-white p-4 shadow-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-ink/60">
          beond ใช้คุกกี้เพื่อแสดงโฆษณา ผู้ให้บริการโฆษณาอาจใช้เก็บข้อมูลการใช้งานของคุณ · เลือกไม่ยอมรับได้ แอปทำงานครบเหมือนเดิม{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setAdConsent("denied")}
            className="h-10 flex-1 rounded-full border border-black/10 px-4 text-sm font-medium text-ink transition hover:bg-black/5 sm:flex-none"
          >
            ไม่ยอมรับ
          </button>
          <button
            onClick={() => setAdConsent("granted")}
            className="h-10 flex-1 rounded-full bg-[#43507F] px-5 text-sm font-medium text-white transition hover:bg-[#525F92] sm:flex-none"
          >
            ยอมรับ
          </button>
        </div>
      </div>
    </div>
  );
}
