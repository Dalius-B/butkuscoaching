-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql (and duomenu-baze.sql for private.is_admin()).
--
-- Planned rest days: the trainer marks a date as a rest day for one client
-- (travel, a hard week, recovery). On that date the client sees "poilsio diena"
-- instead of tasks, and the day does not count against their weekly percentage.
--
--   rest_days   one row per client per date. The client can only READ their own
--               rows; only the trainer writes, through admin_poilsio_diena().

create table if not exists public.rest_days (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  unique (client_id, day)
);

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
