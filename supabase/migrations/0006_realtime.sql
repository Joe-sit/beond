-- beond — enable Supabase Realtime on the tables the dashboard watches, so
-- adding/removing a bond updates the allocation + timeline without a reload.

alter publication supabase_realtime add table public.holdings;
alter publication supabase_realtime add table public.payouts;
