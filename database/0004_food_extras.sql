-- Feeding check-off, treat budget, food switch plans, spending and household member names.
-- Mirrors FeedingLog, TreatLog, FoodSwitchPlan, Expense and Household.members in
-- src/contracts/domain.ts. Household-scoped; authorization must check household_members.

alter table households add column if not exists member_names text[] not null default '{}';
alter table pets add column if not exists daily_calorie_target integer check (daily_calorie_target is null or daily_calorie_target between 50 and 10000);
alter table pet_food_items add column if not exists kcal_per_piece numeric(7,2) check (kcal_per_piece is null or kcal_per_piece > 0);

create table if not exists feeding_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  food_id uuid references pet_food_items(id) on delete set null,
  day date not null,
  slot smallint not null check (slot between 0 and 3),
  fed_at timestamptz not null,
  fed_by text check (fed_by is null or length(fed_by) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feeding_logs_day_idx on feeding_logs(household_id, pet_id, day);

create table if not exists treat_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  food_id uuid not null references pet_food_items(id) on delete cascade,
  day date not null,
  count smallint not null check (count between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (food_id, day)
);

create table if not exists food_switch_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  old_food_id uuid not null references pet_food_items(id) on delete cascade,
  new_food_id uuid not null references pet_food_items(id) on delete cascade,
  days smallint not null check (days in (7, 10)),
  start_date date not null,
  status text not null default 'active' check (status in ('active','done','stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists food_switch_plans_one_active on food_switch_plans(pet_id) where status = 'active';

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid references pets(id) on delete set null,
  category text not null check (category in ('food','treats','toys','meds','vet','grooming','boarding','supplies','other')),
  amount numeric(10,2) not null check (amount >= 0),
  spent_on date not null,
  note text check (note is null or length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_month_idx on expenses(household_id, spent_on);
