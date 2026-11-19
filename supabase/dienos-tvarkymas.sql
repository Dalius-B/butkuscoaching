-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin()),
-- treniruociu-programos.sql (program_sections, exercises) and
-- klientu-kopijos.sql (client_days, client_exercises) to already exist.
--
-- WHY THIS FILE EXISTS
-- The program editors (redaguoti.html for templates, valdymas.html's
-- client-copy editor) had no way to duplicate a single day or delete one day
-- from an already-assigned client copy -- only whole-program actions existed
-- (duplicate_program, save_client_program_as_template, and deleting the
-- entire client_programs row). Reordering days needs NO new SQL here: it
-- reuses the exact same plain .update({position}) pattern exercises already
-- use, which program_sections and client_days are already granted (see
-- treniruociu-programos.sql and kliento-programos-redagavimas.sql).
--
-- What was actually missing:
--   1. Duplicating one day (with its exercises) within the same program.
--   2. Deleting one day from a CLIENT's copy. program_sections already
--      allows delete; client_days never did, on purpose, per
--      kliento-programos-redagavimas.sql's reasoning that adding/removing
--      whole days was a big enough change to warrant re-assigning from a
--      template instead. That reasoning already broke down for INSERT (see
--      kliento-dienos-pridejimas.sql) and breaks down the same way here: an
--      editor that lets a trainer ADD a day and REORDER days but never
--      remove one added by mistake is an inconsistent trap.

grant delete on public.client_days to authenticated;

drop policy if exists "client_days_admin_delete" on public.client_days;
create policy "client_days_admin_delete" on public.client_days
  for delete to authenticated
  using (private.is_admin());

-- Duplicate one day of a TEMPLATE program (program_sections + its exercises),
-- appended as the last day of the same program.
create or replace function public.duplicate_program_section(p_section_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section     public.program_sections%rowtype;
  v_new_section uuid;
  v_next_pos    integer;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  select * into v_section from public.program_sections where id = p_section_id;
  if not found then
    raise exception 'Diena nerasta' using errcode = 'P0002';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.program_sections where program_id = v_section.program_id;

  insert into public.program_sections (program_id, title, notes, position)
  values (v_section.program_id, v_section.title || ' (kopija)', v_section.notes, v_next_pos)
  returning id into v_new_section;

  insert into public.exercises
    (section_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
     superset_with_previous, log_type, position)
  select
    v_new_section, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
    superset_with_previous, log_type, position
  from public.exercises
  where section_id = p_section_id
  order by position;

  return v_new_section;
end;
$$;

revoke all on function public.duplicate_program_section(uuid) from public;
grant execute on function public.duplicate_program_section(uuid) to authenticated;

-- Duplicate one day of a CLIENT's own program copy (client_days +
-- client_exercises), appended as the last day of the same copy. Hidden
-- exercises (is_hidden) are left out, same reasoning as
-- save_client_program_as_template: the duplicate should reflect what the
-- client currently sees, not what used to be in it.
create or replace function public.duplicate_client_day(p_client_day_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day      public.client_days%rowtype;
  v_new_day  uuid;
  v_next_pos integer;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  select * into v_day from public.client_days where id = p_client_day_id;
  if not found then
    raise exception 'Diena nerasta' using errcode = 'P0002';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.client_days where client_program_id = v_day.client_program_id;

  insert into public.client_days (client_program_id, title, notes, position)
  values (v_day.client_program_id, v_day.title || ' (kopija)', v_day.notes, v_next_pos)
  returning id into v_new_day;

  insert into public.client_exercises
    (client_day_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
     superset_with_previous, log_type, position)
  select
    v_new_day, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
    superset_with_previous, log_type, position
  from public.client_exercises
  where client_day_id = p_client_day_id
    and coalesce(is_hidden, false) = false
  order by position;

  return v_new_day;
end;
$$;

revoke all on function public.duplicate_client_day(uuid) from public;
grant execute on function public.duplicate_client_day(uuid) to authenticated;
