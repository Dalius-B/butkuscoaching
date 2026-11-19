-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin()),
-- treniruociu-programos.sql (programs, program_sections, exercises) and
-- klientu-kopijos.sql (client_programs, client_days, client_exercises) to
-- already exist.
--
-- WHY THIS FILE EXISTS
-- A program assigned to a client is copied once (assign_program()) and then
-- lives independently — the usual next step for a client-specific tweak is
-- editing straight on the client's own copy. That's fine until the trainer
-- wants to reuse that now-adjusted version: it was never a template, so
-- there was nothing to duplicate (duplicate_program() only works on
-- public.programs) and no way to re-assign it to a different client. This
-- adds the missing direction: take a client's current program exactly as it
-- stands and save it as a brand new reusable template, which can then be
-- duplicated (programos-dubliavimas.sql) or assigned to anyone
-- (assign_program(), kliento-tipas.sql) like any other.
--
-- Hidden exercises (pratimo-slepimas.sql) are deliberately left out of the
-- copy: is_hidden marks something the trainer removed from what the client
-- currently sees, so the template should reflect the active plan, not what
-- used to be in it.

create or replace function public.save_client_program_as_template(p_client_program_id uuid, p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_program public.client_programs%rowtype;
  v_new_program    uuid;
  v_day            record;
  v_new_section    uuid;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  select * into v_client_program from public.client_programs where id = p_client_program_id;
  if not found then
    raise exception 'Kliento programa nerasta' using errcode = 'P0002';
  end if;

  insert into public.programs (title, summary, status, created_by)
  values (
    coalesce(nullif(trim(p_title), ''), v_client_program.title || ' (šablonas)'),
    '', 'draft', (select auth.uid())
  )
  returning id into v_new_program;

  for v_day in
    select * from public.client_days where client_program_id = p_client_program_id order by position
  loop
    insert into public.program_sections (program_id, title, notes, position)
    values (v_new_program, v_day.title, v_day.notes, v_day.position)
    returning id into v_new_section;

    insert into public.exercises
      (section_id, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
       superset_with_previous, log_type, position)
    select
      v_new_section, title, target_sets, target_reps, target_load, rest_seconds, notes, video_url,
      superset_with_previous, log_type, position
    from public.client_exercises
    where client_day_id = v_day.id
      and coalesce(is_hidden, false) = false
    order by position;
  end loop;

  return v_new_program;
end;
$$;

revoke all on function public.save_client_program_as_template(uuid, text) from public;
grant execute on function public.save_client_program_as_template(uuid, text) to authenticated;
