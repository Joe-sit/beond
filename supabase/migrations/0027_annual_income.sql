-- Persist the user's actual annual (net taxable) income so the tax-base page and
-- the tax cards agree across devices — previously it lived only in localStorage,
-- so it didn't sync and the summary cards fell back to a rate-only estimate.
-- Stored in whole baht; null = unset.
alter table public.users
  add column if not exists annual_income bigint;

-- Same self-only update policy as marginal_tax_rate (migration 0020). Grant the
-- column so an authenticated user can write just this field on their own row.
grant update (annual_income) on public.users to authenticated;
