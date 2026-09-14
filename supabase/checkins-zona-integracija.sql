-- Run this AFTER duomenu-baze.sql (it needs the private.is_admin() function
-- that file creates) and AFTER checkins.sql (it needs the checkins table).
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once, and safe to re-run any time this file changes.
--
-- The check-in form now lives only inside the client zone (zona/mano.html),
-- filled in by a logged-in client, not on a public page. This replaces the
-- original "anyone can submit" policy from checkins.sql with three narrower
-- ones:
--   1. a logged-in client can insert a check-in, but only attributed to
--      themselves (user_id must equal their own auth id) -- they cannot
--      submit one pretending to be someone else
--   2. a logged-in client can read their own check-ins (their history on
--      mano.html), and nobody else's
--   3. the trainer (private.is_admin()) can read every client's check-ins,
--      for the "Patikrinimai" tab in valdymas.html

drop policy if exists "Anyone can submit a checkin" on public.checkins;

drop policy if exists "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "checkins_select_own" on public.checkins;
create policy "checkins_select_own" on public.checkins
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "checkins_admin_select" on public.checkins;
create policy "checkins_admin_select" on public.checkins
  for select
  to authenticated
  using (private.is_admin());
