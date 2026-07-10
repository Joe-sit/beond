-- beond — allow deleting a tax document from the จัดการภาษี panel (full CRUD).
-- Demo-stage open policy, consistent with the existing tax_documents policies;
-- tighten to per-user (auth.uid()) alongside the other tax_documents policies
-- when the sensitive-data hardening pass lands.

create policy "demo delete tax_documents" on public.tax_documents for delete using (true);

grant delete on public.tax_documents to anon, authenticated;
