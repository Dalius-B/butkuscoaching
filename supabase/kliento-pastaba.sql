-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs duomenu-baze.sql (private.is_admin(),
-- public.profiles.note, which already exists from that file) to already
-- exist.
--
-- WHY THIS FILE EXISTS
-- The trainer wants to jot private notes about a client while reviewing
-- their training history (istorija.html) or their weekly check-in
-- (valdymas.html, Patikrinimai tab) — the same note in both places, not a
-- separate one per page or per check-in. profiles.note already exists in
-- the schema but was never wired up or given write access; this adds that.
--
-- Both read AND write go through security definer functions, never a direct
-- table query. This is NOT just about preventing a client from overwriting
-- the note (the usual reason other profile fields get this treatment) — the
-- read side matters just as much here, so the note is never visible to the
-- client even via a direct API request: public.profiles keeps its existing
-- blanket SELECT grant for every other column, but a client-facing page
-- simply never asks for `note`, and now there is also no legitimate way to
-- read someone else's note except through admin_get_note(), which refuses
-- anyone who is not the trainer.

create or replace function public.admin_get_note(p_client uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select note from public.profiles
  where id = p_client and private.is_admin();
$$;

create or replace function public.admin_set_note(p_client uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  update public.profiles set note = nullif(trim(p_note), '') where id = p_client;
end;
$$;

revoke all on function public.admin_get_note(uuid)      from public;
revoke all on function public.admin_set_note(uuid, text) from public;
grant execute on function public.admin_get_note(uuid)      to authenticated;
grant execute on function public.admin_set_note(uuid, text) to authenticated;
