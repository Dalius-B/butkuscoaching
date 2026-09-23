-- Run this AFTER duomenu-baze.sql (needs private.is_admin() and
-- private.has_program_access(), and the programs / program_sections /
-- assignments tables it creates). Supabase dashboard -> SQL Editor ->
-- New query -> paste -> Run. Safe to run more than once.
--
-- Adds the actual workout structure on top of the existing programs /
-- program_sections tables:
--   programs         a training block, e.g. "12 savaičių jėgos blokas"
--   program_sections  already exists -- reused here as a training DAY inside
--                     a program, e.g. "1 diena -- stumdymas"
--   exercises        one exercise inside a day: prescribed sets, reps, load
--   exercise_logs    what the client actually did, one row per completed set
--
-- exercise_logs is the client's own workout log: they write to it, they read
-- it back, the trainer can read all of it to see real progress. The trainer
-- never writes to it -- it is the client's record of what happened at the gym.

create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.program_sections (id) on delete cascade,
  title         text not null,
  target_sets   integer,
  target_reps   text,   -- free text on purpose: "8-10", "AMRAP", "30 sek"
  target_load   text,   -- free text on purpose: "60 kg", "70% 1PM", "RPE 8"
  rest_seconds  integer,
  notes         text not null default '',
  video_url     text,   -- optional YouTube/Vimeo demo link
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.exercise_logs (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  set_index    integer not null default 1,
  weight_kg    numeric,
  reps         integer,
  rpe          numeric,
  notes        text,
  logged_at    timestamptz not null default now()
);

create index if not exists exercises_section_idx     on public.exercises (section_id);
create index if not exists exercise_logs_exercise_idx on public.exercise_logs (exercise_id);
create index if not exists exercise_logs_client_idx   on public.exercise_logs (client_id);

-- Which program an exercise belongs to, two hops away (exercise -> day ->
-- program). Kept as its own function, the same way private.has_program_access
-- is its own function: one rule in one place, reused by every policy below.
create or replace function private.exercise_program(p_exercise_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ps.program_id
  from public.exercises e
  join public.program_sections ps on ps.id = e.section_id
  where e.id = p_exercise_id;
$$;

revoke all on function private.exercise_program(uuid) from public;
grant execute on function private.exercise_program(uuid) to authenticated;

grant usage on schema public to anon, authenticated;
revoke all on public.exercises     from anon, authenticated;
revoke all on public.exercise_logs from anon, authenticated;

grant select, insert, update, delete on public.exercises     to authenticated;
grant select, insert, update, delete on public.exercise_logs to authenticated;

alter table public.exercises     enable row level security;
alter table public.exercise_logs enable row level security;

-- --- exercises ----------------------------------------------------------
drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises
  for select to authenticated
  using (private.has_program_access(
    (select program_id from public.program_sections where id = exercises.section_id)
  ));

drop policy if exists "exercises_admin_write" on public.exercises;
create policy "exercises_admin_write" on public.exercises
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- --- exercise_logs --------------------------------------------------------
-- A client can insert/read/edit/delete only their own sets, and only for an
-- exercise belonging to a program they are actually assigned to. The trainer
-- never needs write access here: this table is the client's own record of
-- what happened at the gym, not something the trainer fills in for them.
drop policy if exists "exercise_logs_own" on public.exercise_logs;
create policy "exercise_logs_own" on public.exercise_logs
  for all to authenticated
  using (
    client_id = (select auth.uid())
    and private.has_program_access(private.exercise_program(exercise_id))
  )
  with check (
    client_id = (select auth.uid())
    and private.has_program_access(private.exercise_program(exercise_id))
  );

drop policy if exists "exercise_logs_admin_select" on public.exercise_logs;
create policy "exercise_logs_admin_select" on public.exercise_logs
  for select to authenticated
  using (private.is_admin());
