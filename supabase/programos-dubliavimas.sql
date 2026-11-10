-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin()) and
-- treniruociu-programos.sql (programs, program_sections, exercises) to
-- already exist.
--
-- WHY THIS FILE EXISTS
-- Building a variation of an existing program (a phase 2, a lighter version
-- for a different client type) meant starting from a blank "Nauja programa"
-- and retyping every day and exercise by hand. This adds a one-click copy:
-- a full, independent duplicate of a program's days and exercises under a
-- new title, left as a draft so it never affects the original or anyone
-- already assigned to it.

create or replace function public.duplicate_program(p_program_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original    public.programs%rowtype;
  v_new_program uuid;
  v_section     record;
  v_new_section uuid;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  select * into v_original from public.programs where id = p_program_id;
  if not found then
    raise exception 'Programa nerasta' using errcode = 'P0002';
  end if;

  -- 'draft', nepriklausomai nuo originalo būsenos — dublikatas visada
  -- pradeda kaip juodraštis, kol treneris jo neperžiūri ir nepaskelbia pats.
  insert into public.programs (title, summary, status, created_by)
  values (v_original.title || ' (kopija)', v_original.summary, 'draft', (select auth.uid()))
  returning id into v_new_program;

  for v_section in
    select * from public.program_sections where program_id = p_program_id order by position
  loop
    insert into public.program_sections (program_id, title, notes, position)
    values (v_new_program, v_section.title, v_section.notes, v_section.position)
    returning id into v_new_section;

    insert into public.exercises
      (section_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
       superset_with_previous, log_type, position)
    select
      v_new_section, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
      superset_with_previous, log_type, position
    from public.exercises
    where section_id = v_section.id
    order by position;
  end loop;

  return v_new_program;
end;
$$;

revoke all on function public.duplicate_program(uuid) from public;
grant execute on function public.duplicate_program(uuid) to authenticated;
