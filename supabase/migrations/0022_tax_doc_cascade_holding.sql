-- Deleting a holding must take its accumulated slips with it. The original FK
-- used `on delete set null`, which orphaned the tax_documents (they kept showing
-- up in the yearly summary as collected slips for a bond no longer in the port).
-- Switch to `on delete cascade` so removing a holding removes its slips.
alter table public.tax_documents
  drop constraint if exists tax_documents_holding_id_fkey;

alter table public.tax_documents
  add constraint tax_documents_holding_id_fkey
  foreign key (holding_id) references public.holdings (id) on delete cascade;
