-- beond — allow the demo "load test data" button to reset holdings/bonds.
-- NOTE: demo-stage; remove once real per-user auth is wired.

create policy "demo delete holdings" on public.holdings
  for delete using (true);
create policy "demo delete bonds" on public.bonds
  for delete using (true);

-- payouts are removed via ON DELETE CASCADE from holdings, so no grant needed.
grant delete on public.holdings, public.bonds to anon, authenticated;
