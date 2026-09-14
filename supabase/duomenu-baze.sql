-- =============================================================================
--  BUTKUS COACHING, KLIENTŲ ZONA
--  Schema, teisės, apsauga ir failų saugykla.
--
--  KAIP PALEISTI
--  Supabase skydelis, kairėje "SQL Editor", "New query", įklijuok visą failą,
--  paspausk "Run". Failą galima paleisti kelis kartus, duomenys neištrinami.
--
--  PO PALEIDIMO atlik 15 dalį, kitaip niekas neturės trenerio teisių.
--
--  KODĖL VISKAS TAIP GRIEŽTAI
--  Publikuojamas raktas guli naršyklėje ir viešame kode. Tai normalu ir taip
--  suprojektuota, bet tik su viena sąlyga: kiekviena lentelė turi įjungtą
--  eilučių apsaugą. Šis failas ją įjungia visoms lentelėms be išimties.
-- =============================================================================


-- =============================================================================
--  1. PRIVATI SCHEMA PAGALBINĖMS FUNKCIJOMS
--
--  Supabase per API atveria tik "public" schemą. Viskas, kas guli "public" ir
--  yra funkcija, tampa kviečiama iš naršyklės su publikuojamu raktu. Todėl
--  vidinės apsaugos funkcijos laikomos atskiroje schemoje, kurios API nemato.
-- =============================================================================
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;


-- =============================================================================
--  2. PROFILIAI
--
--  Rolės čia NĖRA tyčia. Eilučių apsauga veikia eilutės, o ne stulpelio lygiu,
--  todėl bet kuris klientas, galintis keisti savo eilutę, galėtų perrašyti ir
--  rolės stulpelį ir tapti treneriu. Rolė laikoma atskiroje lentelėje, kurios
--  naršyklė nepasiekia visiškai.
--
--  status  'pending' užsiregistravo, kvietimas dar nepanaudotas
--          'active'  pilnavertis klientas
--          'blocked' prieiga sustabdyta
-- =============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  phone       text,
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =============================================================================
--  3. ROLĖS
--
--  Ši lentelė neturi jokių teisių nei anonimam, nei prisijungusiam vartotojui.
--  Jos negalima nei perskaityti, nei pakeisti iš naršyklės. Ją mato tik
--  security definer funkcijos ir SQL redaktorius.
-- =============================================================================
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('admin')),
  granted_at timestamptz not null default now()
);



-- =============================================================================
--  4. KVIETIMAI
-- =============================================================================
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  email       text,
  full_name   text,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);


-- =============================================================================
--  5. PROGRAMOS
-- =============================================================================
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  summary     text not null default '',
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- =============================================================================
--  6. PROGRAMOS BLOKAI
-- =============================================================================
create table if not exists public.program_sections (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  title       text not null,
  notes       text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);


-- =============================================================================
--  7. PRIEDAI
--
--  kind 'file'       failas saugykloje, pavyzdžiui PDF
--       'video_file' vaizdo įrašas saugykloje
--       'video_link' nuoroda į YouTube arba Vimeo
-- =============================================================================
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs (id) on delete cascade,
  section_id    uuid references public.program_sections (id) on delete set null,
  kind          text not null check (kind in ('file', 'video_file', 'video_link')),
  title         text not null,
  description   text not null default '',
  storage_path  text,
  external_url  text,
  original_name text,
  mime_type     text,
  size_bytes    bigint,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint attachments_source_ck check (
    (kind in ('file', 'video_file') and storage_path is not null and external_url is null)
    or
    (kind = 'video_link' and external_url is not null and storage_path is null)
  )
);


-- =============================================================================
--  8. PRISKYRIMAI
-- =============================================================================
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'paused', 'finished')),
  note        text not null default '',
  starts_on   date,
  assigned_at timestamptz not null default now(),
  unique (program_id, client_id)
);


-- =============================================================================
--  9. GYVYBĖS ŽENKLAS
--
--  Nemokamas Supabase projektas užmiega po septynių dienų be duomenų bazės
--  veiklos, o pats nuo lankytojo srauto nepabunda: jį reikia pažadinti ranka
--  skydelyje. Klientas, prisijungiantis kartą per savaitę, yra būtent ties ta
--  riba. Šią lentelę periodiškai perskaito .github/workflows/supabase-budrus.yml
--  ir projektas lieka gyvas. Užklausos pakanka, rašyti čia nieko nereikia,
--  todėl lentelė turi tik skaitymo teisę.
-- =============================================================================
create table if not exists public.keepalive (
  id         integer primary key default 1,
  touched_at timestamptz not null default now(),
  constraint keepalive_viena_eilute check (id = 1)
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;


-- =============================================================================
--  10. INDEKSAI
-- =============================================================================
create index if not exists assignments_client_idx  on public.assignments (client_id);
create index if not exists assignments_program_idx on public.assignments (program_id);
create index if not exists attachments_program_idx on public.attachments (program_id);
create index if not exists attachments_section_idx on public.attachments (section_id);
create index if not exists sections_program_idx    on public.program_sections (program_id);
create index if not exists invites_token_idx       on public.invites (token);


-- =============================================================================
--  11. FUNKCIJOS
-- =============================================================================

-- Ar dabartinis vartotojas yra treneris.
--
-- Trys dalykai čia yra būtini, ir kiekvienas lūžta savaip:
--   security definer   be jo funkcija skaitytų user_roles kliento teisėmis,
--                      o klientas tos lentelės nemato, tad visada gautų false
--   set search_path    be jo funkcija sukuriama, bet lūžta pirmą kartą iškviesta
--   privati schema     public schemoje ji taptų iš naršyklės kviečiama RPC
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid())
      and r.role = 'admin'
      and p.status <> 'blocked'
  );
