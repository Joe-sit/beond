-- beond — edge functions authenticate as service_role, but tables created via
-- the SQL editor only granted to anon/authenticated. Grant the bot's tables to
-- service_role so the LINE webhook can read/write them.
grant select, insert, update on public.users         to service_role;
grant select, insert, update on public.tax_documents to service_role;
grant select on public.bonds, public.holdings, public.payouts to service_role;
