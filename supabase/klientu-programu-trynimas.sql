-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs private.is_admin() (duomenu-baze.sql).
--
-- Lets the trainer permanently delete one of a client's program copies --
-- e.g. leftover test assignments cluttering "Ankstesnės programos" on
-- mano.html. This is different from "Atimti" in redaguoti.html, which only
-- sets status to 'finished' and keeps everything: this genuinely erases the
-- client_programs row and, via existing on-delete-cascade foreign keys, its
-- client_days / client_exercises / exercise_logs too. There is no undo.

grant delete on public.client_programs to authenticated;

drop policy if exists "client_programs_admin_delete" on public.client_programs;
create policy "client_programs_admin_delete" on public.client_programs
  for delete to authenticated
  using (private.is_admin());