$$;

-- Ar dabartinis vartotojas gali matyti konkrečią programą.
-- Ta pati funkcija naudojama ir lentelėse, ir failų saugykloje, todėl taisyklė
-- yra viena vienintelėje vietoje.
create or replace function private.has_program_access(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
      or exists (
        select 1
        from public.assignments a
        join public.programs pr on pr.id = a.program_id
        join public.profiles cl on cl.id = a.client_id
        where a.program_id = p_program_id
          and a.client_id  = (select auth.uid())
          and a.status     = 'active'
          and pr.status    = 'published'
          and cl.status    = 'active'
      );
$$;

-- Pirmas kelio segmentas paverčiamas programos id. Netinkamas kelias grąžina
-- null, o ne klaidą: Postgres negarantuoja, kad sąlygos bus tikrinamos iš eilės,
-- todėl atskira regex patikra tos pačios eilutės cast operacijos neapsaugotų.
create or replace function private.kelio_programa(p_kelias text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kelias ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then p_kelias::uuid
    else null
  end;
$$;

-- Naršyklei reikia žinoti, ar rodyti valdymo skydelį. Ši funkcija pasako tik
-- apie patį klausiantįjį, todėl ją saugu atverti.
create or replace function public.ar_treneris()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

-- Naujam vartotojui sukuria profilį.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at palaikymas.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists programs_touch on public.programs;
create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

-- Kvietimo patikra. Kviečiama dar neprisijungusio žmogaus.
create or replace function public.invite_info(p_token text)
returns table (valid boolean, email text, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (i.used_by is null and (i.expires_at is null or i.expires_at > now())),
    case when i.used_by is null then i.email     else null end,
    case when i.used_by is null then i.full_name else null end
  from public.invites i
  where i.token = p_token;
$$;

-- Kvietimo panaudojimas. Kviečiama jau prisijungusio vartotojo.
-- Funkcija vykdoma savininko teisėmis, todėl gali pakeisti status stulpelį,
-- kurio pats klientas keisti negali.
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

  -- Ta patį kvietimą leidžiame panaudoti pakartotinai TIK jo paties savininkui.
  -- To reikia tam atvejui, kai pirmas bandymas nutrūko dėl ryšio, o žymuo dar
  -- liko naršyklėje.
  if v_invite.used_by is not null and v_invite.used_by <> v_uid then
    raise exception 'Kvietimas jau panaudotas' using errcode = 'P0001';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Kvietimo galiojimas pasibaigė' using errcode = 'P0001';
  end if;

  -- Sustabdyta prieiga. Be šios patikros blokuotas klientas galėtų iš naujo
  -- panaudoti savo seną kvietimą ir taip pats sau grąžinti prieigą, nes ši
  -- funkcija yra vienintelė vieta, galinti rašyti status stulpelį.
  if (select pr.status from public.profiles pr where pr.id = v_uid) = 'blocked' then
    raise exception 'Prieiga sustabdyta' using errcode = 'P0001';
  end if;

  -- Jei kvietime nurodytas el. paštas, jis privalo sutapti. Kitaip nuoroda
  -- būtų tiesiog raktas, kurį persiuntus veiktų bet kam, nors registracijos
  -- forma žada, kad kvietimas skirtas būtent tam adresui.
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

  -- Tik iš 'pending'. Jau aktyviam žmogui čia keisti nieko nereikia, o
  -- blokuotas iki šios vietos nebeprieina.
  update public.profiles
     set status    = 'active',
         full_name = coalesce(nullif(full_name, ''), v_invite.full_name, '')
   where id = v_uid
     and status = 'pending';
end;
$$;

-- Kliento būsenos keitimas. Klientas savo status stulpelio keisti negali, nes
-- stulpelio teisės jam neduotos, todėl treneris tai daro per šią funkciją.
create or replace function public.admin_set_status(p_client uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'active', 'blocked') then
    raise exception 'Netinkama būsena' using errcode = '22023';
  end if;
  -- Treneris negali sustabdyti savęs. Priešingu atveju is_admin() imtų grąžinti
  -- false ir prieigą atkurti būtų įmanoma tik per SQL redaktorių.
  if p_client = (select auth.uid()) and p_status = 'blocked' then
    raise exception 'Savęs sustabdyti negalima' using errcode = 'P0001';
  end if;

  update public.profiles set status = p_status where id = p_client;
end;
$$;

-- Vykdymo teisės.
revoke all on function private.is_admin()                  from public;
revoke all on function private.has_program_access(uuid)    from public;
grant execute on function private.is_admin()               to authenticated;
grant execute on function private.has_program_access(uuid) to authenticated;
grant execute on function private.kelio_programa(text)     to authenticated;

-- Naujai sukurta funkcija Postgres yra vykdoma visiems. Pirma tai atimame,
-- tada duodame tik tiems, kam ji tikrai skirta.
revoke all on function public.ar_treneris()                from public;
revoke all on function public.invite_info(text)            from public;
revoke all on function public.redeem_invite(text)          from public;
revoke all on function public.admin_set_status(uuid, text) from public;

grant execute on function public.ar_treneris()                    to authenticated;
grant execute on function public.invite_info(text)                to anon, authenticated;
grant execute on function public.redeem_invite(text)              to authenticated;
grant execute on function public.admin_set_status(uuid, text)     to authenticated;


-- =============================================================================
--  12. TEISĖS IR EILUČIŲ APSAUGA
--
--  Nuo 2026 metų naujos lentelės nebėra automatiškai atveriamos API, todėl
--  teisės duodamos aiškiai. Teisės ir apsaugos taisyklės yra du skirtingi
--  dalykai, ir tikrinami abu: pirma teisės, paskui taisyklės.
--
--  Rašymo teisės duodamos visiems prisijungusiems, bet taisyklės jas leidžia
--  tik treneriui. Tai įprastas Supabase būdas.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- BŪTINA. Supabase projektuose galioja numatytosios teisės, kurios kiekvienai
-- naujai public schemos lentelei automatiškai atiduoda VISKĄ rolėms anon ir
-- authenticated. Tai reiškia, kad stulpelio lygio dovana žemiau būtų beprasmė:
-- platesnė lentelės teisė ją nustelbtų, ir klientas galėtų perrašyti savo
-- status stulpelį. Todėl pirma viską atimame ir tik tada duodame tiek, kiek reikia.
--
-- Patikrinta gyvai 2026-09-09: be šių eilučių klientas savo būseną pakeisdavo
-- paprasčiausia PATCH užklausa.
revoke all on public.profiles         from anon, authenticated;
revoke all on public.user_roles       from anon, authenticated;
revoke all on public.invites          from anon, authenticated;
revoke all on public.programs         from anon, authenticated;
revoke all on public.program_sections from anon, authenticated;
revoke all on public.attachments      from anon, authenticated;
revoke all on public.assignments      from anon, authenticated;
revoke all on public.keepalive        from anon, authenticated;

grant select                        on public.profiles         to authenticated;
grant update (full_name, phone)     on public.profiles         to authenticated;
grant select, insert, update, delete on public.programs         to authenticated;
grant select, insert, update, delete on public.program_sections to authenticated;
grant select, insert, update, delete on public.attachments      to authenticated;
grant select, insert, update, delete on public.assignments      to authenticated;
grant select, insert, update, delete on public.invites          to authenticated;
grant select                        on public.keepalive        to anon, authenticated;

alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.invites          enable row level security;
alter table public.programs         enable row level security;
alter table public.program_sections enable row level security;
alter table public.attachments      enable row level security;
alter table public.assignments      enable row level security;
alter table public.keepalive        enable row level security;


-- --- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

-- Stulpelių teisės jau riboja, ką galima rašyti, iki full_name ir phone.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Įterpimo taisyklės nėra tyčia: profilius kuria tik handle_new_user trigeris.


-- --- user_roles -------------------------------------------------------------
-- Teisių nėra visai, tad taisyklių irgi nereikia. Apsauga įjungta tam, kad
-- lentelė niekada neliktų atvira, jei kas nors ateity duotų teises per klaidą.


-- --- invites ----------------------------------------------------------------
drop policy if exists "invites_admin_all" on public.invites;
create policy "invites_admin_all" on public.invites
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- --- programs ---------------------------------------------------------------
-- Viena taisyklė vienoje vietoje. has_program_access tikrina ir programos
-- būseną, ir priskyrimą, ir paties kliento būseną, tad programos įrašas ir jos
-- turinys niekada negali nesutapti.
drop policy if exists "programs_select" on public.programs;
create policy "programs_select" on public.programs
  for select to authenticated
  using (private.has_program_access(id));

drop policy if exists "programs_admin_write" on public.programs;
create policy "programs_admin_write" on public.programs
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- --- program_sections -------------------------------------------------------
drop policy if exists "sections_select" on public.program_sections;
create policy "sections_select" on public.program_sections
  for select to authenticated
  using (private.has_program_access(program_id));

drop policy if exists "sections_admin_write" on public.program_sections;
create policy "sections_admin_write" on public.program_sections
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- --- attachments ------------------------------------------------------------
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
  for select to authenticated
  using (private.has_program_access(program_id));

drop policy if exists "attachments_admin_write" on public.attachments;
create policy "attachments_admin_write" on public.attachments
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- --- assignments ------------------------------------------------------------
drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select" on public.assignments
  for select to authenticated
  using (client_id = (select auth.uid()) or private.is_admin());

drop policy if exists "assignments_admin_write" on public.assignments;
create policy "assignments_admin_write" on public.assignments
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- --- keepalive --------------------------------------------------------------
drop policy if exists "keepalive_read" on public.keepalive;
create policy "keepalive_read" on public.keepalive
  for select to anon, authenticated
  using (true);


-- =============================================================================
--  13. FAILŲ SAUGYKLA
--
--  Privatus krepšys. Be galiojančios pasirašytos nuorodos failo neatidarysi,
--  net žinodamas tikslų adresą.
--
--  Kelias: <programos id>/<laiko žyma>-<sutvarkytas vardas>
--  Pirmas segmentas yra programos id, pagal jį taisyklė tikrina priskyrimą.
--
--  50 MB riba yra nemokamo plano lubos vienam failui, aukščiau jos pakelti
--  neįmanoma. Dėl to ilgi treniruočių video keliami į YouTube, o čia lieka
--  PDF, nuotraukos ir trumpi įrašai.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'programos', 'programos', false, 52428800,
  -- quicktime ir heic įtraukti tyčia: telefonu filmuotas įrašas būna .mov,
  -- o naujesnės iPhone nuotraukos .heic. Be jų Dalius negalėtų įkelti nieko,
  -- kas nufilmuota telefonu.
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/csv']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.foldername() naudojama tyčia. Ji grąžina tik katalogus, todėl failui,
-- padėtam krepšio šaknyje, grąžina tuščią sąrašą ir taisyklė uždaro prieigą.
-- split_part tokiu atveju grąžintų patį failo vardą ir galėtų netyčia sutapti.
drop policy if exists "programos_read" on storage.objects;
create policy "programos_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'programos'
    and private.has_program_access(private.kelio_programa((storage.foldername(name))[1]))
  );

drop policy if exists "programos_insert" on storage.objects;
create policy "programos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'programos' and private.is_admin());

drop policy if exists "programos_update" on storage.objects;
create policy "programos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'programos' and private.is_admin())
  with check (bucket_id = 'programos' and private.is_admin());

drop policy if exists "programos_delete" on storage.objects;
create policy "programos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'programos' and private.is_admin());


-- =============================================================================
--  14. SENOS VERSIJOS LIEKANOS
--
--  Pirmoje versijoje rolė buvo profiles lentelės stulpelis. Šalinama čia, o ne
--  failo pradžioje, nes iki šios vietos visos senos taisyklės jau perrašytos ir
--  stulpelio nebenaudoja.
-- =============================================================================
alter table public.profiles drop column if exists role;


-- =============================================================================
--  15. TRENERIO PASKYRA
--
--  Atlikti VIENĄ KARTĄ, kai Dalius jau susikūrė paskyrą per zonos registraciją.
--  Įrašyk jo el. paštą vietoje pavyzdinio ir paleisk abu sakinius kartu.
-- =============================================================================
--  insert into public.user_roles (user_id, role)
--  select id, 'admin' from auth.users where email = 'dalius@pavyzdys.lt'
--  on conflict (user_id) do update set role = 'admin';
--
--  update public.profiles set status = 'active'
--   where email = 'dalius@pavyzdys.lt';


-- =============================================================================
--  16. PATIKRA
--  Pirmoji užklausa turi grąžinti aštuonias eilutes ir visur true.
--  Bent vienas false reikštų, kad ta lentelė atvira viešai.
-- =============================================================================
--  select relname, relrowsecurity
--    from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('profiles','user_roles','invites','programs',
--                     'program_sections','attachments','assignments','keepalive')
--   order by relname;
--
--  select c.relname,
--         c.relrowsecurity                                        as apsauga,
--         (select count(*) from pg_policies p
--           where p.schemaname = 'public' and p.tablename = c.relname) as taisykliu,
--         has_table_privilege('authenticated', c.oid, 'SELECT')   as skaito_klientas
--    from pg_class c
--   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
--   order by c.relname;
