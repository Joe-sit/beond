-- Weekly trigger for the slip-reminders Edge Function.
--
-- pg_cron fires a helper that POSTs to the function over pg_net. The function's
-- own throttle (slip_reminder_sent_at, 6 days) is what actually protects users
-- from double-sends, so a re-run or a manual test is harmless.
--
-- The URL and the shared secret are NOT hardcoded here — they live in Vault, so
-- this migration is safe to commit and works across projects. Create them once
-- per environment (SQL editor, service_role):
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/slip-reminders', 'slip_reminders_url');
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'slip_reminders_cron_secret');
--
-- Rotate with vault.update_secret(id, new_value) — no redeploy needed.

-- No `with schema`: both extensions pin their own (cron, net) and are not
-- relocatable, so naming one here fails on a fresh project.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_slip_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  fn_secret text;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'slip_reminders_url';
  select decrypted_secret into fn_secret
    from vault.decrypted_secrets where name = 'slip_reminders_cron_secret';

  -- Missing config must not fail the cron job silently-but-loudly every week;
  -- warn once per run and leave the schedule intact.
  if fn_url is null or fn_secret is null then
    raise warning 'slip-reminders: vault secrets not set, skipping';
    return;
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', fn_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.trigger_slip_reminders() from public, anon, authenticated;

-- Sunday 09:00 Asia/Bangkok. pg_cron schedules in UTC, so 02:00 UTC — Thailand
-- has no DST, so the local hour never drifts.
select cron.unschedule('slip-reminders-weekly')
  where exists (select 1 from cron.job where jobname = 'slip-reminders-weekly');

select cron.schedule(
  'slip-reminders-weekly',
  '0 2 * * 0',
  $$select public.trigger_slip_reminders()$$
);
