-- Run this AFTER duomenu-baze.sql and treniruociu-programos.sql (needs
-- private.is_admin() and the programs / program_sections / exercises
-- tables). Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- WHY THIS FILE EXISTS
-- Until now, assigning a program to a client just pointed at the shared
-- template (public.assignments) -- editing a client's workout would have
-- edited the template everyone sees. This file changes that: assigning a
-- program now COPIES it into client_programs / client_days / client_exercises,
-- so each client's plan is their own independent record. The coach can edit
-- a client's copy (a weight, a rep range) without touching the original
-- program or any other client.
--
-- public.assignments is no longer used by the app after this. It is left in
-- place rather than dropped, since dropping it is not reversible and it is
-- not in anyone's way sitting there empty.
--
-- exercise_logs is redefined here to log against the client's OWN exercise
-- copy (client_exercises), not the shared template exercise. Since no real
-- client data depends on the old definition yet, it is dropped and recreated
-- rather than migrated in place.

drop table if exists public.exercise_logs;

create table public.client_programs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  program_id   uuid references public.programs (id) on delete set null,
  title        text not null,
  status       text not null default 'active' check (status in ('active', 'paused', 'finished')),
  starts_on    date,
  assigned_at  timestamptz not null default now()
);

create table public.client_days (
  id                 uuid primary key default gen_random_uuid(),
  client_program_id  uuid not null references public.client_programs (id) on delete cascade,
  title              text not null,
  notes              text not null default '',
  position           integer not null default 0
);

create table public.client_exercises (
  id            uuid primary key default gen_random_uuid(),
  client_day_id uuid not null references public.client_days (id) on delete cascade,
  title         text not null,
  target_sets   integer,
  target_reps   text,
  target_load   text,
  rest_seconds  integer,
  notes         text not null default '',
  video_url     text,
  position      integer not null default 0
);

create table public.exercise_logs (
  id                 uuid primary key default gen_random_uuid(),
  client_exercise_id uuid not null references public.client_exercises (id) on delete cascade,
  client_id          uuid not null references public.profiles (id) on delete cascade,
  set_index          integer not null default 1,
  weight_kg          numeric,
  reps               integer,
  rpe                numeric,
  notes              text,
  logged_at          timestamptz not null default now()
);

create index if not exists client_programs_client_idx   on public.client_programs (client_id);
create index if not exists client_days_program_idx      on public.client_days (client_program_id);
create index if not exists client_exercises_day_idx     on public.client_exercises (client_day_id);
create index if not exists exercise_logs_exercise_idx   on public.exercise_logs (client_exercise_id);
create index if not exists exercise_logs_client_idx     on public.exercise_logs (client_id);

-- ---------------------------------------------------------------------------
-- Helper functions, the same "one rule in one place" pattern as the rest of
-- the schema. Each answers one question and is reused by every policy that
-- needs the answer.
-- ---------------------------------------------------------------------------

-- Is the current user the client this client_program belongs to, or the trainer.
create or replace function private.owns_client_program(p_client_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.client_programs cp
    where cp.id = p_client_program_id and cp.client_id = (select auth.uid())
  );
$$;

