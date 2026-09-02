-- beond — OCR spend control, revised for a free product.
--
-- The subscription was dropped (2026-09-02), so a user is now a cost rather
-- than revenue: every 50-ทวิ slip is a paid vision call, and nothing stopped
-- the bill growing with signups. Two changes:
--
--   1. The window moves from 5 per calendar day to 60 per rolling 30 days.
--      Slips do not arrive evenly — a coupon pays twice a year and people
--      upload a whole year's worth the week they file — so a daily cap punished
--      exactly the users who were using the product as intended. 60 covers
--      someone holding about thirty bonds clearing a full year in one sitting,
--      which is already past a normal retail portfolio.
--
--   2. The same image is never OCR'd twice. Re-sending a slip is common (a
--      photo sent again through LINE, an upload the user was not sure went
--      through), and each repeat was a fresh charge. scan_cache remembers the
--      fields per user per image, keyed by a hash of the bytes.
--
-- scan_cache holds what the slip says — payer, amounts, dates — which is the
-- same class of data tax_documents already stores, and never the raw OCR text
-- (that contains the payee's national ID). Rows are pruned after 120 days,
-- which outlasts a filing season without keeping the data indefinitely.

create table if not exists public.scan_cache (
  user_id    uuid not null references public.users (id) on delete cascade,
  image_hash text not null,
  fields     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, image_hash)
);

create index if not exists scan_cache_created_idx on public.scan_cache (created_at);

alter table public.scan_cache enable row level security;

-- Only the edge functions (service role, which bypasses RLS) touch this; no
-- anon/authenticated policies are granted.
grant select, insert, update, delete on public.scan_cache to service_role;

-- Housekeeping: drop cached extractions older than 120 days. Scheduled beside
-- the slip reminder so there is one place cron jobs live.
select cron.schedule(
  'beond-prune-scan-cache',
  '17 3 * * *',
  $$delete from public.scan_cache where created_at < now() - interval '120 days'$$
);
