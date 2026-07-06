import { useState } from "react";
import { Button } from "@heroui/react";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useTaxCredits, currentTaxYearBE } from "../hooks/usePortfolio";
import TaxCreditModal from "./TaxCreditModal";
import moneyIllustration from "../assets/money-illustration.svg";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

// Withholding-tax summary for the current year (left column, below the
// interest-timeline chart). Opens the per-slip tax-credit ledger.
export default function TaxCard() {
  const [taxOpen, setTaxOpen] = useState(false);
  const { docs } = useTaxCredits();

  const year = currentTaxYearBE();
  const credit = docs
    .filter((d) => d.status === "confirmed" && d.taxYear === year)
    .reduce((sum, d) => sum + (d.whtAmount ?? 0), 0);
  const pendingCount = docs.filter((d) => d.status === "pending").length;

  return (
    <div className="mx-8 mb-8 md:mx-12">
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl bg-white p-5 pl-32">
        <img
          src={moneyIllustration}
          alt=""
          className="pointer-events-none absolute -bottom-1 left-3 h-24 w-28 object-contain"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-black/60">
            ภาษีหัก ณ ที่จ่ายปี <span className="font-nunito">{year}</span>
          </p>
          <p className="mt-1 text-xl font-bold text-[#43507F]">
            ฿<span className="font-nunito">{formatTHB(Math.round(credit))}</span>
          </p>
          {pendingCount > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-amber-600">
              มี <span className="font-nunito">{pendingCount}</span> รายการรอยืนยันใน LINE
            </p>
          )}
        </div>
        <Button variant="primary" size="sm" className="shrink-0 bg-[#43507F]" onPress={() => setTaxOpen(true)}>
          <IconAdjustmentsHorizontal size={20} />
          จัดการ
        </Button>
      </div>

      <TaxCreditModal open={taxOpen} onClose={() => setTaxOpen(false)} />
    </div>
  );
}
