-- Edit-holding (PATCH) failed with 403: the `authenticated` role had
-- SELECT/INSERT/DELETE on holdings but not UPDATE, so face-value edits were
-- denied at the table-grant layer (the RLS owner policy was already in place).
grant update on public.holdings to authenticated, anon;
