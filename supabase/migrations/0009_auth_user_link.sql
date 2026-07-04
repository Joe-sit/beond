-- beond — link each public.users row to its Supabase auth user, so RLS can
-- scope by the authenticated session. The auth user carries public_user_id in
-- app_metadata; this column is the reverse link + a guard against duplicates.
alter table public.users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists users_auth_user_idx
  on public.users (auth_user_id) where auth_user_id is not null;

grant select, update on public.users to service_role;
