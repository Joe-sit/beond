// Structured 50-ทวิ fields extracted from a scanned slip. Mirrors the shape the
// LINE webhook's Typhoon extractor returns (supabase/functions/line-webhook), so
// the web-app /scan flow and the LINE flow converge on one schema. Privacy: no
// payee national ID — only what a 40(4) filing needs (payer + amounts + dates).
export interface SlipFields {
  payer_name: string | null;
  payer_tax_id: string | null;
  income_subtype: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  wht_amount: number | null;
  wht_rate: number | null;
  pay_date: string | null; // YYYY-MM-DD (ค.ศ.)
  doc_ref: string | null;
  tax_year: number | null; // พ.ศ.
  bond_symbol: string | null;
}

export const EMPTY_SLIP: SlipFields = {
  payer_name: null,
  payer_tax_id: null,
  income_subtype: null,
  gross_amount: null,
  net_amount: null,
  wht_amount: null,
  wht_rate: null,
  pay_date: null,
  doc_ref: null,
  tax_year: null,
  bond_symbol: null,
};

// Placeholder extractor: today it fakes a detection so the mobile flow can be
// built + tested end-to-end. Swap for a real call to the `ocr-extract` edge fn
// (POST the captured image, return SlipFields) once that lands.
export function mockExtract(_image: Blob): Promise<SlipFields> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        payer_name: "บริษัท บริทาเนีย จำกัด (มหาชน)",
        payer_tax_id: "0107562000572",
        income_subtype: "ดอกเบี้ยหุ้นกู้",
        gross_amount: 12500,
        net_amount: 10625,
        wht_amount: 1875,
        wht_rate: 15,
        pay_date: "2026-04-30",
        doc_ref: "BRI-2569-0042",
        tax_year: 2569,
        bond_symbol: "BRI275A",
      });
    }, 2200);
  });
}
