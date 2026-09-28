-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs treniruociu-programos.sql (exercises) and
-- klientu-kopijos.sql (client_exercises, assign_program()) to already exist.
--
-- Supersets: a boolean on each exercise saying "do this immediately after
-- the previous exercise, no rest between them" -- the group is just a run
-- of consecutive exercises (by position) that are each flagged this way.
-- No separate group id/table: grouping is purely adjacency + the flag, so
-- it always matches what the drag-and-drop reorder / position order shows,
-- with nothing that can point at a stale or since-moved exercise.

alter table public.exercises
  add column if not exists superset_with_previous boolean not null default false;

alter table public.client_exercises
  add column if not exists superset_with_previous boolean not null default false;

-- Pilnas assign_program() perrašymas -- vienintelis pakeitimas nuo
-- klientu-kopijos.sql versijos yra superset_with_previous kopijavimas.
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
        (client_day_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
         superset_with_previous, position)
      values
        (v_new_day, v_exercise.title, v_exercise.target_sets, v_exercise.target_reps,
         v_exercise.target_load, v_exercise.rest_seconds, v_exercise.notes, v_exercise.video_url,
         v_exercise.superset_with_previous, v_exercise.position);
    end loop;
  end loop;

  return v_client_program;
end;
$$;
