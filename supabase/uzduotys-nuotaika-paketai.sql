-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql, uzduotys-progresas.sql and
-- uzduotys-video.sql to have been run first (and duomenu-baze.sql for
-- private.is_admin() / public.touch_updated_at()).
--
-- Three things for the Užduotys feature:
--
--   1. day_notes        the client's one-tap mood for the day plus an optional
--                       text, and the trainer's short reply to it. The client
--                       can only write mood + note, and only for today; the
--                       reply is written only through admin_atsakyti() below.
--   2. task_packs       ready-made, trainer-editable sets of tasks
--      task_pack_items  (e.g. "Švelnus startas"), copied onto a client with
--                       admin_priskirti_paketa(). Trainer-only tables: clients
--                       cannot read them.
--   3. a few starter packs, written to be gentle and non-judgemental.
--
-- Points (xp) are no longer shown anywhere. The xp columns stay in the
-- database untouched so no history is lost.

-- -----------------------------------------------------------------------------
--  1. Nuotaika ir žinutės
-- -----------------------------------------------------------------------------
create table if not exists public.day_notes (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles (id) on delete cascade,
  day              date not null,
  mood             smallint check (mood between 1 and 5),
  note             text not null default '' check (char_length(note) <= 500),
  coach_reply      text not null default '' check (char_length(coach_reply) <= 300),
  coach_replied_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_id, day)
);

create index if not exists day_notes_client_day_idx on public.day_notes (client_id, day);

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

alter table public.day_notes enable row level security;
revoke all on public.day_notes from anon, authenticated;

grant select                              on public.day_notes to authenticated;
grant insert (client_id, day, mood, note) on public.day_notes to authenticated;
grant update (mood, note)                 on public.day_notes to authenticated;

drop policy if exists "day_notes_select" on public.day_notes;
create policy "day_notes_select" on public.day_notes
  for select to authenticated
  using (
    private.is_admin()
    or (client_id = (select auth.uid()) and private.gali_uzduotys())
  );

-- Klientas gali rašyti tik apie šiandieną.
drop policy if exists "day_notes_insert_own" on public.day_notes;
create policy "day_notes_insert_own" on public.day_notes
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  );

drop policy if exists "day_notes_update_own" on public.day_notes;
create policy "day_notes_update_own" on public.day_notes
  for update to authenticated
  using (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  )
  with check (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  );

