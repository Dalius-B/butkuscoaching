-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Creates the table that stores every weekly check-in.
--
-- The insert policy created below (public, no login required) is superseded
-- by supabase/checkins-zona-integracija.sql, which locks submissions to
-- logged-in clients writing their own row. Run this file first regardless
-- (it creates the table), then always run checkins-zona-integracija.sql
-- after it -- that second file is safe to re-run any time.

create extension if not exists pgcrypto;

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Nullable for now (there is no login yet). Once client accounts exist,
  -- new rows can be written with the client's auth.users id attached, and
  -- old rows can be backfilled by matching on email.
  user_id uuid references auth.users(id),

  full_name text not null,
  email text not null,
  program_week text not null,

  sessions_completed text not null,
  effort_rating smallint not null,
  pain_status text not null,
  pain_detail text,
  avg_daily_steps integer,
  weight_kg numeric not null,

  sleep_hours text not null,
  sleep_quality smallint not null,
  sleep_disruptions text,

  nutrition_adherence smallint not null,
  protein_intake text not null,
  nutrition_struggles text not null,

  energy_level smallint not null,
  stress_level smallint not null,
  stress_source text,
  progress_feeling smallint not null,

  proud_of text not null,
  biggest_challenge text not null,
  additional_notes text,
  program_adjustment text
);

-- Row level security: the site only ever holds the public "publishable" key,
-- which is safe to expose because RLS decides what that key can do. It can
-- insert new check-ins but cannot read, edit, or delete any row, so clients
-- can never see each other's (or their own) history from the page itself.
-- You read everything from the Supabase dashboard's Table Editor, logged in
-- as the project owner, which bypasses RLS.
alter table public.checkins enable row level security;

create policy "Anyone can submit a checkin"
  on public.checkins
  for insert
  to anon
  with check (true);

-- Once client logins exist, add a matching select policy so a client can
-- read only their own rows, e.g.:
-- create policy "Clients can read their own checkins"
--   on public.checkins
--   for select
--   to authenticated
--   using (auth.uid() = user_id);
