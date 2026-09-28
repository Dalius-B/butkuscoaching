-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs private.is_admin() (duomenu-baze.sql) to
-- already exist.
--
-- Lets a client attach progress photos to their weekly check-in. The bucket
-- is PRIVATE (not public) -- these can be body photos, so nothing is served
-- by a guessable URL. Each file is uploaded under a path starting with the
-- uploading client's own auth id (e.g. "3fa8.../169900-0-photo.jpg"), and
-- the storage policies below only allow a client to read/write inside their
-- own folder, or the trainer to read everyone's. The site always generates
-- a short-lived signed URL to actually display a photo (see
-- nuotraukuNuorodos() in app.js) -- the stored path itself is not enough to
-- view the file.

insert into storage.buckets (id, name, public)
values ('progreso-nuotraukos', 'progreso-nuotraukos', false)
on conflict (id) do nothing;

drop policy if exists "progreso_nuotraukos_insert_own" on storage.objects;
create policy "progreso_nuotraukos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progreso-nuotraukos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progreso_nuotraukos_select_own_or_admin" on storage.objects;
create policy "progreso_nuotraukos_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progreso-nuotraukos'
    and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin())
  );

drop policy if exists "progreso_nuotraukos_delete_own" on storage.objects;
create policy "progreso_nuotraukos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progreso-nuotraukos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kur checkins eilutė saugo, kurie failai jai priklauso -- pačių nuotraukų
-- kibiryje ištrinti savaime niekas neišvalo, jei eilutė vėliau ištrinama,
-- bet checkins šiuo metu niekada netrinamas iš svetainės, tad tai nesvarbu.
alter table public.checkins add column if not exists photo_paths text[];
