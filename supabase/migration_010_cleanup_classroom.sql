-- ============================================================================
-- Migration 010 — Clean up the abandoned classroom / mirror / Daily experiment
-- ============================================================================
-- The classroom feature was reverted (see PR that removed classroom.js etc.).
-- This removes the database artifacts it left behind so `sessions` is back to
-- its original, lean shape. Safe + idempotent — run once in the SQL Editor.
-- ----------------------------------------------------------------------------

-- 1. Delete the empty leftover sessions (no lesson plan). These are what broke
--    the student notebook list. Real sessions always have a plan, so this only
--    removes the junk the classroom created.
delete from public.sessions where status = 'completed' and plan is null;
delete from public.sessions where is_classroom = true and plan is null;

-- 2. Stop replicating `sessions` over Realtime — only the classroom slide-mirror
--    subscribed to it; the live app polls instead. Removing it trims WAL work.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime drop table public.sessions;
  end if;
end $$;

-- 3. Drop the unused columns the classroom added (present_active / current_slide
--    from migration_008, is_classroom from migration_009).
alter table public.sessions drop column if exists present_active;
alter table public.sessions drop column if exists current_slide;
alter table public.sessions drop column if exists is_classroom;

select 'migration 010 complete — classroom DB artifacts removed; sessions back to original shape' as status;
