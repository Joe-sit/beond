import { createPortal } from "react-dom";
import type { TaxDoc } from "../../hooks/usePortfolio";
import type { EfilingRow } from "../../lib/efilingSync";

// Printable year-end report ("Export PDF"). Rendered through a portal into
// <body> as #print-root, which the print stylesheet swaps in for #root — see
// index.css. We print rather than generate a PDF in JS on purpose: jsPDF and
// friends have no complex-script shaping, so Thai vowels and tone marks stack
// wrongly, while the browser's own "Save as PDF" renders the page's real Thai
// webfonts perfectly and costs zero bundle size.

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtTaxId = (id: string) => {
  const d = id.replace(/\D/g, "");
  if (d.length !== 13) return id || "—";
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
};

// dd/mm/yyyy in the Buddhist era, matching how RD forms show dates.
const fmtDateBE = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
};

export default function TaxReportPrint({
  year,
  rows,
  docs,
  unfilable,
  ownerName,
}: {
  year: number | null;
  rows: EfilingRow[]; // per-payer 40(4) aggregation
  docs: TaxDoc[]; // every confirmed slip for the year
  unfilable: number;
  ownerName?: string | null;
}) {
  const slips = [...docs].sort((a, b) => (a.payDate ?? "").localeCompare(b.payDate ?? ""));
  const gross = slips.reduce((s, d) => s + (d.grossAmount ?? 0), 0);
  const wht = slips.reduce((s, d) => s + (d.whtAmount ?? 0), 0);
  const printedAt = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  return createPortal(
    <div id="print-root" className="font-sukhumvit text-[#222]">
      <header className="mb-5 border-b-2 border-[#222] pb-3">
        <h1 className="text-[20px] font-semibold">รายงานดอกเบี้ยหุ้นกู้และภาษีหัก ณ ที่จ่าย</h1>
        <p className="mt-1 text-[13px]">
          ปีภาษี {year} {ownerName ? `· ${ownerName}` : ""}
        </p>
        <p className="text-[11px] text-[#666]">ออกจากแอป beond เมื่อ {printedAt}</p>
      </header>

      {/* Headline totals */}
      <section className="mb-5 flex gap-3">
        {[
          { label: "จำนวนสลิป 50 ทวิ", value: `${slips.length} ใบ` },
          { label: "เงินได้ดอกเบี้ยรวม", value: `฿${fmtTHB(gross)}` },
          { label: "ภาษีหัก ณ ที่จ่ายรวม", value: `฿${fmtTHB(wht)}` },
        ].map((k) => (
          <div key={k.label} className="flex-1 border border-[#999] p-3">
            <p className="text-[11px] text-[#555]">{k.label}</p>
            <p className="mt-0.5 text-[16px] font-semibold">{k.value}</p>
          </div>
        ))}
      </section>

      {unfilable > 0 && (
        <p className="mb-4 border border-[#a86] bg-[#fdf6e8] p-2 text-[11px]">
          หมายเหตุ: มี {unfilable} สลิปที่ไม่มีเลขประจำตัวผู้เสียภาษี 13 หลักของผู้จ่ายเงินได้
          จึงไม่ถูกรวมในตารางสรุปตามผู้จ่าย (แต่ยังแสดงในรายการสลิปทั้งหมด)
        </p>
      )}

      {/* 40(4) filing summary — what actually goes into e-Filing */}
      <section className="mb-5">
        <h2 className="mb-1.5 text-[14px] font-semibold">
          สรุปตามผู้จ่ายเงินได้ (สำหรับยื่น 40(4))
        </h2>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#eee]">
              <th className="border border-[#999] p-1.5 text-left">ผู้จ่ายเงินได้</th>
              <th className="border border-[#999] p-1.5 text-left">เลขผู้เสียภาษี</th>
              <th className="border border-[#999] p-1.5 text-right">เงินได้</th>
              <th className="border border-[#999] p-1.5 text-right">ภาษีหัก ณ ที่จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.issuer_tax_id}>
                <td className="border border-[#999] p-1.5">{r.issuer_name}</td>
                <td className="border border-[#999] p-1.5 font-nunito">{fmtTaxId(r.issuer_tax_id)}</td>
                <td className="border border-[#999] p-1.5 text-right font-nunito">฿{fmtTHB(r.gross_interest)}</td>
                <td className="border border-[#999] p-1.5 text-right font-nunito">฿{fmtTHB(r.wht_amount)}</td>
              </tr>
            ))}
            <tr className="bg-[#eee] font-semibold">
              <td className="border border-[#999] p-1.5" colSpan={2}>รวม</td>
              <td className="border border-[#999] p-1.5 text-right font-nunito">
                ฿{fmtTHB(rows.reduce((s, r) => s + r.gross_interest, 0))}
              </td>
              <td className="border border-[#999] p-1.5 text-right font-nunito">
                ฿{fmtTHB(rows.reduce((s, r) => s + r.wht_amount, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Slip-by-slip backing detail */}
      <section>
        <h2 className="mb-1.5 text-[14px] font-semibold">รายการสลิป 50 ทวิ ทั้งหมด</h2>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#eee]">
              <th className="border border-[#999] p-1.5 text-left">วันที่จ่าย</th>
              <th className="border border-[#999] p-1.5 text-left">หุ้นกู้</th>
              <th className="border border-[#999] p-1.5 text-left">ผู้จ่ายเงินได้</th>
              <th className="border border-[#999] p-1.5 text-right">เงินได้</th>
              <th className="border border-[#999] p-1.5 text-right">ภาษีหัก ณ ที่จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {slips.map((d) => (
              <tr key={d.id}>
                <td className="border border-[#999] p-1.5 font-nunito">{fmtDateBE(d.payDate)}</td>
                <td className="border border-[#999] p-1.5">{d.symbol ?? "—"}</td>
                <td className="border border-[#999] p-1.5">{d.payerName ?? "—"}</td>
                <td className="border border-[#999] p-1.5 text-right font-nunito">฿{fmtTHB(d.grossAmount ?? 0)}</td>
                <td className="border border-[#999] p-1.5 text-right font-nunito">฿{fmtTHB(d.whtAmount ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-6 border-t border-[#bbb] pt-2 text-[10px] text-[#666]">
        รายงานนี้สรุปจากหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ที่ผู้ใช้บันทึกไว้ในแอป beond
        ไม่ใช่เอกสารที่ออกโดยกรมสรรพากร โปรดตรวจสอบกับต้นฉบับก่อนนำไปยื่น
      </footer>
    </div>,
    document.body,
  );
}
