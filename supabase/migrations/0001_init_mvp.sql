-- andler-fit MVP schema
-- Pillars covered now: goal onboarding, calorie tracker + barcode scanner, intermittent fasting.
-- Forward-compatible stubs: exercises library (training), push tokens (tips/notifications).

create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== profiles (1:1 auth.users) =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text check (sex in ('male','female','other')),
  birth_date date,
  height_cm numeric(5,1),
  unit_system text not null default 'metric' check (unit_system in ('metric','imperial')),
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  locale text not null default 'en' check (locale in ('en','bg','ru')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ===== goals (history, one active) =====
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('lose_weight','gain_muscle','recomp')),
  start_weight_kg numeric(5,1),
  target_weight_kg numeric(5,1),
  rate_kg_per_week numeric(4,2) default 0.5,
  daily_calorie_target integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index goals_one_active_per_user on public.goals(user_id) where is_active;
create trigger trg_goals_updated before update on public.goals
  for each row execute function public.set_updated_at();
alter table public.goals enable row level security;
create policy goals_all_own on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== weight_logs =====
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default (now() at time zone 'utc')::date,
  weight_kg numeric(5,1) not null,
  body_fat_pct numeric(4,1),
  note text,
  created_at timestamptz not null default now()
);
create index weight_logs_user_day_idx on public.weight_logs(user_id, logged_on);
alter table public.weight_logs enable row level security;
create policy weight_logs_all_own on public.weight_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== foods (OFF cache + custom), per-100g canonical =====
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'custom' check (source in ('off','custom','usda')),
  barcode text,
  external_id text,
  name text not null,
  brand text,
  serving_description text,
  serving_size_g numeric(8,2),
  energy_kcal_100g numeric(8,2),
  protein_100g numeric(8,2),
  carbs_100g numeric(8,2),
  fat_100g numeric(8,2),
  sugars_100g numeric(8,2),
  fiber_100g numeric(8,2),
  saturated_fat_100g numeric(8,2),
  salt_100g numeric(8,2),
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index foods_off_barcode_uniq on public.foods(barcode) where source = 'off' and barcode is not null;
create index foods_barcode_idx on public.foods(barcode) where barcode is not null;
create index foods_name_trgm on public.foods using gin (name extensions.gin_trgm_ops);
create trigger trg_foods_updated before update on public.foods
  for each row execute function public.set_updated_at();
alter table public.foods enable row level security;
create policy foods_select on public.foods for select
  using (is_public or source = 'off' or auth.uid() = created_by);
create policy foods_insert_own_custom on public.foods for insert
  with check (auth.uid() = created_by and source = 'custom');
create policy foods_update_own on public.foods for update
  using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy foods_delete_own on public.foods for delete
  using (auth.uid() = created_by);

-- ===== food_log_entries (diary, snapshotted macros) =====
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  meal_type text not null default 'snack' check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null,
  quantity_g numeric(8,2) not null,
  servings numeric(6,2),
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index food_log_user_day_idx on public.food_log_entries(user_id, logged_on);
alter table public.food_log_entries enable row level security;
create policy food_log_all_own on public.food_log_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== fasting_settings (1:1) =====
create table public.fasting_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  protocol text not null default '16_8' check (protocol in ('16_8','18_6','20_4','omad','custom')),
  eating_window_start time not null default '12:00',
  eating_window_minutes integer not null default 480 check (eating_window_minutes between 30 and 1380),
  timezone text not null default 'Europe/Sofia',
  notify_start boolean not null default true,
  notify_end boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger trg_fasting_updated before update on public.fasting_settings
  for each row execute function public.set_updated_at();
alter table public.fasting_settings enable row level security;
create policy fasting_settings_all_own on public.fasting_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== fasting_logs =====
create table public.fasting_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  target_hours numeric(4,1),
  created_at timestamptz not null default now()
);
create index fasting_logs_user_idx on public.fasting_logs(user_id, started_at desc);
alter table public.fasting_logs enable row level security;
create policy fasting_logs_all_own on public.fasting_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== exercises (curated library stub, pillar 4) =====
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('push','pull','legs','core','full_body','cardio','mobility')),
  primary_muscles text[],
  equipment text,
  difficulty text check (difficulty in ('beginner','intermediate','advanced')),
  instructions text,
  video_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.exercises enable row level security;
create policy exercises_select_public on public.exercises for select using (is_public);

-- ===== push_tokens (tips/notifications stub, pillar 7) =====
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text check (platform in ('ios','android','web')),
  device_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);
create index push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
create policy push_tokens_all_own on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
