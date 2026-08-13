-- Persistent LINE friendship status, driven by webhook follow/unfollow events, so
-- we know (server-side, any time) whether a user has beond added as a LINE friend.
-- Needed to target push (slip reminders can only reach friends) and to show status
-- in Settings. null = unknown (never observed an event).
alter table public.users
  add column if not exists line_friend boolean;
alter table public.users
  add column if not exists line_friend_at timestamptz;

-- Let an authenticated user read their own status; the webhook (service_role)
-- writes it.
grant select (line_friend, line_friend_at) on public.users to authenticated, service_role;
grant update (line_friend, line_friend_at) on public.users to service_role;

-- Backfill: every user we already have a line_user_id for has interacted with the
-- OA (they scanned/added via LINE), so they are currently friends. A later
-- unfollow event will flip them false.
update public.users
  set line_friend = true, line_friend_at = now()
  where line_user_id is not null and line_friend is null;
