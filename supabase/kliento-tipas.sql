-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin(),
-- redeem_invite()) and checkins-zona-integracija.sql (checkins_insert_own)
-- to already exist.
--
-- Introduces two client plan types:
--   'pilnas'        -- full coaching: programs, history, AND the weekly
--                      check-in (savaitinė ataskaita)
--   'tik_programa'  -- program only: programs and history, no check-in
--
-- The trainer picks the type when creating an invite (valdymas.html,
-- Kvietimai tab). It is copied onto the client's profile the moment they
-- redeem that invite, and from then on controls both what the nav bar shows
-- them (rodykNav() in app.js) and, here, whether the database will actually
-- accept a checkins row from them -- hiding the link is not real access
-- control on its own, a program-only client could otherwise still POST
-- straight to the API.
--
-- Existing invites/profiles get 'pilnas' by default, so nobody who already
-- has check-in access loses it when this runs.

alter table public.invites
  add column if not exists plan_type text not null default 'pilnas'
    check (plan_type in ('pilnas', 'tik_programa'));

alter table public.profiles
  add column if not exists plan_type text not null default 'pilnas'
    check (plan_type in ('pilnas', 'tik_programa'));

-- Pilnas redeem_invite() perrašymas -- vienintelis pakeitimas nuo
-- duomenu-baze.sql versijos yra plan_type kopijavimas kartu su full_name.
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
     set status    = 'active',
         full_name = coalesce(nullif(full_name, ''), v_invite.full_name, ''),
         plan_type = v_invite.plan_type
   where id = v_uid
     and status = 'pending';
end;
$$;

-- Ar dabartinis prisijungęs žmogus gali pildyti savaitinę ataskaitą.
create or replace function private.gali_pildyti_ataskaita()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and plan_type = 'pilnas'
  );
$$;

drop policy if exists "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins
  for insert
  to authenticated
  with check (auth.uid() = user_id and private.gali_pildyti_ataskaita());
