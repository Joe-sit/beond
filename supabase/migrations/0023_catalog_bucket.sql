-- Public storage bucket for the bond catalog snapshot. The admin dashboard
-- uploads bond-catalog.json here (via the catalog-import edge function, which
-- writes with the service role), and the client reads it publicly — so a catalog
-- refresh goes live without a redeploy. Writes happen only through the edge
-- function; no client-facing insert/update policy is granted.
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do update set public = true;

-- Public read of objects in this bucket.
drop policy if exists "catalog public read" on storage.objects;
create policy "catalog public read"
  on storage.objects for select
  using (bucket_id = 'catalog');
