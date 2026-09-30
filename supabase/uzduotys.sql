-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin()).
--
-- "Užduotys" -- a private daily-challenges page (zona/uzduotys.html) for
-- close clients only. Nobody sees it by default: the trainer switches it on
-- per client (valdymas.html -> Klientai -> "Užduotys"), and the database
-- itself enforces that, not just the hidden menu link.
--
--   profiles.uzduotys_ijungtos   per-client on/off switch, only writable
--                                through admin_set_uzduotys() below
--   client_challenges            the challenges the trainer set for a client
--   challenge_completions        one row per challenge per day the client ticked
--
-- XP is copied from the challenge onto the completion by a trigger, so a
-- client can never award themselves more XP, and later edits to a challenge
-- do not rewrite their history.

alter table public.profiles
  add column if not exists uzduotys_ijungtos boolean not null default false;

-- Ar dabartinis žmogus turi įjungtas užduotis.
create or replace function private.gali_uzduotys()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and uzduotys_ijungtos
      and status = 'active'
  );
$$;

-- Šiandienos data Lietuvoje. Klientas ir serveris turi sutarti dėl "šiandien",
-- kad telefonas kitoje laiko juostoje nesugadintų serijos.
create or replace function private.siandien_lt()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Vilnius')::date;
$$;

revoke all on function private.gali_uzduotys() from public;
revoke all on function private.siandien_lt()   from public;
grant execute on function private.gali_uzduotys() to authenticated;
grant execute on function private.siandien_lt()   to authenticated;

-- Trenerio jungiklis. Per funkciją, nes klientas negali rašyti į šį stulpelį.
create or replace function public.admin_set_uzduotys(p_client uuid, p_ijungta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  update public.profiles set uzduotys_ijungtos = p_ijungta where id = p_client;
end;
$$;

revoke all on function public.admin_set_uzduotys(uuid, boolean) from public;
grant execute on function public.admin_set_uzduotys(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
--  Užduotys
--  weekdays: ISO savaitės dienos, 1 = pirmadienis ... 7 = sekmadienis.
-- -----------------------------------------------------------------------------
create table if not exists public.client_challenges (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  category    text not null default 'iprociai'
    check (category in ('judejimas', 'mityba', 'vanduo', 'miegas', 'proto_ramybe', 'iprociai')),
  xp          integer not null default 10 check (xp between 1 and 500),
  is_bonus    boolean not null default false,
  weekdays    smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) > 0 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.challenge_completions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.client_challenges (id) on delete cascade,
  day          date not null,
  xp           integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (challenge_id, day)
);

create index if not exists client_challenges_client_idx on public.client_challenges (client_id);
create index if not exists challenge_completions_client_day_idx on public.challenge_completions (client_id, day);

-- XP nukopijuojamas iš užduoties, o užduotis privalo priklausyti tam pačiam
-- klientui ir būti aktyvi.
create or replace function private.uzpildyk_atlikima()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.client_challenges%rowtype;
begin
  select * into v from public.client_challenges where id = new.challenge_id;
  if not found or v.client_id <> new.client_id then
    raise exception 'Užduotis nerasta' using errcode = 'P0002';
  end if;
  if not v.active then
    raise exception 'Užduotis išjungta' using errcode = 'P0001';
  end if;
  new.xp := v.xp;
  return new;
end;
$$;

drop trigger if exists challenge_completions_fill on public.challenge_completions;
create trigger challenge_completions_fill
  before insert on public.challenge_completions
  for each row execute function private.uzpildyk_atlikima();

-- -----------------------------------------------------------------------------
--  Teisės ir eilučių apsauga
-- -----------------------------------------------------------------------------
alter table public.client_challenges     enable row level security;
alter table public.challenge_completions enable row level security;

revoke all on public.client_challenges     from anon, authenticated;
revoke all on public.challenge_completions from anon, authenticated;

grant select, insert, update, delete on public.client_challenges     to authenticated;
grant select, insert, delete         on public.challenge_completions to authenticated;

drop policy if exists "client_challenges_select" on public.client_challenges;
create policy "client_challenges_select" on public.client_challenges
  for select to authenticated
  using (
    private.is_admin()
    or (client_id = (select auth.uid()) and private.gali_uzduotys())
  );

drop policy if exists "client_challenges_admin_write" on public.client_challenges;
create policy "client_challenges_admin_write" on public.client_challenges
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "challenge_completions_select" on public.challenge_completions;
create policy "challenge_completions_select" on public.challenge_completions
  for select to authenticated
  using (
    private.is_admin()
    or (client_id = (select auth.uid()) and private.gali_uzduotys())
  );

-- Pažymėti galima tik savo užduotį ir tik šiandien.
drop policy if exists "challenge_completions_insert_own" on public.challenge_completions;
create policy "challenge_completions_insert_own" on public.challenge_completions
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  );

-- Klaidingą žymėjimą galima atšaukti, bet tik šiandienos.
drop policy if exists "challenge_completions_delete_own" on public.challenge_completions;
create policy "challenge_completions_delete_own" on public.challenge_completions
  for delete to authenticated
  using (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  );

drop policy if exists "challenge_completions_admin_delete" on public.challenge_completions;
create policy "challenge_completions_admin_delete" on public.challenge_completions
  for delete to authenticated
  using (private.is_admin());
