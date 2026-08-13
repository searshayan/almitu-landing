-- ============================================================================
-- Migration 009 — Virtual Classroom flag
-- ============================================================================
-- Marks a live session as a "classroom" session (the new in-app room) vs the
-- older Google-Meet flow. The student's banner uses it to decide between
-- "Join Classroom" (enter the room) and the legacy "Join the Session" (Meet),
-- so the two flows can coexist while the classroom is built out.
--
-- Safe + additive: one boolean, defaults false, no data touched. Idempotent.
-- ----------------------------------------------------------------------------

alter table public.sessions
  add column if not exists is_classroom boolean not null default false;

select 'migration 009 complete' as status,
       'sessions.is_classroom added' as detail;
