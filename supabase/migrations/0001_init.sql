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

-- ── Reference data ───────────────────────────────────────────────────────
-- Sector groups only. NO demo/fake bonds, holdings, payouts or users — the app
-- runs on real user data (bonds are created on demand as users add holdings).

insert into public.sectors (id, label_th, color) values
  ('property',  'อสังหาริมทรัพย์และก่อสร้าง', '#4A5AA8'),
  ('energy',    'พลังงานและสาธารณูปโภค',     '#5990D7'),
  ('finance',   'ธนาคารและการเงิน',           '#2FA8AD'),
  ('food',      'อาหารและเครื่องดื่ม',        '#5FB865'),
  ('logistics', 'ขนส่งและโลจิสติกส์',         '#E0991B'),
  ('tech',      'เทคโนโลยีสารสนเทศ',          '#E8763A'),
  ('retail',    'พาณิชย์และค้าปลีก',          '#D95F8A'),
  ('tourism',   'ท่องเที่ยวและโรงแรม',        '#9B6FD0');
