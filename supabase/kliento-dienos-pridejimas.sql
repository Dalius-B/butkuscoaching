-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs klientu-kopijos.sql (client_days) and
-- duomenu-baze.sql (private.is_admin()) to already exist.
--
-- WHY THIS FILE EXISTS
-- kliento-programos-redagavimas.sql deliberately left INSERT off
-- client_days, on the reasoning that adding a whole new day was a big
-- enough change that re-assigning from a template (assign_program())
-- should be used instead. That reasoning breaks down once a client's copy
-- has already been hand-tuned directly on their profile: re-assigning
-- replaces it with a brand new copy and leaves their existing
-- exercise_logs pointing at exercise ids they no longer see — the exact
-- problem that file was written to avoid, just for days instead of
-- exercises. This grants client_days the same INSERT access
-- client_exercises already has, so "+ Pridėti dieną" in valdymas.html's
-- client program editor actually works instead of failing silently
-- (silently from the trainer's point of view — the error was real, just
-- shown in the page's top notification area, easy to miss when scrolled
-- deep into the editor).

grant insert on public.client_days to authenticated;

drop policy if exists "client_days_admin_insert" on public.client_days;
create policy "client_days_admin_insert" on public.client_days
  for insert to authenticated
  with check (private.is_admin());
