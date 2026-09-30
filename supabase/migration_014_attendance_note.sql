-- ============================================================================
-- migration_014_attendance_note.sql — optional note on a "can't attend" flag
--
-- When a tutor or student flags a class as "can't attend" they can now add a
-- short reason. It is also sent to the partner in the 1:1 chat; storing it here
-- lets the partner see it on the class itself in the schedule modal.
--
-- Nullable + additive: existing flags are unaffected. Run in the Supabase SQL
-- Editor (same as earlier migrations).
-- ============================================================================
alter table public.class_attendance
  add column if not exists note text;
