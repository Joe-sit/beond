-- beond — lock the tax-slips bucket to each owner. Slips are stored under a
-- folder named by the uploader's LINE user id ({lineUserId}/uuid.jpg); a caller
-- may only read objects under their own folder (claim from the session JWT).
-- The LINE bot writes with service_role, which bypasses these policies.
drop policy if exists "demo read tax-slips"  on storage.objects;
drop policy if exists "demo write tax-slips" on storage.objects;

create policy "tax-slips read own" on storage.objects
  for select using (
    bucket_id = 'tax-slips'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'line_user_id')
  );
