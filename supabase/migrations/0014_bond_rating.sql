-- beond — credit rating on bonds, powering the allocation "by rating" pillar view.
-- Full ratings (e.g. "BBB+", "A-") are stored as-is; the app collapses them to a
-- letter family (AAA/AA/A/BBB/BB/B) for grouping. NULL → "nonRate".

alter table public.bonds add column if not exists rating text;

-- Seed the demo/catalog bonds with real-ish TRIS ratings.
update public.bonds set rating = 'BBB+' where symbol = 'ORI288B';
update public.bonds set rating = 'BBB+' where symbol = 'SIRI266A';
update public.bonds set rating = 'A'    where symbol = 'GULF289A';
update public.bonds set rating = 'AA+'  where symbol = 'KBANK267A';
update public.bonds set rating = 'A+'   where symbol = 'CPF269A';
update public.bonds set rating = 'A'    where symbol = 'BEM270A';
update public.bonds set rating = 'BBB+' where symbol = 'TRUE269B';
update public.bonds set rating = 'A+'   where symbol = 'CPALL268B';
update public.bonds set rating = 'A-'   where symbol = 'MINT270A';
