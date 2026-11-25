-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql (and duomenu-baze.sql for private.is_admin()).
--
-- Nightly AI analysis of a client's progress (Užduotys feature).
--
--   profiles.ai_analize_ijungta   per-client on/off switch. Off by default.
--                                 Clients cannot write it (column grants only
--                                 allow full_name / phone); the trainer flips
--                                 it with admin_set_ai() below.
--   profiles.ai_sutikimas_data    when the trainer switched it on, i.e. when
--                                 the client's consent was confirmed.
--   ai_summaries                  one row per client per night: the AI's short
--                                 summary. Written ONLY by the nightly job
--                                 (GitHub Action, using the service key, which
--                                 bypasses RLS). Only the trainer can read it:
--                                 clients get no policy, so they see nothing.

alter table public.profiles
  add column if not exists ai_analize_ijungta boolean not null default false,
  add column if not exists ai_sutikimas_data  timestamptz;

create or replace function public.admin_set_ai(p_client uuid, p_ijungta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Neturi teisių' using errcode = '42501';
  end if;
  update public.profiles
     set ai_analize_ijungta = p_ijungta,
         ai_sutikimas_data  = case when p_ijungta then now() else ai_sutikimas_data end
   where id = p_client;
end;
$$;

revoke all on function public.admin_set_ai(uuid, boolean) from public;
grant execute on function public.admin_set_ai(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
--  Naktinės santraukos
--  day     = įpročių diena, kurią analizavo (paprastai vakarykštė)
--  turinys = {bukle, santrauka, kas_nutiko[], desniai[], demesio[], pasiulymai[]}
-- -----------------------------------------------------------------------------
create table if not exists public.ai_summaries (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  turinys    jsonb not null,
  modelis    text not null default '',
  created_at timestamptz not null default now(),
  unique (client_id, day)
);

create index if not exists ai_summaries_client_day_idx on public.ai_summaries (client_id, day desc);

alter table public.ai_summaries enable row level security;

grant select on public.ai_summaries to authenticated;
grant all    on public.ai_summaries to service_role;

drop policy if exists ai_summaries_admin_select on public.ai_summaries;
create policy ai_summaries_admin_select on public.ai_summaries
  for select to authenticated
  using (private.is_admin());
