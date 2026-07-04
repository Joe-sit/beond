-- beond — replace demo-open RLS with real per-user policies. The signed-in
-- session carries public_user_id in app_metadata (set by line-auth); scope all
-- user-owned tables to it. service_role (the LINE bot) bypasses RLS entirely.

-- Helper: the caller's public.users id, from the JWT app_metadata claim.
create or replace function public.current_public_user_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'public_user_id', '')::uuid
$$;

-- ── drop demo-open policies ────────────────────────────────────────────────
drop policy if exists "demo read users"          on public.users;
drop policy if exists "demo read sectors"        on public.sectors;
drop policy if exists "demo read bonds"          on public.bonds;
drop policy if exists "demo insert bonds"        on public.bonds;
drop policy if exists "demo delete bonds"        on public.bonds;
drop policy if exists "demo read holdings"       on public.holdings;
drop policy if exists "demo insert holdings"     on public.holdings;
drop policy if exists "demo delete holdings"     on public.holdings;
drop policy if exists "demo read payouts"        on public.payouts;
drop policy if exists "demo insert payouts"      on public.payouts;
drop policy if exists "demo read tax_documents"  on public.tax_documents;
drop policy if exists "demo insert tax_documents" on public.tax_documents;
drop policy if exists "demo update tax_documents" on public.tax_documents;

-- ── users: read own row ────────────────────────────────────────────────────
create policy "users read own" on public.users
  for select using (id = public.current_public_user_id());

-- ── reference data: readable by any authenticated/anon caller ───────────────
create policy "sectors public read" on public.sectors for select using (true);
create policy "bonds public read"   on public.bonds   for select using (true);
-- Shared bond catalog; the add-bond flow may insert a not-yet-known bond.
create policy "bonds insert" on public.bonds for insert with check (true);

-- ── holdings: owner only ───────────────────────────────────────────────────
create policy "holdings select own" on public.holdings
  for select using (user_id = public.current_public_user_id());
create policy "holdings insert own" on public.holdings
  for insert with check (user_id = public.current_public_user_id());
create policy "holdings update own" on public.holdings
  for update using (user_id = public.current_public_user_id())
  with check (user_id = public.current_public_user_id());
create policy "holdings delete own" on public.holdings
  for delete using (user_id = public.current_public_user_id());

-- ── payouts: via the owning holding ────────────────────────────────────────
create policy "payouts select own" on public.payouts
  for select using (exists (
    select 1 from public.holdings h
    where h.id = payouts.holding_id and h.user_id = public.current_public_user_id()
  ));
create policy "payouts insert own" on public.payouts
  for insert with check (exists (
    select 1 from public.holdings h
    where h.id = payouts.holding_id and h.user_id = public.current_public_user_id()
  ));
create policy "payouts delete own" on public.payouts
  for delete using (exists (
    select 1 from public.holdings h
    where h.id = payouts.holding_id and h.user_id = public.current_public_user_id()
  ));

-- ── tax_documents: owner only ──────────────────────────────────────────────
create policy "tax_documents select own" on public.tax_documents
  for select using (user_id = public.current_public_user_id());
create policy "tax_documents insert own" on public.tax_documents
  for insert with check (user_id = public.current_public_user_id());
create policy "tax_documents update own" on public.tax_documents
  for update using (user_id = public.current_public_user_id())
  with check (user_id = public.current_public_user_id());
create policy "tax_documents delete own" on public.tax_documents
  for delete using (user_id = public.current_public_user_id());

grant delete on public.payouts to authenticated;
