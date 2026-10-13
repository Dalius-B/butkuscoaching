-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs private.is_admin() (duomenu-baze.sql).
--
-- A shared content library (presentations, articles, videos, etc.) that the
-- trainer uploads from valdymas.html and that "pilnas" (full coaching)
-- clients can browse in zona/biblioteka.html. Each item is either an
-- uploaded file (stored in the 'biblioteka' bucket), an external link (e.g.
-- a YouTube video or an outside article), or both.

create table if not exists public.library_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  category     text not null default '',
  file_path    text,
  external_url text,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint library_items_has_content check (file_path is not null or external_url is not null)
);

create index if not exists library_items_position_idx on public.library_items (position);

-- Kas gali matyti biblioteką: aktyvus "pilnas" paketo klientas, arba treneris.
-- Ta pati taisyklė naudojama ir lentelei, ir failų saugyklai žemiau.
create or replace function private.has_library_access()
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
      and plan_type = 'pilnas'
  );
$$;

revoke all on function private.has_library_access() from public;
grant execute on function private.has_library_access() to authenticated;

grant usage on schema public to anon, authenticated;
revoke all on public.library_items from anon, authenticated;
grant select on public.library_items to authenticated;
grant insert, update, delete on public.library_items to authenticated;

alter table public.library_items enable row level security;

drop policy if exists "library_items_select" on public.library_items;
create policy "library_items_select" on public.library_items
  for select to authenticated
  using (private.has_library_access() or private.is_admin());

drop policy if exists "library_items_admin_write" on public.library_items;
create policy "library_items_admin_write" on public.library_items
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());


-- ---------------------------------------------------------------------------
-- Failų saugykla. Privatus krepšys — prieiga tik per pasirašytą nuorodą,
-- sugeneruojamą puslapyje (nuotraukuNuorodos() app.js, ta pati funkcija kaip
-- progreso nuotraukoms, tik su kitu kibirio vardu).
-- 50 MB riba — ta pati nemokamo Supabase plano riba, kaip ir kitur šiame
-- projekte. Ilgi video geriau kelti į YouTube ir nurodyti kaip nuorodą.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'biblioteka', 'biblioteka', false, 52428800,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/quicktime',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "biblioteka_select" on storage.objects;
create policy "biblioteka_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'biblioteka' and (private.has_library_access() or private.is_admin()));

drop policy if exists "biblioteka_insert" on storage.objects;
create policy "biblioteka_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'biblioteka' and private.is_admin());

drop policy if exists "biblioteka_update" on storage.objects;
create policy "biblioteka_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'biblioteka' and private.is_admin())
  with check (bucket_id = 'biblioteka' and private.is_admin());

drop policy if exists "biblioteka_delete" on storage.objects;
create policy "biblioteka_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'biblioteka' and private.is_admin());
