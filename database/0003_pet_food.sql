-- Food and treats per pet, with purchase history for "how much is left" estimates.
-- Mirrors PetFoodItem / FoodPurchase in src/contracts/domain.ts. Household-scoped;
-- authorization must check household_members (see 0001_identity.sql).

create table if not exists pet_food_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  kind text not null check (kind in ('food','treat')),
  brand text not null check (length(brand) between 1 and 80),
  product text not null check (length(product) between 1 and 120),
  flavor text,
  favorite boolean not null default false,
  package_size numeric(10,2) check (package_size is null or package_size > 0),
  package_unit text check (package_unit in ('lb','kg','oz','g','cans','pouches','count')),
  purchased_on date,                             -- date the current package was bought
  portion_amount numeric(8,2) check (portion_amount is null or portion_amount > 0),
  portion_unit text check (portion_unit in ('cups','g','oz','cans','pouches','pieces')),
  times_per_day smallint check (times_per_day is null or times_per_day between 1 and 4),
  cups_per_lb numeric(5,2) check (cups_per_lb is null or cups_per_lb > 0),
  reorder_lead_days smallint not null default 7 check (reorder_lead_days between 0 and 60),
  where_bought text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((package_size is null) = (package_unit is null)),
  check ((portion_amount is null) = (portion_unit is null))
);
create index if not exists pet_food_items_pet_idx on pet_food_items(household_id, pet_id) where active;

-- One row per bag, case or box bought. Price is only ever user-entered.
create table if not exists pet_food_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid not null references pet_food_items(id) on delete cascade,
  purchased_on date not null,
  size numeric(10,2) not null check (size > 0),
  unit text not null check (unit in ('lb','kg','oz','g','cans','pouches','count')),
  price numeric(10,2) check (price is null or price >= 0),
  created_at timestamptz not null default now()
);
create index if not exists pet_food_purchases_item_idx on pet_food_purchases(household_id, item_id, purchased_on);
