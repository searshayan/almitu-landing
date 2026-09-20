-- ═══════════════════════════════════════════════════════════════════
-- Almitu — Migration 011: practice audio (Reading & Listening TTS)
--
-- Backs the Practice Bank Expansion audio pipeline:
--   1. A dedicated public Storage bucket, `practice-audio`, holding the
--      generate-once MP3s for the Reading and Listening cards. Public read
--      so playback streams through the Supabase CDN; writes are limited to
--      the service role (the `practice-tts` Edge Function), so students and
--      tutors can never upload or overwrite audio from the browser.
--   2. Extends the activity_attempts CHECK so completing a Reading or
--      Listening card can be recorded for XP, alongside the original five
--      activities.
--
-- No audio bytes ever live in Postgres — only the path/metadata, saved on
-- the session's plan JSONB by the Edge Function.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────── 1. Storage bucket ───────────────
insert into storage.buckets (id, name, public)
values ('practice-audio', 'practice-audio', true)
on conflict (id) do nothing;

-- Public read of practice-audio objects (the bucket is public; this makes the
-- intent explicit and survives a future flip of the bucket's public flag).
drop policy if exists "practice_audio_public_read" on storage.objects;
create policy "practice_audio_public_read" on storage.objects
  for select using (bucket_id = 'practice-audio');

-- No insert/update/delete policy is defined for anon or authenticated roles,
-- so only the service role (used by the practice-tts Edge Function, which
-- bypasses RLS) can write, replace, or remove audio files.

-- ─────────────── 2. XP for the new activities ───────────────
alter table public.activity_attempts
  drop constraint if exists activity_attempts_activity_check;
alter table public.activity_attempts
  add constraint activity_attempts_activity_check
  check (activity in ('quiz', 'reorder', 'gapfill', 'matching', 'flashcards', 'reading', 'listening'));
