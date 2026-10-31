-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs tik-uzduotys-paketas.sql (profiles.plan_type
-- with the three-value check) and duomenu-baze.sql (private.is_admin()).
--
-- Until now plan_type was set once, when an invite is redeemed, and never
-- editable afterward -- moving a client between packages meant going into
-- the Supabase dashboard by hand. Same pattern as admin_set_status() and
-- admin_set_uzduotys(): a client can't write plan_type directly (no grant
-- on that column), so the trainer does it through this function instead.
--
-- Switching plan_type on its own doesn't delete or hide anything already
-- there -- a client moved off "pilnas" still has whatever programs/history
-- they already had, the client zona pages just stop offering the checkin/
-- biblioteka screens that plan_type no longer allows (and "tik_uzduotys"
-- clients still can't have programs assigned, per tik-uzduotys-paketas.sql).

create or replace function public.admin_set_plan_type(p_client uuid, p_plan_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  if p_plan_type not in ('pilnas', 'tik_programa', 'tik_uzduotys') then
    raise exception 'Netinkamas paketas' using errcode = '22023';
  end if;

  update public.profiles set plan_type = p_plan_type where id = p_client;
end;
$$;

revoke all on function public.admin_set_plan_type(uuid, text) from public;
grant execute on function public.admin_set_plan_type(uuid, text) to authenticated;
