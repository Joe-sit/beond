-- The delete-bond-slips edge function removes a user's accumulated 50-ทวิ slips
-- for a bond it deletes, running as service_role (bypasses RLS). But migration
-- 0018 granted DELETE on tax_documents only to anon + authenticated, not
-- service_role — so the function's delete failed with "permission denied" (500),
-- leaving slips behind after a holding was removed. Grant DELETE to service_role.
grant delete on public.tax_documents to service_role;
