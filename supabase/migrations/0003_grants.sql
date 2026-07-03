-- beond — table-level grants for the Data API roles.
-- Needed because "Automatically expose new tables" is off (by design):
-- RLS policies filter rows, but the role still needs base GRANTs.

grant usage on schema public to anon, authenticated;

grant select on public.users, public.sectors, public.bonds,
                public.holdings, public.payouts
  to anon, authenticated;

grant insert on public.bonds, public.holdings to anon, authenticated;
