-- Track when we last pushed a "slips to collect" LINE reminder to a user, so the
-- weekly job (and any manual re-run) never double-notifies within a short window.
alter table public.users
  add column if not exists slip_reminder_sent_at timestamptz;

-- The slip-reminders Edge Function runs as service_role; it already has full
-- access, but keep the grant explicit alongside the other user columns.
grant select (slip_reminder_sent_at), update (slip_reminder_sent_at)
  on public.users to service_role;
