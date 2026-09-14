-- Run this AFTER duomenu-baze.sql (it needs the private.is_admin() function
-- that file creates). Supabase dashboard -> SQL Editor -> New query -> paste
-- -> Run. Safe to run more than once.
--
-- Lets your logged-in trainer account read every row of public.checkins from
-- the client zone's "Patikrinimai" tab. The public site's checkin.html still
-- only has INSERT access (from supabase/checkins.sql) -- this does not change
-- that, and clients still cannot read anyone's check-ins, including their own,
-- through this policy. It only opens SELECT to whoever private.is_admin()
-- says is the trainer.

drop policy if exists "checkins_admin_select" on public.checkins;
create policy "checkins_admin_select" on public.checkins
  for select
  to authenticated
  using (private.is_admin());
