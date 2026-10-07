-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- One-off data fix, safe to re-run (no-ops once already done).
--
-- Dalius logged a week of training into a program assigned to his old test
-- account (treneris@pavyzdys.lt). Today he used the new self-assign feature
-- while logged in as his real account (dalius.butkus98@gmail.com), which
-- created a brand new, empty program copy there instead of continuing the
-- old one. This moves the ORIGINAL program (with its history) over to the
-- real account, and removes the empty duplicate that was created today.

do $$
declare
  v_old_profile  uuid;
  v_new_profile  uuid;
  v_old_cp       uuid;
  v_old_title    text;
  v_new_cp       uuid;
  v_new_title    text;
  v_log_count    integer;
begin
  select id into v_old_profile from public.profiles where email = 'treneris@pavyzdys.lt';
  select id into v_new_profile from public.profiles where email = 'dalius.butkus98@gmail.com';

  if v_old_profile is null then
    raise exception 'Nerastas profilis su email treneris@pavyzdys.lt';
  end if;
  if v_new_profile is null then
    raise exception 'Nerastas profilis su email dalius.butkus98@gmail.com';
  end if;

  -- Programa, kurią Dalius pildė visą savaitę -- ji dar priklauso senai
  -- testinei paskyrai ir dar nepabaigta (status <> 'finished').
  select id, title into v_old_cp, v_old_title
  from public.client_programs
  where client_id = v_old_profile and status <> 'finished'
  order by assigned_at desc
  limit 1;

  if v_old_cp is null then
    raise notice 'Senoje paskyroje (treneris@pavyzdys.lt) nebėra aktyvios programos -- tikriausiai jau perkelta anksčiau. Nieko nedarau.';
  else
    -- Patikriname, kad tai tikrai ta pati programa, kurios dar nėra realioje
    -- paskyroje -- jei realioje paskyroje jau yra programa su tuo pačiu
    -- pavadinimu IR joje jau yra įrašų, kažkas neatitinka laukiamo vaizdo.
    select cp.id, cp.title into v_new_cp, v_new_title
    from public.client_programs cp
    where cp.client_id = v_new_profile and cp.title = v_old_title
    order by cp.assigned_at desc
    limit 1;

    if v_new_cp is not null then
      select count(*) into v_log_count
      from public.exercise_logs el
      join public.client_exercises ce on ce.id = el.client_exercise_id
      join public.client_days cd on cd.id = ce.client_day_id
      where cd.client_program_id = v_new_cp;

      if v_log_count > 0 then
        raise exception 'Realioje paskyroje programa "%" jau turi % įrašų -- nebevykdau automatinio perkėlimo, patikrink rankiniu būdu.', v_new_title, v_log_count;
      end if;
    end if;

    -- Perkeliame pačią programos kopiją ir TIK jos pačios įrašus į realią
    -- paskyrą -- apsiribojame v_old_cp pratimais, o ne visais senos
    -- paskyros client_id įrašais, jei senoje paskyroje būtų ir kitų,
    -- nesusijusių programų su savo istorija.
    update public.client_programs set client_id = v_new_profile where id = v_old_cp;
    update public.exercise_logs set client_id = v_new_profile
    where client_id = v_old_profile
      and client_exercise_id in (
        select ce.id from public.client_exercises ce
        join public.client_days cd on cd.id = ce.client_day_id
        where cd.client_program_id = v_old_cp
      );

    -- Pašaliname tuščią dublikatą, sukurtą šiandien realioje paskyroje
    -- (dienos ir pratimai išsitrina patys per on-delete-cascade).
    if v_new_cp is not null then
      delete from public.client_programs where id = v_new_cp;
    end if;

    raise notice 'Perkelta programa "%" (id %) į paskyrą dalius.butkus98@gmail.com. Tuščias dublikatas pašalintas.', v_old_title, v_old_cp;
  end if;
end $$;
