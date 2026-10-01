-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql to have been run first.
--
-- Lets a challenge be completed in steps during the day, e.g. "drink 10
-- glasses of water": the client ticks 2 glasses in the morning and more later.
--
--   client_challenges.target   how many to do in a day (1 = a plain yes/no task)
--   client_challenges.unit     what is counted ("stiklinių", "žingsnių"), may be empty
--   client_challenges.step     how much one tap adds (1 glass, 1000 steps)
--   challenge_completions.amount   how much the client has done so far today
--
-- Points are earned in proportion: 5 of 10 glasses on a 10 point task = 5 points.
-- The trigger works that out, so a client cannot give themselves extra points.

alter table public.client_challenges
  add column if not exists target integer not null default 1 check (target between 1 and 100000),
  add column if not exists unit   text    not null default '' check (char_length(unit) <= 30),
  add column if not exists step   integer not null default 1 check (step between 1 and 100000);

alter table public.challenge_completions
  add column if not exists amount integer not null default 1 check (amount >= 1);

create or replace function private.uzpildyk_atlikima()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.client_challenges%rowtype;
begin
  select * into v from public.client_challenges where id = new.challenge_id;
  if not found or v.client_id <> new.client_id then
    raise exception 'Užduotis nerasta' using errcode = 'P0002';
  end if;
  if tg_op = 'INSERT' and not v.active then
    raise exception 'Užduotis išjungta' using errcode = 'P0001';
  end if;
  new.amount := least(greatest(new.amount, 1), v.target);
  new.xp     := round(v.xp::numeric * new.amount / v.target);
  return new;
end;
$$;

drop trigger if exists challenge_completions_fill on public.challenge_completions;
create trigger challenge_completions_fill
  before insert or update on public.challenge_completions
  for each row execute function private.uzpildyk_atlikima();

-- Kiekį galima keisti tik savo užduoties ir tik šiandien.
grant update (amount) on public.challenge_completions to authenticated;

drop policy if exists "challenge_completions_update_own" on public.challenge_completions;
create policy "challenge_completions_update_own" on public.challenge_completions
  for update to authenticated
  using (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  )
  with check (
    client_id = (select auth.uid())
    and private.gali_uzduotys()
    and day = private.siandien_lt()
  );
