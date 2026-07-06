import { useState } from "react";
import { IconEye, IconEyeOff, IconPercentage, IconReport } from "@tabler/icons-react";
import { usePortfolioStats } from "../hooks/usePortfolio";
import moneyIllustration from "../assets/figma-money.svg";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(Math.round(value));
}

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatPill({ icon, label, value }: StatPillProps) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-2xl bg-[#F6F4F1]/10 p-3">
      <span className="shrink-0 text-[#F6F4F1]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs leading-tight font-medium text-[#F6F4F1]/80">{label}</p>
        <p className="font-nunito text-sm leading-tight font-bold text-[#F6F4F1]">{value}</p>
      </div>
    </div>
  );
}

// "My portfolio" — total invested with the weighted average coupon and
// remaining-years stats on an attached green card. Matches the Home redesign.
export default function PortfolioSummaryCard() {
  const { totalValue, avgCoupon, avgRemainingYears } = usePortfolioStats();
  const [hidden, setHidden] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E8E8E8] bg-[#F6F4F1] shadow-[0px_4px_24px_0px_rgba(0,0,0,0.05)]">
      {/* Money illustration bleeds off the top-right corner */}
      <img
        src={moneyIllustration}
        alt=""
        className="pointer-events-none absolute -top-1 right-2 h-28 w-40 object-contain"
      />

      <div className="relative flex flex-col gap-0.5 p-5 pb-4">
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="flex items-center gap-1.5 text-[#00665D]/80 transition-colors hover:text-[#00665D]"
          aria-label={hidden ? "แสดงมูลค่า" : "ซ่อนมูลค่า"}
        >
          <span className="text-sm font-medium">พอร์ตโฟลิโอของฉัน</span>
          {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
        <p className="text-2xl leading-none font-bold text-[#00665D]">
          ฿
          <span className="font-nunito">{hidden ? "••••••" : formatTHB(totalValue)}</span>
        </p>
      </div>

      {/* Attached green stats card — sits above the illustration */}
      <div className="relative z-10 flex gap-2 rounded-3xl bg-[#00665D] p-2">
        <StatPill
          icon={<IconPercentage size={20} />}
          label="ดอกเบี้ยเฉลี่ย"
          value={`${avgCoupon.toFixed(2)}% ต่อปี`}
        />
        <StatPill
          icon={<IconReport size={20} />}
          label="อายุคงเหลือเฉลี่ย"
          value={`${avgRemainingYears.toFixed(2)} ปี`}
        />
      </div>
    </div>
  );
}
