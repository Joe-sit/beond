-- beond — per-user daily OCR-scan quota (Gemini costs money / free-tier is
-- capped). Each web scan or LINE slip image counts once; a user is limited to
-- SCAN_DAILY_LIMIT (5) per day. Accounts with users.scan_unlimited = true are
-- exempt (the owner's account). Enforced in the edge functions via service role.

alter table public.users add column if not exists scan_unlimited boolean not null default false;

create table if not exists public.scan_usage (
  user_id uuid not null references public.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

-- Only the edge functions (service role, bypasses RLS) read/write this; no
-- anon/authenticated policies are granted.
grant select, insert, update on public.scan_usage to service_role;
