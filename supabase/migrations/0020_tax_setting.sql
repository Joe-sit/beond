-- TaxSetting: let a user record their marginal personal-income-tax rate (%) so
-- the app can reason about their withholding-tax credit vs. their real bracket.
-- Stored as the bracket's marginal rate (0/5/10/15/20/25/30/35), null = unset.

alter table public.users
  add column if not exists marginal_tax_rate int;

-- Users may update only their own row (and, via the column grant below, only
-- this field). Read-own already exists (migration 0010).
drop policy if exists "users update own" on public.users;
create policy "users update own" on public.users
  for update using (id = public.current_public_user_id())
  with check (id = public.current_public_user_id());

grant update (marginal_tax_rate) on public.users to authenticated;
