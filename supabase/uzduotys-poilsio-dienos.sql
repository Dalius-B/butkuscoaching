-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql (and duomenu-baze.sql for private.is_admin()).
--
-- Planned rest days: a date marked as a rest day for one client (travel, family
-- holiday, recovery). On that date the client sees "poilsio diena" instead of
-- tasks, and the day does not count against their weekly percentage.
--
--   rest_days   one row per client per date. Nobody writes it directly.
--               The trainer uses admin_poilsio_diena() (any date).
--               The client uses klientas_poilsio_dienos(): only today or later,
--               at most 30 days at a time and 120 days ahead, and they can only
--               remove days they added themselves (set_by = 'klientas').

create table if not exists public.rest_days (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  unique (client_id, day)
);

alter table public.rest_days
  add column if not exists set_by text not null default 'treneris';
alter table public.rest_days drop constraint if exists rest_days_set_by_check;
alter table public.rest_days add constraint rest_days_set_by_check check (set_by in ('treneris', 'klientas'));

create index if not exists rest_days_client_day_idx on public.rest_days (client_id, day);

alter table public.rest_days enable row level security;

grant select on public.rest_days to authenticated;

drop policy if exists rest_days_select on public.rest_days;
create policy rest_days_select on public.rest_days
  for select to authenticated
  using (
    private.is_admin()
    or (client_id = (select auth.uid()) and private.gali_uzduotys())
  );

-- Trenerio veiksmas: pažymėti arba nuimti poilsio dieną.
create or replace function public.admin_poilsio_diena(p_client uuid, p_day date, p_poilsis boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if p_poilsis then
    insert into public.rest_days (client_id, day) values (p_client, p_day)
    on conflict (client_id, day) do nothing;
  else
    delete from public.rest_days where client_id = p_client and day = p_day;
  end if;
end;
$$;

revoke all on function public.admin_poilsio_diena(uuid, date, boolean) from public;
grant execute on function public.admin_poilsio_diena(uuid, date, boolean) to authenticated;

-- Kliento veiksmas: pažymėti arba nuimti savo poilsio dienas (nuo šiandien į priekį).
-- p_iki gali būti tuščias (viena diena). Nuimti galima tik pačiam klientui pažymėtas dienas.
create or replace function public.klientas_poilsio_dienos(p_nuo date, p_iki date, p_poilsis boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_siandien date := private.siandien_lt();
  v_iki date := coalesce(p_iki, p_nuo);
begin
  if v_uid is null or not private.gali_uzduotys() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if p_nuo is null or v_iki < p_nuo then
    raise exception 'Patikrink datas' using errcode = '22023';
  end if;
  if p_nuo < v_siandien then
    raise exception 'Praėjusių dienų keisti negalima' using errcode = '22023';
  end if;
  if v_iki - p_nuo > 30 or v_iki > v_siandien + 120 then
    raise exception 'Pasirink trumpesnį laikotarpį (iki 31 dienos) ir ne toliau kaip 4 mėnesiai į priekį' using errcode = '22023';
  end if;

  if p_poilsis then
    insert into public.rest_days (client_id, day, set_by)
    select v_uid, d::date, 'klientas'
      from generate_series(p_nuo, v_iki, interval '1 day') d
    on conflict (client_id, day) do nothing;
  else
    delete from public.rest_days
     where client_id = v_uid and set_by = 'klientas' and day between p_nuo and v_iki;
  end if;
end;
$$;

revoke all on function public.klientas_poilsio_dienos(date, date, boolean) from public;
grant execute on function public.klientas_poilsio_dienos(date, date, boolean) to authenticated;
