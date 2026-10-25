-- PostgreSQL baseline; app-specific tables are added by feature migrations.
create extension if not exists pgcrypto;
create table if not exists users (id uuid primary key default gen_random_uuid(), auth_subject text not null unique, email text, created_at timestamptz not null default now());
create table if not exists households (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid not null references users(id), created_at timestamptz not null default now());
create table if not exists household_members (household_id uuid not null references households(id) on delete cascade, user_id uuid not null references users(id) on delete cascade, role text not null check(role in ('owner','admin','member','viewer')), primary key(household_id,user_id));
create table if not exists notifications (id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id), user_id uuid not null references users(id), type text not null, payload jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now());
-- Security invariant: every household-scoped query must check household_members.
-- Never use client-provided household_id as authorization proof.
