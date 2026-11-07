-- Run this in the Supabase dashboard: Project -> SQL Editor -> New query ->
-- paste -> Run. Needs supabase/pratimu-biblioteka.sql (public.exercise_library)
-- to already exist. Safe to run more than once.
--
-- WHY THIS FILE EXISTS
-- Picking an exercise from one long alphabetical list gets unwieldy once the
-- library has dozens of entries. This groups the library by body area —
-- upper body / legs / core — so the trainer can browse it the same way he
-- already browses a program's days, instead of scrolling or remembering the
-- exact name.
--
-- 'kita' (other) exists as an explicit, deliberately-chosen bucket for things
-- that don't fit the three groups (warm-ups, conditioning, carries) — it is
-- NOT the same as category being null, which means nobody has categorized
-- that row yet.

alter table public.exercise_library
  add column if not exists category text
    check (category is null or category in ('virsus', 'kojos', 'kernas', 'kita'));

-- Vienkartinis atspėjimas pagal pavadinimo raktažodžius visiems įrašams, kurie
-- jau buvo bibliotekoje prieš šį stulpelį — programa pati atspėja kategoriją
-- tik NAUJAM pratimui (žr. spekKategorija() ir issaugokBibliotekoje() faile
-- app.js), o senų įrašų ji neliečia. Tvarka tyčia kernas -> kojos -> virsus:
-- virsaus raktažodžiai (pvz. "press", "raise") yra bendriausi ir kitaip
-- perimtų frazes, priklausančias siauresnei kategorijai (pvz. "leg press",
-- "knee raise") — CASE sustoja ties pirmu atitikimu, tad siauresnė kategorija
-- visada patikrinama pirma.
update public.exercise_library
set category = case
  when title ilike any (array[
    '%crunch%', '%plank%', '%lenta%', '%susiriet%', '%pilvo%', '%pilvas%',
    '%dead bug%', '%ab wheel%', '%knee raise%', '%kelių kėlim%', '%keliu kelim%',
    '%leg raise%', '%kojų kėlim%', '%koju kelim%', '%russian twist%',
    '%woodchop%', '%side bend%', '%core %', '%core-%', '% abs%', '%abs %'
  ]) then 'kernas'
  when title ilike any (array[
    '%squat%', '%tūpt%', '%tupt%', '%pritūpim%', '%pritupim%', '%lunge%',
    '%žingsn%', '%zingsn%', '%leg press%', '%leg curl%', '%leg extension%',
    '%kojų%', '%koju%', '%kojos%', '%šlaun%', '%slaun%', '%calf%', '%blauzd%',
    '%hip thrust%', '%hip raise%', '%glute raise%', '%glute bridge%',
    '%glute%', '%sėdmen%', '%sedmen%', '%romanian%', '%hamstring%', '%quad%',
    '%deadlift%', '%mirtin%'
  ]) then 'kojos'
  when title ilike any (array[
    '%bench%', '%press%', '%spaudim%', '%chest%', '%pec%', '%krūtin%',
    '%krutin%', '% fly%', '%flye%', '%dip%', '%atsispaud%', '%row%',
    '%trauk%', '%pulldown%', '%pull-down%', '%pull down%', '%lat %',
    '%(lat%', '%back%', '%nugar%', '%chin%', '%pull-up%', '%pullup%',
    '%prisitrauk%', '%shoulder%', '%delt%', '%peči%', '%peciu%', '%raise%',
    '%kėlim%', '%kelim%', '%ohp%', '%shrug%', '%bicep%', '%tricep%',
    '%curl%', '%extension%', '%rank%', '%arm%', '%kūno viršus%',
    '%kuno virsus%', '%upper body%', '%atsilenk%', '%face pull%'
  ]) then 'virsus'
  else category
end
where category is null;
