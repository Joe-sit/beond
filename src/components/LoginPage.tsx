import { useEffect, useRef, useState } from "react";
import { IconScan, IconPuzzle } from "@tabler/icons-react";
import logo from "../assets/landing-logo.svg";
import mascot from "../assets/landing-mascot.png";
import money from "../assets/bond-rise-hero.svg";
import clouds from "../assets/landing-clouds.svg";
import slipBack from "../assets/landing-slip-back.svg";
import slipFront from "../assets/landing-slip-front.svg";
import moneyBill from "../assets/landing-money-bill.svg";
import coins from "../assets/landing-coins.svg";
import lineIcon from "../assets/landing-line-icon.png";

interface LoginPageProps {
  onLogin: () => void;
}

// Toggles `.is-visible` on `.reveal` children once they scroll into view, so
// the feature section fades/rises in gradually. Fires once per element.
function useScrollReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

// Desktop/marketing landing page (Figma node 239:441). The LINE button starts
// the auth flow; the extension button is a Phase-4 placeholder.
export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const featureRef = useScrollReveal();

  const handleLogin = () => {
    if (loading) return;
    setLoading(true);
    // Prototype: pretend to round-trip LINE OAuth.
    setTimeout(onLogin, 900);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F4F1]">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-linear-to-b from-[#779BC6] to-[#F6F4F1] lg:min-h-176">
        {/* Cloud skyline drifting along the bottom of the gradient */}
        <img
          src={clouds}
          alt=""
          className="pointer-events-none absolute inset-x-0 bottom-0 w-full select-none"
        />

        {/* Top nav — translucent pill with the white beond wordmark */}
        <nav className="animate-fade-in relative z-10 mx-auto mt-6 flex max-w-300 items-center rounded-full bg-white/10 px-6 py-4 backdrop-blur-sm">
          <img src={logo} alt="beond" className="h-6 w-auto" />
        </nav>

        <div className="relative mx-auto grid max-w-300 grid-cols-1 items-center gap-8 px-6 pb-28 pt-10 lg:grid-cols-2">
          {/* Copy + CTAs — kept above the money illustration via z-index */}
          <div className="relative z-20">
            <h1 className="animate-fade-rise text-3xl font-bold leading-tight text-balance text-white sm:text-4xl lg:text-5xl xl:text-6xl">
              ปลดล็อคผลตอบแทนในหุ้นกู้ ด้วยการจัดการเครดิตภาษีที่สะดวกกว่าเดิม
            </h1>
            <p className="animate-fade-rise mt-5 max-w-xl text-base text-white/80 [animation-delay:120ms] sm:text-lg lg:text-xl">
              แพลตฟอร์มยุคใหม่ที่ออกแบบมาเพื่อนักลงทุนหุ้นกู้โดยเฉพาะ
              ช่วยคำนวณและติดตามภาษีอย่างโปร่งใส เพื่อผลตอบแทนที่เต็มเม็ดเต็มหน่วย
            </p>

            <div className="animate-fade-rise mt-8 flex flex-wrap gap-4 [animation-delay:240ms]">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="flex items-center gap-2 rounded-full bg-[#12BC59] px-6 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#10a850] hover:shadow-xl active:translate-y-0 disabled:opacity-70"
              >
                {loading ? (
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <img src={lineIcon} alt="" className="h-8 w-8" />
                )}
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded-full bg-[#43507F] px-6 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#525f92] hover:shadow-xl active:translate-y-0"
              >
                <IconPuzzle size={26} />
                ติดตั้ง Extension
              </button>
            </div>
          </div>

          {/* Mascot — stacks in-flow on mobile (spacer column on desktop) */}
          <div className="flex justify-center lg:hidden">
            <img
              src={mascot}
              alt=""
              className="animate-rise-float w-64 max-w-full select-none sm:w-80"
            />
          </div>
        </div>

        {/* Mascot — on desktop it's anchored to the hero's bottom so its feet
            meet the white section below (Figma: mascot bottom = section edge) */}
        <img
          src={mascot}
          alt=""
          className="animate-rise-float pointer-events-none absolute right-0 bottom-0 z-10 hidden w-lg max-w-[46%] select-none lg:block xl:w-xl"
        />

        {/* Money illustration bleeds off the bottom-left corner */}
        <img
          src={money}
          alt=""
          className="animate-fade-in pointer-events-none absolute bottom-0 left-0 z-10 w-32 select-none [animation-delay:450ms] sm:w-44 lg:w-56"
        />
      </section>

      {/* ── Feature section ──────────────────────────────────────────────── */}
      <section
        ref={featureRef}
        className="relative z-20 -mt-8 rounded-t-[40px] bg-white px-6 pb-24 pt-12"
      >
        <div className="mx-auto max-w-300">
          <h2 className="reveal text-2xl font-bold text-[#27518D] sm:text-3xl lg:text-4xl">
            ปลดล็อคผลตอบแทนในหุ้นกู้
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* Scan-to-tax-credit card */}
            <div className="reveal group relative min-h-80 overflow-hidden rounded-[40px] bg-[#253E7F] p-8 shadow-lg transition-all duration-300 [--reveal-delay:120ms] hover:-translate-y-1 hover:shadow-2xl md:p-10">
              <h3 className="max-w-md text-2xl font-bold leading-snug text-white sm:text-3xl">
                ใบ 50 ทวิหุ้นกู้ของปีนี้
                <br />
                คือรายได้ของคุณในปีหน้า
              </h3>
              <div className="relative z-10 mt-8 max-w-xs">
                <IconScan size={40} className="text-white" />
                <p className="mt-4 text-lg text-white/80">
                  เพียงสแกนหนังสือรับรองการหักภาษีจากดอกเบี้ยหุ้นกู้
                </p>
              </div>
              {/* Slip stack + money + coins illustration (Figma node 379:849).
                  The slips use the same isometric transform as Figma —
                  skewX + scaleY on top of the rotation — so they lie on a 3D plane. */}
              {/* Banknote sits at the bottom of the stack — the slips lie on top of
                  it, so it only peeks out from under the slip's lower-left edge */}
              <img
                src={moneyBill}
                alt=""
                className="pointer-events-none absolute bottom-1 left-[34%] w-24 select-none sm:w-28 lg:left-[38%] lg:w-32"
              />
              <img
                src={slipBack}
                alt=""
                className="pointer-events-none absolute -right-2 top-10 w-40 select-none transform-[rotate(41deg)_skewX(-22deg)_scaleY(0.92)] sm:right-8 sm:top-14 sm:w-48 lg:w-56"
              />
              <img
                src={slipFront}
                alt=""
                className="pointer-events-none absolute -right-6 top-4 w-44 select-none transform-[rotate(33deg)_skewX(-22deg)_scaleY(0.92)] sm:-right-2 sm:top-8 sm:w-52 lg:w-64"
              />
              <img
                src={coins}
                alt=""
                className="pointer-events-none absolute right-4 bottom-3 w-14 select-none sm:w-16 lg:w-20"
              />
            </div>

            {/* Reserved feature slot */}
            <div className="reveal min-h-80 rounded-[40px] bg-[#00665D] [--reveal-delay:240ms]" />
          </div>
        </div>
      </section>
    </div>
  );
}
