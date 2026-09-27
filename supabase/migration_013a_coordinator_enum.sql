-- ═══════════════════════════════════════════════════════════════════
-- Almitu — Migration 013a: add the 'coordinator' enum value
--
--   MUST be run as its OWN paste, separately from migration_013b, and
--   committed before anything else references 'coordinator'. Postgres
--   will not let a brand-new enum value be used inside the same
--   transaction that added it ("unsafe use of new value") — and the
--   Supabase SQL editor runs an entire pasted script as one
--   transaction, so the two steps cannot be combined into one paste.
--
-- HOW TO RUN:
--   1. Supabase → SQL Editor → New query → paste ONLY this file → Run.
--   2. Then, in a SEPARATE new query, paste migration_013b_organizations.sql → Run.
-- ═══════════════════════════════════════════════════════════════════

alter type public.user_role add value if not exists 'coordinator';

select 'migration 013a complete — now run migration_013b_organizations.sql in a NEW query' as status;
