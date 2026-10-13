-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs private.is_admin() (duomenu-baze.sql).
--
-- Testimonials, written only by real clients from inside the client zone
-- (zona/atsiliepimas.html -- never a public form), reviewed by the trainer
-- before anything appears on the public site. One per client; a client can
-- edit theirs freely while it's still pending/rejected, but once published
-- it's locked (the trainer would have to unpublish it first to allow edits).

-- display_name yra sąmoningai nukopijuotas (ne JOIN su profiles) -- anon
-- raktas, kuriuo skaito pagrindinis puslapis, neturi (ir neturėtų turėti)
-- teisės skaityti profiles lentelės (ten el. paštas, telefonas). Vardas
-- paimamas iš kliento profilio pateikimo metu ir įrašomas tiesiai čia.
create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null unique references public.profiles(id) on delete cascade,
  display_name text,
  rating       smallint not null check (rating between 1 and 5),
  body         text not null,
  photo_paths  text[],
  status       text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists testimonials_status_idx on public.testimonials (status);

-- Kas gali RAŠYTI atsiliepimą: aktyvus klientas (bet koks paketas -- jei turi
-- profilį ir dirbo su Daliumi, gali palikti atsiliepimą, ne vien "pilnas").
create or replace function private.can_write_testimonial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function private.can_write_testimonial() from public;
grant execute on function private.can_write_testimonial() to authenticated;

-- is_admin() buvo suteikta tik 'authenticated' (duomenu-baze.sql), nes iki
-- šiol visada buvo kviečiama tik prisijungus. Žemiau esanti testimonials
-- select taisyklė ją kviečia ir 'anon' rolei (pagrindinis puslapis be
-- prisijungimo) -- be šios teisės PostgreSQL atsisako vykdyti bet kokią
-- užklausą, kurios taisyklėje ta funkcija paminėta, nepriklausomai nuo to,
-- ar OR sąlyga iki jos jau būtų teisinga.
grant execute on function private.is_admin() to anon;

grant usage on schema public to anon, authenticated;
revoke all on public.testimonials from anon, authenticated;
grant select on public.testimonials to anon, authenticated;
grant insert, update on public.testimonials to authenticated;
grant delete on public.testimonials to authenticated;

alter table public.testimonials enable row level security;

-- Viešai (net neprisijungus) matomi tik PASKELBTI atsiliepimai -- tai
-- pagrindinio puslapio skaito per anon raktą. Prisijungęs klientas papildomai
-- mato savo paties įrašą bet kokia būsena, treneris -- visus.
drop policy if exists "testimonials_select" on public.testimonials;
create policy "testimonials_select" on public.testimonials
  for select to anon, authenticated
  using (
    status = 'published'
    or client_id = (select auth.uid())
    or private.is_admin()
  );

drop policy if exists "testimonials_insert_own" on public.testimonials;
create policy "testimonials_insert_own" on public.testimonials
  for insert to authenticated
  with check (client_id = (select auth.uid()) and private.can_write_testimonial());

-- Klientas gali taisyti SAVO įrašą, kol jis dar nepaskelbtas viešai -- ir
-- taisydamas visada grąžina jį į "pending" (nebegali pats savęs "patvirtinti"
-- perrašydamas status lauką).
drop policy if exists "testimonials_update_own" on public.testimonials;
create policy "testimonials_update_own" on public.testimonials
  for update to authenticated
  using (client_id = (select auth.uid()) and status <> 'published')
  with check (client_id = (select auth.uid()) and status = 'pending');

-- Treneris mato/tvirtina/atmeta/atšaukia paskelbimą -- bet koks statuso
-- pakeitimas, nepriklausomai nuo kliento taisyklės aukščiau.
drop policy if exists "testimonials_admin_write" on public.testimonials;
create policy "testimonials_admin_write" on public.testimonials
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "testimonials_admin_delete" on public.testimonials;
create policy "testimonials_admin_delete" on public.testimonials
  for delete to authenticated
  using (private.is_admin());


-- ---------------------------------------------------------------------------
-- Failų saugykla. VIEŠAS krepšys (skirtingai nuo progreso-nuotraukų) --
-- paskelbti atsiliepimai su nuotraukomis rodomi pagrindiniame puslapyje
-- lankytojams, kurie net neprisijungę, tad nuotraukai rodyti nereikia
-- pasirašytos nuorodos, pakanka tiesioginio viešo adreso (getPublicUrl()).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atsiliepimu-nuotraukos', 'atsiliepimu-nuotraukos', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

-- Įkelti gali tik savo aplanke (kelio pirmas segmentas -- paties auth id), ir
-- tik aktyvus klientas.
drop policy if exists "atsiliepimu_nuotraukos_insert_own" on storage.objects;
create policy "atsiliepimu_nuotraukos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'atsiliepimu-nuotraukos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_write_testimonial()
  );

drop policy if exists "atsiliepimu_nuotraukos_delete_own_or_admin" on storage.objects;
create policy "atsiliepimu_nuotraukos_delete_own_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'atsiliepimu-nuotraukos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin())
  );
