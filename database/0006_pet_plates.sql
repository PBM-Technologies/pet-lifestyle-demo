-- Create a plate: one planned daily plate per pet, plus the pet facts the
-- calorie starting estimate uses. Mirrors PetPlate, PlateItem, Pet.activity /
-- bodyCondition / neutered and PetFoodItem.fromPlate in src/contracts/domain.ts.
-- Food type ids come from the app's content file; no product names or prices
-- are stored by the app, only what the user types.

alter table pets add column if not exists activity text check (activity is null or activity in ('low','normal','high'));
alter table pets add column if not exists body_condition text check (body_condition is null or body_condition in ('under','ideal','over'));
alter table pets add column if not exists neutered boolean;
alter table pet_food_items add column if not exists from_plate text check (from_plate is null or length(from_plate) <= 40);

create table if not exists pet_plates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null unique references pets(id) on delete cascade,
  other_kind text check (other_kind is null or other_kind in ('rabbit','guinea_pig','bird','reptile')),
  kcal_target integer check (kcal_target is null or kcal_target between 10 and 10000),
  kcal_source text not null default 'none' check (kcal_source in ('vet','estimate','none')),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pet_plate_items (
  plate_id uuid not null references pet_plates(id) on delete cascade,
  food_type text not null check (length(food_type) between 1 and 40),
  share smallint not null check (share between 0 and 100 and share % 5 = 0),
  is_base boolean not null default false,
  brand text check (brand is null or length(brand) <= 80),
  product text check (product is null or length(product) <= 120),
  kcal_per_unit numeric(7,2) check (kcal_per_unit is null or kcal_per_unit > 0),
  unit text check (unit is null or unit in ('cup','can','pouch','oz','piece','serving')),
  primary key (plate_id, food_type)
);
-- App rules (enforced client side, mirror in the API): exactly one base at 50 percent or more,
-- treat types total 10 percent or less, shares add up to 100.
create unique index if not exists pet_plate_items_one_base on pet_plate_items(plate_id) where is_base;
