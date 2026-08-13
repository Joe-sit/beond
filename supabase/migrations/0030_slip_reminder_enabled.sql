-- User preference: receive the weekly LINE reminder of uncollected 50-ทวิ slips.
-- Default true (opt-out). The slip-reminders Edge Function skips users with this
-- off; the settings page toggles it.
alter table public.users
  add column if not exists slip_reminder_enabled boolean not null default true;

-- Let an authenticated user flip just this field on their own row (same self-only
-- update policy as marginal_tax_rate / annual_income). service_role (the Edge
-- Function) already has full access but keep the read grant explicit.
grant update (slip_reminder_enabled) on public.users to authenticated;
grant select (slip_reminder_enabled) on public.users to authenticated, service_role;
