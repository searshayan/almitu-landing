-- ============================================================================
-- Migration 008 — Live synced slides (Model A: full mirror)
-- ============================================================================
-- What this adds:
--   • sessions.present_active — is the tutor currently in Present mode?
--   • sessions.current_slide  — which slide index the tutor is showing.
--
-- These two columns are the DURABLE source of truth for the student's mirror.
-- When the tutor enters Present or flips a slide, the app writes them here;
-- the student receives the change over Realtime (postgres_changes) and re-draws
-- the same slide natively on their own device — so slides stay crisp on a
-- phone instead of arriving as a downscaled screen-share video.
--
-- High-frequency SCROLL position is NOT stored here — it travels over a
-- Realtime BROADCAST channel (ephemeral, no DB writes), so scrolling a slide
-- never hammers the table. The columns below only move on slide/Present change,
-- which also lets a student who joins mid-lesson land on the right slide.
--
-- The student already reads the whole session row (incl. the plan + its slide
-- HTML) via dataGetLiveSessionForStudent, so NO new read policy is needed — the
-- slides ride along in the `plan` jsonb the student can already see.
-- ----------------------------------------------------------------------------

-- ─────────── 1. Columns ───────────
alter table public.sessions
  add column if not exists present_active boolean not null default false;
alter table public.sessions
  add column if not exists current_slide  int     not null default 0;

-- ─────────── 2. Realtime: push slide/Present changes to the student ───────────
-- The student subscribes to UPDATEs on their own live session row. RLS already
-- limits that to sessions where they are the student, so no data leaks.
-- ALTER PUBLICATION has no "IF NOT EXISTS", so guard the add — this keeps the
-- whole migration safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;

-- ─────────── Result ───────────
select 'migration 008 complete' as status,
       'sessions.present_active + sessions.current_slide added; sessions in realtime' as detail;
