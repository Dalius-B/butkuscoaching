-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs kliento-pratimo-redagavimas.sql (which already
-- granted UPDATE on client_exercises) to already exist.
--
-- Two clients can be on copies of the same program with small per-client
-- differences (different reps, an extra exercise, a renamed day). Until now
-- the only way to change an already-assigned client's copy beyond log_type/
-- video_url was to re-run assign_program(), which creates a brand new
-- client_programs/client_days/client_exercises chain and leaves the old
-- exercise_logs pointing at exercise ids the client no longer sees -- their
-- "last session" placeholders and history go blank even though the rows
-- are still in the database. This grants the admin full CRUD on a client's
-- existing copy instead, so edits land on the SAME client_exercises/
-- client_days rows the client's history already points to.
--
-- Deliberately NOT extended to client_programs or to inserting/deleting
-- client_days -- adding or removing whole training days changes the shape
-- of the program more than a "slight adjustment," and assign_program()
-- already covers that case by creating a fresh, independent copy.

grant insert, delete on public.client_exercises to authenticated;
grant update on public.client_days to authenticated;

drop policy if exists "client_exercises_admin_insert" on public.client_exercises;
create policy "client_exercises_admin_insert" on public.client_exercises
  for insert to authenticated
  with check (private.is_admin());

drop policy if exists "client_exercises_admin_delete" on public.client_exercises;
create policy "client_exercises_admin_delete" on public.client_exercises
  for delete to authenticated
  using (private.is_admin());

drop policy if exists "client_days_admin_update" on public.client_days;
create policy "client_days_admin_update" on public.client_days
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());
