-- Close the duplicate-slip gap for slips whose document reference couldn't be
-- read by OCR (doc_ref IS NULL). The existing UNIQUE (user_id, doc_ref) can't
-- catch these — Postgres treats each NULL as distinct — so the same slip could be
-- re-uploaded and double-count the tax credit.
--
-- This partial index enforces uniqueness on the slip's identifying fields instead
-- (issuer bond + pay date + amounts) for CONFIRMED slips that lack a doc_ref.
-- NULLS NOT DISTINCT makes a NULL bond_id compare equal, so an unresolved-bond
-- slip is still de-duplicated by its date + amounts. A genuine previous-installment
-- slip has a different pay_date/amount, so it is unaffected.
create unique index if not exists tax_documents_dedup_null_docref
  on public.tax_documents (user_id, bond_id, pay_date, gross_amount, wht_amount)
  nulls not distinct
  where doc_ref is null and status = 'confirmed' and pay_date is not null;
