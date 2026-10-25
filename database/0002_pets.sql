-- Consumer app domains (pets, care, places, trips, community, events, boxes).
-- Mirrors src/contracts/domain.ts. Every private row is household-scoped;
-- authorization must check household_members (see 0001_identity.sql).

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  species text not null check (species in ('dog','cat','other')),
  breed text,
  birth_date date,
  weight numeric(6,2) check (weight is null or weight > 0),
  weight_unit text not null default 'lb' check (weight_unit in ('lb','kg')),
  photo_path text,                 -- object storage key, signed access only
  allergies text[] not null default '{}',
  dietary_notes text,
  microchip text,
  vet_name text,
  vet_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pets_household_idx on pets(household_id);

create table if not exists pet_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  name text not null,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pet_documents_pet_idx on pet_documents(household_id, pet_id);

create table if not exists care_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  type text not null check (type in ('vaccine','medication','flea_tick','heartworm','vet_visit','grooming','weight','note')),
  title text not null,
  event_date date not null,
  due_date date,
  repeat_days integer check (repeat_days is null or repeat_days > 0),
  value numeric(8,2),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or due_date >= event_date)
);
create index if not exists care_events_pet_idx on care_events(household_id, pet_id);
create index if not exists care_events_due_idx on care_events(household_id, due_date) where completed_at is null and due_date is not null;

-- Places: household_id null = shared listing from a provider; otherwise user-added and private.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  category text not null check (category in ('dog_park','cat_cafe','hotel','campground','restaurant_patio','store','vet','groomer')),
  address text,
  city text,
  description text,
  latitude double precision,
  longitude double precision,
  source text,                     -- provider id for shared listings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists places_household_idx on places(household_id);

create table if not exists place_policies (
  place_id uuid primary key references places(id) on delete cascade,
  dogs_allowed boolean,
  cats_allowed boolean,
  size_limit text,
  pet_fee text,
  leash_rule text not null default 'unknown' check (leash_rule in ('required','off_leash_area','not_applicable','unknown')),
  verified_at date,
  verified_by text,                -- 'household' or a provider/moderator id; never implied
  policy_source text,
  updated_at timestamptz not null default now()
);

-- Household-private overlay: favorite, notes, rating, household verification.
create table if not exists saved_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  favorite boolean not null default false,
  notes text,
  rating smallint check (rating between 1 and 5),
  verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, place_id)
);

create table if not exists place_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  destination text,
  starts_on date,
  ends_on date,
  pet_ids uuid[] not null default '{}',
  packing jsonb not null default '[]'::jsonb,   -- [{id,label,checked,petId?,custom?}]
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists trips_household_idx on trips(household_id, starts_on);

create table if not exists trip_stops (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  label text not null,
  day date not null,
  at_time time,
  notes text,
  position integer not null default 0
);
create index if not exists trip_stops_trip_idx on trip_stops(household_id, trip_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,  -- null = public listing
  title text not null,
  kind text not null check (kind in ('walk_club','playdate','pet_birthday','adoption_event','other')),
  event_date date not null,
  at_time time,
  place_id uuid references places(id) on delete set null,
  location_text text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  status text not null check (status in ('going','maybe','not_going')),
  pet_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (event_id, household_id)
);

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  pet_ids uuid[] not null default '{}',
  caption text not null default '',
  photo_path text,
  visibility text not null default 'private' check (visibility in ('private','followers','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_household_idx on community_posts(household_id, created_at desc);

create table if not exists box_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  theme text not null check (theme in ('spoiled_rotten','busy_body','chaos_coordinator','new_kid')),
  cadence text not null check (cadence in ('one_time','monthly','quarterly')),
  size text not null check (size in ('small','medium','large')),
  toys_only boolean not null default false,
  status text not null default 'saved' check (status in ('draft','saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists box_preferences (
  box_plan_id uuid not null references box_plans(id) on delete cascade,
  restriction text not null,
  primary key (box_plan_id, restriction)
);

-- Commerce placeholders: populated only once a billing provider is integrated.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  box_plan_id uuid references box_plans(id) on delete set null,
  provider text not null,
  provider_ref text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  provider text not null,
  provider_ref text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table if not exists partners (
  id text primary key,
  name text not null,
  url text not null,
  category text not null,
  active boolean not null default true
);

create table if not exists dismissed_notifications (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  notification_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key (household_id, user_id, notification_key)
);
