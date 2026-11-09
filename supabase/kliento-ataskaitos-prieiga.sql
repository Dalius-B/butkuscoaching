-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin()) and
-- kliento-tipas.sql (plan_type, private.gali_pildyti_ataskaita(),
-- checkins_insert_own) to already exist.
--
-- WHY THIS FILE EXISTS
-- Weekly check-in access was tied 1:1 to plan_type = 'pilnas' — a
-- program-only client had no way to get it without the trainer switching
-- their whole package. This adds an independent per-client override, the
-- same pattern already used for uzduotys_ijungtos (see uzduotys.sql): a
-- boolean the trainer flips for one specific client, on top of whatever
-- plan_type they are on. Switching it on does not change plan_type or
-- anything else about the client's package.

alter table public.profiles
  add column if not exists patikrinimas_ijungtas boolean not null default false;

-- Pilnas paketas prieigą turi visada; be jo reikalingas atskiras įjungimas.
-- CREATE OR REPLACE, nes funkcija jau egzistuoja (kliento-tipas.sql) — čia
-- tik papildoma sąlyga, viskas kita nesikeičia.
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
      and (plan_type = 'pilnas' or patikrinimas_ijungtas)
  );
$$;

-- Trenerio jungiklis. Per funkciją, nes klientas negali rašyti į šį stulpelį.
create or replace function public.admin_set_patikrinimas(p_client uuid, p_ijungta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  update public.profiles set patikrinimas_ijungtas = p_ijungta where id = p_client;
end;
$$;

revoke all on function public.admin_set_patikrinimas(uuid, boolean) from public;
grant execute on function public.admin_set_patikrinimas(uuid, boolean) to authenticated;
