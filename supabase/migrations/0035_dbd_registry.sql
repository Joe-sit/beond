-- Pool of tax ids DBD has confirmed, so a number is looked up once and trusted
-- thereafter.
--
-- DBD answers in 7–11 seconds and is fronted by a WAF that drops requests, so
-- asking it on every keystroke is both slow and unreliable. It is also the only
-- authority here: a name in this table means DBD returned that exact name for
-- that exact number, and nothing else may put a row in it. Hence service_role
-- writes only — no user, and no other client, can bind a name to an id by hand,
-- because a hand-edited row would be indistinguishable from a verified one while
-- carrying none of the guarantee.
create table if not exists public.dbd_registry (
  tax_id        text primary key check (tax_id ~ '^[0-9]{13}$'),
  official_name text not null,
  verified_at   timestamptz not null default now()
);

alter table public.dbd_registry enable row level security;

-- Readable by any signed-in user (it's public registry data), writable by nobody
-- through the API: no insert/update/delete policy exists, and RLS denies by
-- default. Only service_role (which bypasses RLS) can write, and it only does so
-- straight after a successful DBD response.
drop policy if exists "dbd_registry read" on public.dbd_registry;
create policy "dbd_registry read" on public.dbd_registry
  for select to authenticated using (true);

grant select on public.dbd_registry to authenticated, service_role;
grant insert, update on public.dbd_registry to service_role;
