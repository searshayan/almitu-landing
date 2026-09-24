-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Migration 012
--   • Make Amie session-aware: bind every chat turn to ONE session.
--   • Adds amie_messages.session_id so the amie-chat Edge Function can
--     scope history + enforce the 24-replies-PER-SESSION limit (spec §7).
--   • Nullable + ON DELETE SET NULL so old rows (written before Amie was
--     session-bound) survive untouched and a deleted session doesn't wipe
--     a student's chat history — the row just loses its session link.
--
-- ⚠️  INCREMENTAL and safe to run against the LIVE database.
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run more than once (every step is guarded).
-- ═══════════════════════════════════════════════════════════════════

alter table public.amie_messages
  add column if not exists session_id uuid
  references public.sessions(id) on delete set null;

-- Backs both the scoped-history read and the per-session "used today" count,
-- so the function never scans a student's whole all-time thread.
create index if not exists amie_messages_session_idx
  on public.amie_messages (student_id, session_id, created_at);

select 'migration 012 complete' as status,
       (select count(*) from public.amie_messages) as amie_messages_total,
       (select count(*) from public.amie_messages where session_id is not null) as session_bound;
