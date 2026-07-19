-- ═══════════════════════════════════════════════════════════════════
-- Almitu — Migration 004: pre-generated curriculum session plans
--
-- INCREMENTAL. Safe to run on the live database.
-- Do NOT re-run migration_001 / 002 / 003 — they are not idempotent
-- against live data.
--
-- HOW TO RUN
--   Supabase → SQL Editor → New query → paste this file → Run.
--
-- WHAT THIS DOES
--   Lets `session_plans` hold ownerless, globally-readable plans that come
--   from the CEFR curriculum, alongside each tutor's own private plans.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────── 1. Columns ───────────

-- Curriculum plans belong to nobody, so tutor_id must be optional.
alter table public.session_plans alter column tutor_id drop not null;

alter table public.session_plans
  add column if not exists is_curriculum boolean not null default false;

-- The curriculum's own stable identifier, e.g. 'V-Pre-A1-01'.
alter table public.session_plans
  add column if not exists curriculum_id text;

-- ─────────── 2. Integrity ───────────

-- Every plan is either owned by a tutor, or is a curriculum plan.
-- (Prevents ownerless private plans becoming invisible orphans.)
alter table public.session_plans drop constraint if exists session_plans_owner_check;
alter table public.session_plans add constraint session_plans_owner_check
  check (tutor_id is not null or is_curriculum);

-- Makes generation idempotent + resumable: re-running the generator can
-- never create a second copy of the same curriculum session.
drop index if exists session_plans_curriculum_uniq;
create unique index session_plans_curriculum_uniq
  on public.session_plans (curriculum_id)
  where is_curriculum;

create index if not exists session_plans_is_curriculum_idx
  on public.session_plans (is_curriculum) where is_curriculum;

-- ─────────── 3. Row-Level Security ───────────
-- NOTE: the existing `session_plans_tutor_all` policy uses
-- `tutor_id = auth.uid()`, which is NULL (not true) for curriculum rows —
-- so curriculum plans are invisible to everyone until the policies below
-- are added. Nothing here widens access to tutors' private plans.

-- Any approved tutor or admin may READ the shared curriculum library.
drop policy if exists session_plans_curriculum_read on public.session_plans;
create policy session_plans_curriculum_read on public.session_plans
  for select using (
    is_curriculum
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'tutor')
        and p.status = 'approved'
    )
  );

-- Only admins may CREATE / UPDATE / DELETE curriculum plans.
-- Split per-command so `with check` applies to the write paths only.
drop policy if exists session_plans_curriculum_insert on public.session_plans;
create policy session_plans_curriculum_insert on public.session_plans
  for insert with check (is_curriculum and public.is_admin());

drop policy if exists session_plans_curriculum_update on public.session_plans;
create policy session_plans_curriculum_update on public.session_plans
  for update using (is_curriculum and public.is_admin())
           with check (is_curriculum and public.is_admin());

drop policy if exists session_plans_curriculum_delete on public.session_plans;
create policy session_plans_curriculum_delete on public.session_plans
  for delete using (is_curriculum and public.is_admin());

-- ─────────── 4. Verify ───────────
-- Should return the three new columns:
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'session_plans'
  and column_name in ('tutor_id', 'is_curriculum', 'curriculum_id')
order by column_name;
