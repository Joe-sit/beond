-- Trust metadata for the payer tax id. A 13-digit id is only trustworthy once
-- verified against DBD (the official juristic-person registry): DBD is asked for
-- the company name behind the number, and it must match the bond's issuer.
-- Unverified ids (raw OCR / user-typed) are shown with a warning and never
-- propagated issuer-wide, so a bad number can't spread through the shared catalog.
alter table public.bonds
  add column if not exists payer_tax_id_verified boolean not null default false,
  add column if not exists payer_verified_name text;
