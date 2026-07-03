-- beond — store the fields needed to derive a real coupon payout schedule,
-- and let the add-bond flow seed the derived payouts (demo stage).

alter table public.bonds add column if not exists issue_date  date;
alter table public.bonds add column if not exists coupon_freq int;   -- payments/year

create policy "demo insert payouts" on public.payouts
  for insert with check (true);

-- RLS policy filters rows, but the anon role still needs the base GRANT.
grant insert on public.payouts to anon, authenticated;
