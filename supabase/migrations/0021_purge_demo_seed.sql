-- Remove all demo / seed data. Production must contain NO fabricated bonds —
-- the 0001 seed inserted made-up symbols (GULF289A, KBANK267A, BEM270A, …) and
-- a wrong coupon for ORI288B (5.00 vs the real 5.35), which surfaced as bad
-- data in holdings and in the admin "add to catalog" report.

-- 1. Payouts belonging to the demo user's holdings.
delete from public.payouts p
using public.holdings h, public.users u
where p.holding_id = h.id
  and h.user_id = u.id
  and u.line_user_id = 'demo';

-- 2. The demo user's holdings.
delete from public.holdings h
using public.users u
where h.user_id = u.id
  and u.line_user_id = 'demo';

-- 3. The seeded fake bonds — only if no real holding references them anymore,
--    so we never orphan a genuine user's position.
delete from public.bonds b
where b.symbol in (
    'ORI288B','SIRI266A','GULF289A','KBANK267A','CPF269A',
    'BEM270A','TRUE269B','CPALL268B','MINT270A'
  )
  and not exists (select 1 from public.holdings h where h.bond_id = b.id);

-- 4. The demo user (and any of its remaining dependent rows).
delete from public.tax_documents d
using public.users u
where d.user_id = u.id and u.line_user_id = 'demo';

delete from public.scan_usage s
using public.users u
where s.user_id = u.id and u.line_user_id = 'demo';

delete from public.users where line_user_id = 'demo';
