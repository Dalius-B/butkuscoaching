-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run any time. Needs uzduotys.sql to have been run first.
--
-- Lets a challenge carry an instructional video (a YouTube or Vimeo link),
-- e.g. a squat demonstration shown to the client from the task itself.
-- Only https links are accepted.

alter table public.client_challenges
  add column if not exists video_url text not null default ''
    check (video_url = '' or (video_url ~* '^https://' and char_length(video_url) <= 500));
