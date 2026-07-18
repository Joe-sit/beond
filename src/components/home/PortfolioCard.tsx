import { useState } from "react";
import { IconEye, IconEyeOff, IconInfoCircle } from "@tabler/icons-react";
import { usePortfolioStats } from "../../hooks/usePortfolio";
import ProfileLevelModal, { LEVELS, levelIndex } from "./ProfileLevelModal";

const fmtTHB = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n));

// Portfolio summary card — total face value, weighted avg coupon + remaining
// tenor, a "collector level" badge, and the beond investor mascot.
export default function PortfolioCard() {
  const { totalValue, avgCoupon, avgRemainingYears, loading } = usePortfolioStats();
  const [hidden, setHidden] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const mask = (s: string) => (hidden ? "•".repeat(Math.max(3, s.length)) : s);
  const lvlIdx = levelIndex(totalValue);
  const level = LEVELS[lvlIdx];

  return (
    <div className="relative flex h-full min-h-37.5 items-center overflow-hidden rounded-3xl bg-card">
      <img
        src={level.mascot}
        alt=""
        className="pointer-events-none absolute inset-y-[10%] right-[4%] w-[40%] object-contain object-right"
      />

      <div className="relative flex flex-col gap-2 p-6 pr-[44%]">
        <div className="flex items-center gap-1.5 text-base text-ink-soft">
          พอร์ตโฟลิโอของฉัน
          <button onClick={() => setHidden((h) => !h)} aria-label="ซ่อน/แสดงมูลค่า" className="text-ink-soft/70 hover:text-ink-soft">
            {hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>

        {loading ? (
          <span className="h-8 w-40 animate-pulse rounded-lg bg-black/5" />
        ) : (
          <p className="font-nunito text-3xl font-bold text-ink">฿{mask(fmtTHB(totalValue))}</p>
        )}

        <div className="mt-1 flex items-center gap-4">
          <div>
            <p className="text-base text-ink-soft">ดอกเบี้ยเฉลี่ย</p>
            <p className="mt-1 font-nunito text-2xl font-bold text-ink">{avgCoupon.toFixed(2)}%</p>
          </div>
          <span className="h-11 w-px rounded-full bg-black/10" />
          <div>
            <p className="text-base text-ink-soft">อายุคงเหลือเฉลี่ย</p>
            <p className="mt-1 font-nunito text-2xl font-bold text-ink">{avgRemainingYears.toFixed(2)} ปี</p>
          </div>
        </div>

        <button
          onClick={() => setLevelOpen(true)}
          className="mt-2 flex w-fit items-center gap-1.5 rounded-xl bg-black/5 px-2 py-1 text-sm text-ink-soft transition hover:bg-black/10"
        >
          {level.label}
          <IconInfoCircle size={16} className="text-ink-soft/60" />
        </button>
      </div>

      <ProfileLevelModal open={levelOpen} onClose={() => setLevelOpen(false)} currentIndex={lvlIdx} />
    </div>
  );
}
