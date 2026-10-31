-- Run this in the Supabase dashboard: Project -> SQL Editor -> New query ->
-- paste -> Run. Needs duomenu-baze.sql (private.is_admin(), touch_updated_at),
-- treniruociu-programos.sql (exercises), klientu-kopijos.sql
-- (client_exercises) and pratimo-tipas.sql (log_type) to already exist.
-- Safe to run more than once.
--
-- WHY THIS FILE EXISTS
-- Building a new program meant retyping the same exercise's description,
-- sets, reps and video link every time it showed up in another client's
-- plan. This adds one canonical "library" entry per exercise NAME, so the
-- app can offer it by name and pre-fill the rest.
--
-- DEDUPLICATION: title_key is the title trimmed and lowercased, with a
-- unique constraint on it. "Bench Press" and "bench press " are the same
-- library entry — the database itself refuses a second row for either.

create table if not exists public.exercise_library (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  title_key     text generated always as (lower(trim(title))) stored,
  target_sets   integer,
  target_reps   text,   -- laisvas tekstas: "8-10", "AMRAP", "30 sek"
  target_load   text,   -- laisvas tekstas: "60 kg", "70% 1PM", "RPE 8"
  rest_seconds  integer,
  notes         text not null default '',
  video_url     text,
  log_type      text not null default 'svoris' check (log_type in ('svoris', 'kartai', 'laikas')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (title_key)
);

create index if not exists exercise_library_title_idx on public.exercise_library (title_key);

drop trigger if exists exercise_library_touch on public.exercise_library;
create trigger exercise_library_touch before update on public.exercise_library
  for each row execute function public.touch_updated_at();

-- Vienkartinis užpildymas iš jau esamų pratimų (šablonų ir klientų kopijų),
-- kad senos programos iškart papildytų biblioteką be trenerio rankinio darbo.
-- Kai tas pats pavadinimas pasitaiko kelis kartus, pirmenybė teikiama
-- šablono (exercises) įrašui prieš kliento vienkartinę kopiją, o tarp kelių
-- šablono įrašų — seniausiam, nes tai greičiausiai originalas, kurį
-- trenerias nuolat ir perpanaudoja.
insert into public.exercise_library
  (title, target_sets, target_reps, target_load, rest_seconds, notes, video_url, log_type)
select distinct on (lower(trim(visi.title)))
  visi.title, visi.target_sets, visi.target_reps, visi.target_load,
  visi.rest_seconds, visi.notes, visi.video_url, visi.log_type
from (
  select title, target_sets, target_reps, target_load, rest_seconds, notes, video_url, log_type,
         0 as saltinio_pirmenybe, created_at
  from public.exercises
  union all
  select title, target_sets, target_reps, target_load, rest_seconds, notes, video_url, log_type,
         1 as saltinio_pirmenybe, now() as created_at
  from public.client_exercises
) visi
where trim(visi.title) <> ''
order by lower(trim(visi.title)), visi.saltinio_pirmenybe asc, visi.created_at asc
on conflict (title_key) do nothing;

grant usage on schema public to authenticated;
revoke all on public.exercise_library from anon, authenticated;
grant select, insert, update, delete on public.exercise_library to authenticated;

alter table public.exercise_library enable row level security;

-- Vien treneriui skirtas įrankis — klientas niekada nemato ir neliečia
-- bibliotekos, todėl viena taisyklė visiems veiksmams.
drop policy if exists "exercise_library_admin_all" on public.exercise_library;
create policy "exercise_library_admin_all" on public.exercise_library
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
