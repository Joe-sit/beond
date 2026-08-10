-- Finish purging seed/demo remnants that 0021 left behind.
--
-- 0021 removed the demo user + fake bonds, but skipped any bond a real holding
-- now references — so ORI288B / BTSG28OA survived carrying their seeded English
-- issuer strings ("Origin Property", "BTS Group"). The combobox flow only ever
-- writes the Thai legal name, so these English strings are pure seed leftovers
-- that break issuer-keyed matching (payer-tax-id fan-out, grouping). Also drop
-- stray test/orphan rows (ZZZTEST9, an orphan BRI267A seed).

-- 1. Orphan test / seed bonds with no holdings — safe to remove.
delete from public.bonds b
where b.symbol in ('ZZZTEST9', 'BRI267A')
  and not exists (select 1 from public.holdings h where h.bond_id = b.id);

-- 2. Normalize the seeded English issuer on real (held) bonds to the Thai legal
--    name their sibling series already use, so the whole issuer groups as one.
update public.bonds set issuer = 'บริษัท ออริจิ้น พร็อพเพอร์ตี้ จำกัด (มหาชน)'
  where symbol = 'ORI288B' and issuer !~ '[ก-๙]';
update public.bonds set issuer = 'บริษัท บีทีเอส กรุ๊ป โฮลดิ้งส์ จำกัด (มหาชน)'
  where symbol = 'BTSG28OA' and issuer !~ '[ก-๙]';
