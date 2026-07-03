import { useState } from "react";
import logo from "../assets/beond-icon.svg";
import beondHero from "../assets/beond-hero.svg";
import mascot from "../assets/mascot-1ee2b3.png";

interface LoginPageProps {
  onLogin: () => void;
}

function LineIcon() {
  // Simplified LINE speech-bubble mark
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M12 3C6.48 3 2 6.64 2 11.13c0 4.02 3.57 7.39 8.4 8.03.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .88.55 1.08-.46 5.83-3.43 7.96-5.88C21.5 14.4 22 12.84 22 11.13 22 6.64 17.52 3 12 3Zm-5.1 10.03H5.14a.53.53 0 0 1-.53-.53V8.93c0-.29.24-.53.53-.53s.53.24.53.53v3.05H6.9c.29 0 .53.24.53.53s-.24.52-.53.52Zm2.02-.53a.53.53 0 0 1-.53.53.53.53 0 0 1-.53-.53V8.93c0-.29.24-.53.53-.53s.53.24.53.53v3.57Zm4.6 0c0 .23-.15.43-.36.5a.55.55 0 0 1-.59-.18l-1.96-2.66v2.34a.53.53 0 0 1-.53.53.53.53 0 0 1-.52-.53V8.93c0-.23.14-.43.35-.5.21-.07.45 0 .59.18l1.96 2.66V8.93c0-.29.24-.53.53-.53s.53.24.53.53v3.57Zm3.09-2.32c.29 0 .53.24.53.53s-.24.53-.53.53h-1.24v.73h1.24c.29 0 .53.24.53.53s-.24.52-.53.52h-1.77a.53.53 0 0 1-.53-.52V8.93c0-.29.24-.53.53-.53h1.77c.29 0 .53.24.53.53s-.24.53-.53.53h-1.24v.72h1.24Z" />
    </svg>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (loading) return;
    setLoading(true);
    // Prototype: pretend to round-trip LINE OAuth
    setTimeout(onLogin, 900);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F4F1]">
      <img
        src={beondHero}
        alt=""
        className="pointer-events-none absolute inset-x-0 top-0 w-full"
      />

      <div className="relative z-10 mx-4 flex w-full max-w-md flex-col items-center rounded-4xl bg-white px-8 py-10 text-center shadow-xl">
        <img src={mascot} alt="" className="h-28 w-auto" />
        <img
          src={logo}
          alt="beond — Bring Your Bonds Beyond"
          width={150}
          height={47}
          className="mt-4 brightness-0 opacity-80"
        />
        <h1 className="mt-6 text-xl font-bold text-[#43507F]">
          ยินดีต้อนรับสู่ beond
        </h1>
        <p className="mt-2 text-sm font-medium text-black/60">
          จัดการพอร์ตหุ้นกู้ ดูไทม์ไลน์ดอกเบี้ย
          และเครดิตภาษีของคุณในที่เดียว
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#06C755] px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#05b34c] disabled:opacity-70"
        >
          {loading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <LineIcon />
          )}
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}
        </button>

        <p className="mt-4 text-xs text-black/40">
          การเข้าสู่ระบบถือว่ายอมรับ
          <a href="#" className="mx-1 text-[#43507F] underline">
            เงื่อนไขการใช้งาน
          </a>
          และ
          <a href="#" className="ml-1 text-[#43507F] underline">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </div>
    </div>
  );
}
