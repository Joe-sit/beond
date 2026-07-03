-- beond — initial schema
-- Run in Supabase SQL Editor (or `supabase db push` once CLI is linked).

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.users (
  id           uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text not null,
  picture_url  text,
  created_at   timestamptz not null default now()
);

create table public.sectors (
  id       text primary key,          -- slug, e.g. 'property'
  label_th text not null,
  color    text not null              -- base hue for the pillar chart
);

create table public.bonds (
  id                 uuid primary key default gen_random_uuid(),
  symbol             text unique not null,
  issuer             text not null,
  sector_id          text not null references public.sectors (id),
  coupon_rate        numeric(5, 2) not null,   -- % per year
  total_installments int not null,
  maturity_date      date
);

create table public.holdings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  bond_id      uuid not null references public.bonds (id),
  face_value   numeric(14, 2) not null,
  purchased_at date not null default current_date
);

create table public.payouts (
  id          uuid primary key default gen_random_uuid(),
  holding_id  uuid not null references public.holdings (id) on delete cascade,
  installment int not null,
  amount      numeric(14, 2) not null,
  payout_date date not null
);

create index holdings_user_idx on public.holdings (user_id);
create index payouts_holding_idx on public.payouts (holding_id);
create index payouts_date_idx on public.payouts (payout_date);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- NOTE: demo-stage policies. Reads are open to anon so the prototype can
-- render; tighten to per-user (auth.uid()) once LINE auth is wired through
-- an Edge Function that issues Supabase sessions.

alter table public.users    enable row level security;
alter table public.sectors  enable row level security;
alter table public.bonds    enable row level security;
alter table public.holdings enable row level security;
alter table public.payouts  enable row level security;

create policy "demo read users"    on public.users    for select using (true);
create policy "demo read sectors"  on public.sectors  for select using (true);
create policy "demo read bonds"    on public.bonds    for select using (true);
create policy "demo read holdings" on public.holdings for select using (true);
create policy "demo read payouts"  on public.payouts  for select using (true);

-- ── Seed data (matches the current mock) ────────────────────────────────

insert into public.users (line_user_id, display_name)
values ('demo', 'joeomlet_xd');

insert into public.sectors (id, label_th, color) values
  ('property',  'อสังหาริมทรัพย์และก่อสร้าง', '#4A5AA8'),
  ('energy',    'พลังงานและสาธารณูปโภค',     '#5990D7'),
  ('finance',   'ธนาคารและการเงิน',           '#2FA8AD'),
  ('food',      'อาหารและเครื่องดื่ม',        '#5FB865'),
  ('logistics', 'ขนส่งและโลจิสติกส์',         '#E0991B'),
  ('tech',      'เทคโนโลยีสารสนเทศ',          '#E8763A'),
  ('retail',    'พาณิชย์และค้าปลีก',          '#D95F8A'),
  ('tourism',   'ท่องเที่ยวและโรงแรม',        '#9B6FD0');

insert into public.bonds (symbol, issuer, sector_id, coupon_rate, total_installments, maturity_date) values
  ('ORI288B',  'Origin Property', 'property',  5.00, 8, '2028-08-28'),
  ('SIRI266A', 'Sansiri',         'property',  4.50, 6, '2026-06-15'),
  ('GULF289A', 'Gulf Energy',     'energy',    4.00, 4, '2028-09-30'),
  ('KBANK267A','Kasikornbank',    'finance',   3.50, 6, '2026-07-01'),
  ('CPF269A',  'Charoen Pokphand','food',      4.20, 6, '2026-09-01'),
  ('BEM270A',  'BEM',             'logistics', 3.80, 8, '2027-01-15'),
  ('TRUE269B', 'True Corp',       'tech',      4.80, 6, '2026-09-20'),
  ('CPALL268B','CP ALL',          'retail',    3.90, 8, '2026-08-10'),
  ('MINT270A', 'Minor Intl',      'tourism',   4.60, 6, '2027-01-30');

-- Holdings for the demo user; sector totals match the mock allocation
-- (฿10,000,000 portfolio).
with u as (select id from public.users where line_user_id = 'demo')
insert into public.holdings (user_id, bond_id, face_value)
select u.id, b.id, v.face_value
from u,
  (values
    ('ORI288B',  1800000),
    ('SIRI266A', 1000000),
    ('GULF289A', 2200000),
    ('KBANK267A',1500000),
    ('CPF269A',  1000000),
    ('BEM270A',   900000),
    ('TRUE269B',  700000),
    ('CPALL268B', 500000),
    ('MINT270A',  400000)
  ) as v (symbol, face_value)
  join public.bonds b on b.symbol = v.symbol;

-- 2568 payout schedule (matches the mock timeline).
with h as (
  select h.id, b.symbol
  from public.holdings h
  join public.bonds b on b.id = h.bond_id
)
insert into public.payouts (holding_id, installment, amount, payout_date)
select h.id, v.installment, v.amount, v.payout_date::date
from
  (values
    ('ORI288B',  1, 70000, '2025-01-28'),
    ('SIRI266A', 3, 45000, '2025-03-15'),
    ('ORI288B',  2, 70000, '2025-05-28'),
    ('GULF289A', 1, 32500, '2025-05-30'),
    ('SIRI266A', 4, 45000, '2025-07-15'),
    ('GULF289A', 2, 32500, '2025-09-30'),
    ('ORI288B',  3, 70000, '2025-11-28'),
    ('SIRI266A', 5, 45000, '2025-12-15')
  ) as v (symbol, installment, amount, payout_date)
  join h on h.symbol = v.symbol;
