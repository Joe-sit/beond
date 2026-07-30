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

