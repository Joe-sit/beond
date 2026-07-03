-- beond — allow the add-bond flow to write (demo stage).
-- NOTE: tighten to per-user policies once LINE auth issues Supabase sessions.

create policy "demo insert bonds" on public.bonds
  for insert with check (true);

create policy "demo insert holdings" on public.holdings
  for insert with check (true);
