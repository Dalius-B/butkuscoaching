-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs klientu-kopijos.sql (client_exercises).
--
-- Lets the trainer hide one exercise from a client's own program copy without
-- deleting it — the row (and every exercise_logs set already attached to it)
-- stays exactly where it is, so history is untouched and unhiding brings it
-- straight back. Deleting would cascade-erase that history (see
-- kliento-programos-redagavimas.sql); hiding is for "swap this exercise for
-- something else, but keep the option to bring it back."
--
-- Scoped to client_exercises only, not the shared exercises template: hiding
-- is a per-client decision, not something that should touch the template or
-- any other client assigned from it.

alter table public.client_exercises
  add column if not exists is_hidden boolean not null default false;
