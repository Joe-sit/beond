-- Per-slip record of the DBD verdict on the payer's 13-digit id.
--
-- bonds.payer_tax_id_verified says the CATALOG's id for an issuer is trusted;
-- this says whether the id read off THIS slip checked out. The LINE flow needs
-- the distinction: a slip whose id doesn't match the issuer must stay unsaveable
-- even when the catalog already holds a good id for that issuer.
alter table public.tax_documents
  add column if not exists payer_tax_id_verified boolean not null default false;

grant select (payer_tax_id_verified), update (payer_tax_id_verified)
  on public.tax_documents to authenticated, service_role;
