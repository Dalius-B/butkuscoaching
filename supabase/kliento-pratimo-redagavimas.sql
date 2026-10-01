-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs klientu-kopijos.sql (client_exercises, private.is_admin()).
--
-- client_exercises has been select-only for everyone until now -- a client's
-- copy was fixed at the moment it was assigned, and the only way to change
-- it was to re-run assign_program(), which creates a brand new copy. That
-- meant a trainer editing the shared template (e.g. changing an exercise's
-- log_type, or adding a video link) never reached clients already on that
-- program. This grants the admin a narrow UPDATE path directly on a
-- client's own exercise copy, so small fixes (log type, video link, and
-- anything else on the row) can be corrected without re-assigning the
-- whole program and losing the client's logged history.

grant update on public.client_exercises to authenticated;

drop policy if exists "client_exercises_admin_update" on public.client_exercises;
create policy "client_exercises_admin_update" on public.client_exercises
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());
