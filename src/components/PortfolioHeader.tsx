import { TOTAL_PORTFOLIO_VALUE } from "../data/mockData";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

export default function PortfolioHeader() {
  return (
    // Bottom padding clears the podium in the hero band (cropped to 22vw tall).
    <div className="px-8 pt-6 pb-[calc(22vw-180px)] text-center md:px-12">
      <p className="text-sm font-medium text-white/80">พอร์ตโฟลิโอของฉัน</p>
      <p className="mt-2 font-nunito text-4xl font-bold tracking-tight text-white md:text-5xl">
        ฿{formatTHB(TOTAL_PORTFOLIO_VALUE)}
      </p>
    </div>
  );
}
