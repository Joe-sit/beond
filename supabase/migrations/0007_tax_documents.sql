-- beond — Phase 0 of the LINE-OCR tax-credit feature.
-- Stores OCR'd "หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)" slips as a per-item
-- withholding-tax credit ledger. Rows start as `pending` right after OCR and
-- become `confirmed` once the user approves the extracted values (in LINE or the
-- web app). The browser extension later reads `confirmed` 40(4) rows to
-- assist-fill ภ.ง.ด.90/91.

-- ── Table ────────────────────────────────────────────────────────────────
create table public.tax_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,

  -- Provenance + review workflow.
  source        text not null default 'line_ocr',            -- line_ocr | web_upload
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'rejected')),
  image_path    text,                                          -- storage: tax-slips/{user}/{id}
  ocr_raw       jsonb,                                         -- raw Typhoon OCR payload

  -- Extracted 50-ทวิ fields (editable until confirmed).
  payer_name    text,                                          -- ผู้จ่ายเงิน (ผู้ออกหุ้นกู้/นายทะเบียน)
  payer_tax_id  text,                                          -- เลขประจำตัวผู้เสียภาษีผู้จ่าย (13 หลัก)
  payee_tax_id  text,                                          -- เลขประจำตัวผู้ถูกหัก
  income_type   text not null default '40(4)',                 -- มาตรา
  income_subtype text,                                         -- e.g. '40(4)(ก) ดอกเบี้ย'
  gross_amount  numeric(14, 2),                                -- จำนวนเงินได้ที่จ่าย
  wht_amount    numeric(14, 2),                                -- ภาษีที่หักและนำส่ง
  wht_rate      numeric(5, 2),                                 -- อัตราภาษีหัก ณ ที่จ่าย (%)
  pay_date      date,                                          -- วันเดือนปีที่จ่าย
  doc_ref       text,                                          -- เลขที่เอกสาร/ลำดับที่ (dedup key)
  tax_year      int,                                           -- ปีภาษี (พ.ศ.)

  -- Reconciliation to the user's portfolio (nullable — filled on match).
  bond_id       uuid references public.bonds (id),
  holding_id    uuid references public.holdings (id) on delete set null,
  payout_id     uuid references public.payouts (id) on delete set null,

  -- Include this credit when the extension fills the tax return.
  include_in_filing boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Same slip shouldn't land twice for a user (when a doc ref was read).
  unique (user_id, doc_ref)
);

create index tax_documents_user_idx      on public.tax_documents (user_id);
create index tax_documents_year_idx      on public.tax_documents (user_id, tax_year, status);
create index tax_documents_bond_idx      on public.tax_documents (bond_id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tax_documents_set_updated_at
  before update on public.tax_documents
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- NOTE: demo-stage policies to match the existing prototype. Tax slips are
-- SENSITIVE (national/tax IDs): before the web app + extension expose this data
-- (Phase 3–4), replace these with per-user policies keyed on a verified LINE
-- session (auth.uid() / line_user_id claim). Edge Functions write with the
-- service role and bypass RLS regardless.
alter table public.tax_documents enable row level security;

create policy "demo read tax_documents"   on public.tax_documents for select using (true);
create policy "demo insert tax_documents" on public.tax_documents for insert with check (true);
create policy "demo update tax_documents" on public.tax_documents for update using (true);

-- Base GRANTs (auto-expose is off; RLS still needs these).
grant select, insert, update on public.tax_documents to anon, authenticated;

-- ── Storage: private bucket for slip images ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('tax-slips', 'tax-slips', false)
on conflict (id) do nothing;

-- Demo-stage object policies (tighten to per-user path once auth lands).
create policy "demo read tax-slips" on storage.objects
  for select using (bucket_id = 'tax-slips');
create policy "demo write tax-slips" on storage.objects
  for insert with check (bucket_id = 'tax-slips');
