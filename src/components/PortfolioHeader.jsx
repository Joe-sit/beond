import { TOTAL_PORTFOLIO_VALUE } from "../data/mockData";
import stairHero from "../assets/stair-hero.svg";

function formatTHB(value) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function HeroIllustration() {
  return <img src={stairHero} alt="" className="mx-auto h-40 w-auto object-contain" />;
}

export default function PortfolioHeader() {
  return (
    <div className="px-8 pb-10 pt-4 text-center md:px-12">
      <p className="text-sm font-medium text-white/80">พอร์ตโฟลิโอของฉัน</p>
      <p className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
        ฿{formatTHB(TOTAL_PORTFOLIO_VALUE)}
      </p>
      <div className="mt-8">
        <HeroIllustration />
      </div>
    </div>
  );
}
