-- beond — bind the payer's (issuer's) tax id to the bond series.
-- When a user confirms an OCR'd 50-ทวิ slip, we learn the issuer's 13-digit tax
-- id for that bond and store it on the catalog row. This makes the tax id →
-- issuer/logo resolution self-improving (replaces the hardcoded ISSUER_TAX_IDS
-- seed) and lets a later scan of the same bond auto-fill the payer tax id.

alter table public.bonds add column if not exists payer_tax_id text;

-- Allow the web app (authenticated user) to write the learned tax id back to the
-- catalog. Demo-stage open policy, consistent with the other bonds policies.
drop policy if exists "demo update bonds" on public.bonds;
create policy "demo update bonds" on public.bonds for update using (true) with check (true);

grant update on public.bonds to anon, authenticated;
