-- beond — data minimisation: stop retaining the investor's national ID. beond
-- is only a middleman for bond/tax-credit tracking, so it keeps just what a
-- 40(4) filing needs (payer + amounts + dates). Drop the payee tax-id column,
-- scrub any raw OCR markdown (which embeds the ID) from existing rows.
update public.tax_documents
  set ocr_raw = jsonb_build_object('fields', ocr_raw -> 'fields')
  where ocr_raw ? 'markdown';

alter table public.tax_documents drop column if exists payee_tax_id;
