-- Group the slips a user sends in one go.
--
-- LINE delivers a multi-photo send as one webhook event per image, tagged with a
-- shared `imageSet` id. Without grouping, four slips produced four separate
-- confirm cards arriving in whatever order OCR finished — so the columns below
-- let each document remember which batch it came from, and the table below
-- decides who gets to announce the finished batch.
alter table public.tax_documents
  add column if not exists image_set_id    text,
  add column if not exists image_set_index int,
  add column if not exists image_set_total int;

create index if not exists tax_documents_image_set_idx
  on public.tax_documents (image_set_id) where image_set_id is not null;

-- One row per batch. `pushed` is claimed atomically (update ... where pushed =
-- false) by whichever invocation finishes last: every image runs in its own
-- isolate, so without the claim two of them could both see "all done" and send
-- the carousel twice.
create table if not exists public.line_image_sets (
  set_id     text primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  total      int  not null,
  pushed     boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.line_image_sets enable row level security;
-- Server-side bookkeeping only — no policy, so RLS denies every API client.
grant select, insert, update on public.line_image_sets to service_role;

grant select (image_set_id, image_set_index, image_set_total)
  on public.tax_documents to authenticated, service_role;
grant update (image_set_id, image_set_index, image_set_total)
  on public.tax_documents to service_role;
