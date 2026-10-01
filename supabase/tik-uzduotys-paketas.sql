-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs kliento-tipas.sql (plan_type columns,
-- redeem_invite()), uzduotys.sql (uzduotys_ijungtos) and pratimo-tipas.sql
-- (assign_program() with log_type) to already exist.
--
-- A third plan_type: 'tik_uzduotys' -- a client who gets ONLY the daily
-- challenges page, nothing else (no programs, no history, no weekly
-- check-in). Picked the same way as the other two, when the trainer
-- creates an invite. Redeeming it also turns uzduotys_ijungtos on
-- automatically, so the trainer doesn't have to flip that switch
-- separately right after. Programs still cannot be assigned to this kind
-- of client even by direct RPC call, not just because the button is
-- hidden -- same "don't rely on the UI alone" rule as checkins already
-- follows for plan_type.

alter table public.invites drop constraint if exists invites_plan_type_check;
alter table public.invites add constraint invites_plan_type_check
  check (plan_type in ('pilnas', 'tik_programa', 'tik_uzduotys'));

alter table public.profiles drop constraint if exists profiles_plan_type_check;
alter table public.profiles add constraint profiles_plan_type_check
  check (plan_type in ('pilnas', 'tik_programa', 'tik_uzduotys'));

-- Pilnas redeem_invite() perrašymas -- vienintelis pakeitimas nuo
-- kliento-tipas.sql versijos yra automatinis uzduotys_ijungtos įjungimas
-- "tik užduotys" paketui.
create or replace function public.redeem_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_uid    uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Neprisijungta' using errcode = '28000';
  end if;

  select * into v_invite from public.invites where token = p_token for update;

  if not found then
    raise exception 'Kvietimas nerastas' using errcode = 'P0002';
  end if;

  if v_invite.used_by is not null and v_invite.used_by <> v_uid then
    raise exception 'Kvietimas jau panaudotas' using errcode = 'P0001';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Kvietimo galiojimas pasibaigė' using errcode = 'P0001';
  end if;

  if (select pr.status from public.profiles pr where pr.id = v_uid) = 'blocked' then
    raise exception 'Prieiga sustabdyta' using errcode = 'P0001';
  end if;

  if v_invite.email is not null and v_invite.email <> '' then
    if lower(v_invite.email) <> lower(coalesce(
         (select u.email from auth.users u where u.id = v_uid), ''))
    then
      raise exception 'Kvietimas skirtas kitam el. pašto adresui' using errcode = 'P0001';
    end if;
  end if;

  update public.invites
     set used_by = v_uid, used_at = now()
   where id = v_invite.id;

  update public.profiles
     set status            = 'active',
         full_name         = coalesce(nullif(full_name, ''), v_invite.full_name, ''),
         plan_type         = v_invite.plan_type,
         uzduotys_ijungtos = uzduotys_ijungtos or (v_invite.plan_type = 'tik_uzduotys')
   where id = v_uid
     and status = 'pending';
end;
$$;

-- Pilnas assign_program() perrašymas -- vienintelis pakeitimas nuo
-- pratimo-tipas.sql versijos yra apsauga nuo priskyrimo "tik užduotys"
-- klientui.
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

  if (select plan_type from public.profiles where id = p_client_id) = 'tik_uzduotys' then
    raise exception 'Šis klientas turi tik užduočių paketą -- programos nepriskiriamos' using errcode = '42501';
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