-- Trenerio trumpas atsakymas. Per funkciją, nes klientas negali rašyti į šį stulpelį.
-- Tuščias tekstas atsakymą ištrina.
create or replace function public.admin_atsakyti(p_client uuid, p_day date, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply text := btrim(coalesce(p_reply, ''));
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if char_length(v_reply) > 300 then
    raise exception 'Žinutė per ilga (daugiausia 300 simbolių)' using errcode = 'P0001';
  end if;

  insert into public.day_notes (client_id, day, coach_reply, coach_replied_at)
  values (p_client, p_day, v_reply, case when v_reply = '' then null else now() end)
  on conflict (client_id, day) do update
    set coach_reply      = excluded.coach_reply,
        coach_replied_at = excluded.coach_replied_at;
end;
$$;

revoke all on function public.admin_atsakyti(uuid, date, text) from public;
grant execute on function public.admin_atsakyti(uuid, date, text) to authenticated;

-- -----------------------------------------------------------------------------
--  2. Užduočių paketai (tik treneriui)
-- -----------------------------------------------------------------------------
create table if not exists public.task_packs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists task_packs_name_idx on public.task_packs (lower(name));

create table if not exists public.task_pack_items (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.task_packs (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  category    text not null default 'iprociai'
    check (category in ('judejimas', 'mityba', 'vanduo', 'miegas', 'proto_ramybe', 'iprociai')),
  target      integer not null default 1 check (target between 1 and 100000),
  unit        text not null default '' check (char_length(unit) <= 30),
  step        integer not null default 1 check (step between 1 and 100000),
  is_bonus    boolean not null default false,
  weekdays    smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) > 0 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  video_url   text not null default ''
    check (video_url = '' or (video_url ~* '^https://' and char_length(video_url) <= 500)),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists task_pack_items_pack_idx on public.task_pack_items (pack_id);

alter table public.task_packs      enable row level security;
alter table public.task_pack_items enable row level security;
revoke all on public.task_packs      from anon, authenticated;
revoke all on public.task_pack_items from anon, authenticated;
grant select, insert, update, delete on public.task_packs      to authenticated;
grant select, insert, update, delete on public.task_pack_items to authenticated;

drop policy if exists "task_packs_admin_all" on public.task_packs;
create policy "task_packs_admin_all" on public.task_packs
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "task_pack_items_admin_all" on public.task_pack_items;
create policy "task_pack_items_admin_all" on public.task_pack_items
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Paketo užduotys nukopijuojamos klientui. Jau esančios (to paties pavadinimo)
-- praleidžiamos, kad dukart paspaudus nesusidubliuotų. Grąžina, kiek pridėta.
create or replace function public.admin_priskirti_paketa(p_client uuid, p_pack uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start integer;
  v_added integer;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_client) then
    raise exception 'Klientas nerastas' using errcode = 'P0002';
  end if;

  select coalesce(max(position), -1) + 1 into v_start
    from public.client_challenges where client_id = p_client;

  with nauji as (
    insert into public.client_challenges
      (client_id, title, description, category, target, unit, step, is_bonus, weekdays, video_url, position)
    select p_client, i.title, i.description, i.category, i.target, i.unit, i.step,
           i.is_bonus, i.weekdays, i.video_url,
           v_start + (row_number() over (order by i.position, i.created_at))::integer - 1
      from public.task_pack_items i
     where i.pack_id = p_pack
       and not exists (
         select 1 from public.client_challenges c
          where c.client_id = p_client and c.active and lower(c.title) = lower(i.title)
       )
    returning 1
  )
  select count(*) into v_added from nauji;

  return v_added;
end;
$$;

-- Kliento dabartinės užduotys išsaugomos kaip naujas paketas.
create or replace function public.admin_issaugoti_paketa(p_client uuid, p_name text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;

  insert into public.task_packs (name, description, position)
  values (btrim(p_name), coalesce(btrim(p_description), ''),
          (select coalesce(max(position), -1) + 1 from public.task_packs))
  returning id into v_id;

  insert into public.task_pack_items
    (pack_id, title, description, category, target, unit, step, is_bonus, weekdays, video_url, position)
  select v_id, c.title, c.description, c.category, c.target, c.unit, c.step,
         c.is_bonus, c.weekdays, c.video_url, c.position
    from public.client_challenges c
   where c.client_id = p_client and c.active;

  return v_id;
end;
$$;

revoke all on function public.admin_priskirti_paketa(uuid, uuid)       from public;
revoke all on function public.admin_issaugoti_paketa(uuid, text, text) from public;
grant execute on function public.admin_priskirti_paketa(uuid, uuid)       to authenticated;
grant execute on function public.admin_issaugoti_paketa(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
--  3. Pradiniai paketai (sukuriami tik jei tokio pavadinimo dar nėra)
--  Formuluotės be giminės, švelnios, be kaltinimo. Trenerio redaguojami.
--  Elementas: [pavadinimas, kategorija, kiekis, vienetas, žingsnis, papildoma, dienos|null, aprašymas]
-- -----------------------------------------------------------------------------
create or replace function pg_temp.sukurk_paketa(p_name text, p_desc text, p_pos integer, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_id uuid;
  v_it jsonb;
  v_i integer := 0;
begin
  if exists (select 1 from public.task_packs where lower(name) = lower(p_name)) then
    return;
  end if;
  insert into public.task_packs (name, description, position)
  values (p_name, p_desc, p_pos) returning id into v_id;

  for v_it in select * from jsonb_array_elements(p_items) loop
    insert into public.task_pack_items
      (pack_id, title, description, category, target, unit, step, is_bonus, weekdays, position)
    values (
      v_id,
      v_it ->> 0,
      coalesce(v_it ->> 7, ''),
      v_it ->> 1,
      (v_it ->> 2)::integer,
      coalesce(v_it ->> 3, ''),
      (v_it ->> 4)::integer,
      (v_it ->> 5)::boolean,
      case when jsonb_typeof(v_it -> 6) = 'array'
        then (select array_agg(x::smallint) from jsonb_array_elements_text(v_it -> 6) x)
        else '{1,2,3,4,5,6,7}'::smallint[]
      end,
      v_i
    );
    v_i := v_i + 1;
  end loop;
end;
$$;

select pg_temp.sukurk_paketa(
  'Švelnus startas',
  'Mažiausi žingsniai pradžiai. Mažai užduočių, kad nebūtų slegiama. Tinka tiems, kam svarbiausia pradėti ir nepersistengti.',
  0,
  '[
    ["Išgerk 6 stiklines vandens","vanduo",6,"stiklinių",1,false,null,"1 stiklinė yra apie 250 ml"],
    ["Pasivaikščiok lauke","judejimas",15,"min.",5,false,null,"Lėtu tempu, kaip patinka"],
    ["Užsirašyk vieną gerą dalyką, kuris šiandien nutiko","proto_ramybe",1,"",1,false,null,""],
    ["Prieš miegą 15 minučių be telefono","miegas",1,"",1,false,null,""],
    ["Atlik 5 minučių lengvą tempimo pratimą","judejimas",1,"",1,true,null,""]
  ]'::jsonb
);

select pg_temp.sukurk_paketa(
  'Vaikščiojimo įprotis',
  'Vaikščiojimas kaip pagrindas: žingsniai, pasivaikščiojimai lauke ir šiek tiek tempimo. Papildomos užduotys neprivalomos.',
  1,
  '[
    ["Nužingsniuok 6 000 žingsnių","judejimas",6000,"žingsnių",1000,false,null,"Galima daryti per dieną dalimis"],
    ["Pasivaikščiok lauke","judejimas",30,"min.",10,false,null,""],
    ["Atlik 5 minučių lengvą tempimo pratimą","judejimas",1,"",1,false,[1,3,5],""],
    ["Išgerk 8 stiklines vandens","vanduo",8,"stiklinių",1,false,null,""],
    ["Nužingsniuok 8 000 žingsnių","judejimas",8000,"žingsnių",1000,true,null,"Jei jėgų daugiau nei įprastai"],
    ["Pasivaikščiok su draugu ar šeimos nariu","judejimas",1,"",1,true,[6,7],""]
  ]'::jsonb
);

select pg_temp.sukurk_paketa(
  'Gera nuotaika',
  'Maži, švelnūs dalykai nuotaikai palaikyti: šviesa, žmonės, kvėpavimas ir malonumas. Be spaudimo.',
  2,
  '[
    ["Pabūk lauke dienos šviesoje","proto_ramybe",15,"min.",5,false,null,"Net ir apsiniaukusią dieną šviesa naudinga"],
    ["Užsirašyk 3 dalykus, už kuriuos šiandien dėkoji","proto_ramybe",1,"",1,false,null,""],
    ["Parašyk ar paskambink artimam žmogui","proto_ramybe",1,"",1,false,[2,4,6],""],
    ["Ramiai pakvėpuok 5 minutes","proto_ramybe",1,"",1,false,null,""],
    ["Padaryk vieną dalyką, kuris tau teikia malonumą","proto_ramybe",1,"",1,false,null,"Muzika, kava, kūryba, kas patinka"],
    ["Pamedituok 10 minučių","proto_ramybe",1,"",1,true,null,""]
  ]'::jsonb
);

select pg_temp.sukurk_paketa(
  'Geresnis miegas',
  'Paprastas vakaro ir ryto režimas miegui pagerinti.',
  3,
  '[
    ["Eik miegoti iki 23:00","miegas",1,"",1,false,null,""],
    ["Prieš miegą 30 minučių be telefono","miegas",1,"",1,false,null,""],
    ["Kelkis kiekvieną dieną tuo pačiu laiku","miegas",1,"",1,false,null,""],
    ["Po 15:00 negerk kavos","miegas",1,"",1,false,null,""],
    ["Prieš miegą išgerk ramunėlių arbatos","miegas",1,"",1,true,null,""]
  ]'::jsonb
);

select pg_temp.sukurk_paketa(
  'Sveikesnė mityba',
  'Keli paprasti mitybos įpročiai be skaičiavimų ir griežtų draudimų.',
  4,
  '[
    ["Išgerk 8 stiklines vandens","vanduo",8,"stiklinių",1,false,null,""],
    ["Pusę lėkštės užpildyk daržovėmis","mityba",1,"",1,false,null,""],
    ["Suvalgyk baltymų kiekvieno valgio metu","mityba",1,"",1,false,null,"Kiaušiniai, jogurtas, varškė, mėsa, žuvis"],
    ["Šiandien negerk saldžių gėrimų","mityba",1,"",1,false,null,""],
    ["Valgyk lėtai, be telefono ir televizoriaus","mityba",1,"",1,false,null,""],
    ["Pasiruošk sveiką maistą rytdienai","mityba",1,"",1,true,null,""]
  ]'::jsonb
);