-- Which client_program a client_exercise belongs to, two hops away
-- (exercise -> day -> client_program).
create or replace function private.client_exercise_program(p_client_exercise_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cd.client_program_id
  from public.client_exercises ce
  join public.client_days cd on cd.id = ce.client_day_id
  where ce.id = p_client_exercise_id;
$$;

revoke all on function private.owns_client_program(uuid)      from public;
revoke all on function private.client_exercise_program(uuid)  from public;
grant execute on function private.owns_client_program(uuid)     to authenticated;
grant execute on function private.client_exercise_program(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- assign_program: the copy-on-assign operation. Admin only (checked inside,
-- same as admin_set_status). Copies the template's days and exercises into
-- a brand new client_program the client owns outright. Returns its id.
-- ---------------------------------------------------------------------------
create or replace function public.assign_program(p_program_id uuid, p_client_id uuid, p_starts_on date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title           text;
  v_client_program  uuid;
  v_section         record;
  v_new_day         uuid;
  v_exercise        record;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  select title into v_title from public.programs where id = p_program_id;
  if v_title is null then
    raise exception 'Programa nerasta' using errcode = 'P0002';
  end if;

  insert into public.client_programs (client_id, program_id, title, starts_on)
  values (p_client_id, p_program_id, v_title, p_starts_on)
  returning id into v_client_program;

  for v_section in
    select * from public.program_sections where program_id = p_program_id order by position
  loop
    insert into public.client_days (client_program_id, title, notes, position)
    values (v_client_program, v_section.title, v_section.notes, v_section.position)
    returning id into v_new_day;

    for v_exercise in
      select * from public.exercises where section_id = v_section.id order by position
    loop
      insert into public.client_exercises
        (client_day_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url, position)
      values
        (v_new_day, v_exercise.title, v_exercise.target_sets, v_exercise.target_reps,
         v_exercise.target_load, v_exercise.rest_seconds, v_exercise.notes, v_exercise.video_url, v_exercise.position);
    end loop;
  end loop;

  return v_client_program;
end;
$$;

revoke all on function public.assign_program(uuid, uuid, date) from public;
grant execute on function public.assign_program(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants and row level security.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on public.client_programs  from anon, authenticated;
revoke all on public.client_days      from anon, authenticated;
revoke all on public.client_exercises from anon, authenticated;
revoke all on public.exercise_logs    from anon, authenticated;

grant select, update on public.client_programs  to authenticated;
grant select         on public.client_days      to authenticated;
grant select         on public.client_exercises to authenticated;
grant select, insert, update, delete on public.exercise_logs to authenticated;

alter table public.client_programs  enable row level security;
alter table public.client_days      enable row level security;
alter table public.client_exercises enable row level security;
alter table public.exercise_logs    enable row level security;

-- --- client_programs ------------------------------------------------------
drop policy if exists "client_programs_select" on public.client_programs;
create policy "client_programs_select" on public.client_programs
  for select to authenticated
  using (private.owns_client_program(id));

-- Status (active/paused/finished) is the one thing a coach changes after
-- assigning, e.g. to archive it without deleting the client's history.
drop policy if exists "client_programs_admin_update" on public.client_programs;
create policy "client_programs_admin_update" on public.client_programs
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- No insert policy here on purpose: rows are created only through
-- assign_program(), which runs as security definer and checks is_admin()
-- itself. That keeps "who can create an assignment" in exactly one place.

-- --- client_days / client_exercises ----------------------------------------
-- Read-only from the client's side (they see their plan, they do not edit
-- it); the coach edits through assign_program() re-runs for now, direct
-- write access can be added later if in-place editing of a client's copy
-- turns out to be needed day to day.
drop policy if exists "client_days_select" on public.client_days;
create policy "client_days_select" on public.client_days
  for select to authenticated
  using (private.owns_client_program(client_program_id));

drop policy if exists "client_exercises_select" on public.client_exercises;
create policy "client_exercises_select" on public.client_exercises
  for select to authenticated
  using (private.owns_client_program(
    (select client_program_id from public.client_days where id = client_exercises.client_day_id)
  ));

-- --- exercise_logs ----------------------------------------------------------
-- A client's own workout log: they write it, they read it back, the trainer
-- can read all of it. The trainer never writes here -- see the same note in
-- treniruociu-programos.sql, unchanged in spirit, just pointed at the
-- client's own exercise copy now instead of the shared template.
drop policy if exists "exercise_logs_own" on public.exercise_logs;
create policy "exercise_logs_own" on public.exercise_logs
  for all to authenticated
  using (
    client_id = (select auth.uid())
    and private.owns_client_program(private.client_exercise_program(client_exercise_id))
  )
  with check (
    client_id = (select auth.uid())
    and private.owns_client_program(private.client_exercise_program(client_exercise_id))
  );

drop policy if exists "exercise_logs_admin_select" on public.exercise_logs;
create policy "exercise_logs_admin_select" on public.exercise_logs
  for select to authenticated
  using (private.is_admin());
