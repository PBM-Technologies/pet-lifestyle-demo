-- Find a sitter: sitter requests, saved sitters and care sheet fields.
-- Mirrors SitterRequest, Sitter, Pet.quirks and Household.memberPhones /
-- emergencyContact / houseNotes in src/contracts/domain.ts.
-- Booking itself happens on the provider's own site; nothing here stores
-- provider accounts or payment details. Household-scoped; authorization must
-- check household_members.

alter table households add column if not exists member_phones jsonb not null default '{}'::jsonb;
alter table households add column if not exists emergency_contact text check (emergency_contact is null or length(emergency_contact) between 1 and 30);
alter table households add column if not exists house_notes text check (house_notes is null or length(house_notes) <= 1500);
alter table pets add column if not exists quirks text check (quirks is null or length(quirks) <= 800);

create table if not exists sitters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  phone text check (phone is null or length(phone) <= 30),
  email text check (email is null or length(email) <= 120),
  -- provider id from the app's sitter provider config, or 'friend_family'
  found_via text not null default 'friend_family' check (length(found_via) between 1 and 40),
  notes text check (notes is null or length(notes) <= 2000),
  rating smallint check (rating is null or rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sitters_household_idx on sitters(household_id);

create table if not exists sitter_pets (
  sitter_id uuid not null references sitters(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  primary key (sitter_id, pet_id)
);

create table if not exists sitter_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  services text[] not null check (array_length(services, 1) >= 1 and services <@ array['boarding','house_sitting','drop_in','dog_walking','day_care']),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  location text check (location is null or length(location) <= 60),
  notes text check (notes is null or length(notes) <= 500),
  trip_id uuid references trips(id) on delete set null,
  status text not null default 'open' check (status in ('open','booked','cancelled')),
  booked_name text check (booked_name is null or length(booked_name) <= 60),
  booked_sitter_id uuid references sitters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sitter_requests_open_idx on sitter_requests(household_id, starts_on) where status = 'open';

-- Removing a pet removes it here; the app deletes requests left with no pets.
create table if not exists sitter_request_pets (
  request_id uuid not null references sitter_requests(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  primary key (request_id, pet_id)
);
