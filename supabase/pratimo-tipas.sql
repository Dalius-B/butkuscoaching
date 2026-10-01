-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs treniruociu-programos.sql (exercises), klientu-kopijos.sql
-- (client_exercises, assign_program()) and supersetai.sql (adds superset_with_previous,
-- which the assign_program() rewrite below keeps) to already exist.
--
-- Not every exercise is logged the same way: a barbell squat needs weight + reps,
-- a push-up needs only reps (bodyweight), and a plank needs only a duration. This
-- adds log_type to say which, on both the coach's template (exercises) and each
-- client's own copy (client_exercises), plus duration_seconds on exercise_logs to
-- hold a time-based set (weight_kg/reps stay null for those rows, the same way
-- weight_kg already stays null for a pure rep-count set).

alter table public.exercises
  add column if not exists log_type text not null default 'svoris'
    check (log_type in ('svoris', 'kartai', 'laikas'));

alter table public.client_exercises
  add column if not exists log_type text not null default 'svoris'
    check (log_type in ('svoris', 'kartai', 'laikas'));

alter table public.exercise_logs
  add column if not exists duration_seconds integer;

-- Pilnas assign_program() perrašymas -- vienintelis pakeitimas nuo supersetai.sql
-- versijos yra log_type kopijavimas.
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
         superset_with_previous, log_type, position)
      values
        (v_new_day, v_exercise.title, v_exercise.target_sets, v_exercise.target_reps,
         v_exercise.target_load, v_exercise.rest_seconds, v_exercise.notes, v_exercise.video_url,
         v_exercise.superset_with_previous, v_exercise.log_type, v_exercise.position);
    end loop;
  end loop;

  return v_client_program;
end;
$$;
