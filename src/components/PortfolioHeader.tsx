import { useAnnualIncome, currentTaxYearBE } from "../hooks/usePortfolio";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(Math.round(value));
}

export default function PortfolioHeader() {
  const { total } = useAnnualIncome();
  const yearBE = currentTaxYearBE();

  return (
    // Bottom padding clears the podium in the hero band — the calc() variants
    // track each breakpoint's hero height (88vw / 52vw / 22vw).
    <div className="px-6 pt-4 pb-[calc(88vw-200px)] text-center sm:px-8 sm:pt-6 sm:pb-[calc(52vw-190px)] md:px-12 lg:pb-[calc(22vw-180px)]">
      <p className="text-sm font-medium text-white/80">
        รายได้ดอกเบี้ยรวมปี <span className="font-nunito">{yearBE}</span>
      </p>
      <p className="mt-2 font-nunito text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        ฿{formatTHB(total)}
      </p>
    </div>
  );
}
