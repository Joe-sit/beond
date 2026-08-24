-- Let the edge functions build a portfolio, not just read one.
--
-- 0008 granted service_role SELECT on bonds/holdings/payouts, which was all the
-- LINE webhook needed while it only read them. Adding a bond from a scanned slip
-- writes all three, and without these grants the insert was rejected — the flow
-- reported success in chat while the portfolio stayed empty.
--
-- UPDATE on bonds is the catalog trust upgrade (payer_tax_id_verified), already
-- performed by verify-tax-id.
grant insert, update on public.bonds    to service_role;
grant insert          on public.holdings to service_role;
grant insert          on public.payouts  to service_role;
