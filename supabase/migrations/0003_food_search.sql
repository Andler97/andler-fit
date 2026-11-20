-- Food search support: named portions, favorites, a stable upsert key, and a serving label on entries.
alter table public.foods add column if not exists portions jsonb not null default '[]'::jsonb;

create unique index if not exists foods_source_external_uniq
  on public.foods(source, external_id) where external_id is not null;

alter table public.food_log_entries add column if not exists serving_label text;

create table if not exists public.food_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);
alter table public.food_favorites enable row level security;
create policy food_favorites_all_own on public.food_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
