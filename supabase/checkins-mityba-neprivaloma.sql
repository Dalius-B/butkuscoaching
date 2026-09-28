-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time.
--
-- The weekly check-in form no longer asks about nutrition ("for now" --
-- Dalius wants to redesign that section later). Existing rows and their
-- nutrition data are left untouched; new check-ins simply submit without
-- these three columns, which requires them to stop being NOT NULL or every
-- new insert would fail. zona/patikrinimas.html and zona/valdymas.html
-- already only display these fields when they are present, so old rows
-- with nutrition data still show it, and new rows without it just skip
-- that part of the card.

alter table public.checkins alter column nutrition_adherence drop not null;
alter table public.checkins alter column protein_intake drop not null;
alter table public.checkins alter column nutrition_struggles drop not null;
