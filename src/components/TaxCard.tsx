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
  const { docs, loading } = useTaxCredits();

  // Overpaid tax reclaimable this year = the 15% withheld on bond-coupon income.
  // Match the จัดการภาษี ledger exactly: confirmed slips, summed for the latest
  // tax year present. taxYear/whtAmount can arrive as strings from PostgREST, so
  // coerce before comparing (a string === number check silently yields 0).
  const confirmedDocs = docs.filter((d) => d.status === "confirmed" && d.taxYear != null);
  const year = confirmedDocs.length
    ? Math.max(...confirmedDocs.map((d) => Number(d.taxYear)))
    : currentTaxYearBE();
  const credit = confirmedDocs
    .filter((d) => Number(d.taxYear) === year)
    .reduce((sum, d) => sum + Number(d.whtAmount ?? 0), 0);
  const pendingCount = docs.filter((d) => d.status === "pending").length;

  return (
    <div>
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border border-[#E7E7E7] bg-white p-5 pl-32">
        <img
          src={moneyIllustration}
          alt=""
          className="pointer-events-none absolute -bottom-1 left-3 h-24 w-28 object-contain"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-black/60">
            ภาษีจ่ายเกินขอคืนได้ · ปีภาษี <span className="font-nunito">{year}</span>
          </p>
          {loading ? (
            <span className="mt-1.5 block h-6 w-28 animate-pulse rounded-lg bg-[#43507F]/10" />
          ) : (
            <p className="mt-1 text-xl font-bold text-[#43507F]">
              ฿<span className="font-nunito">{formatTHB(Math.round(credit))}</span>
            </p>
          )}
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
