-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Migration 003: activity tracking (XP + practice time)
--
--   One row per COMPLETED post-session activity, carrying the score,
--   the XP earned, and the ACTIVE seconds the student spent on it.
--   Tutors read these (for their own sessions only) to see how much
--   practice each student actually did per session.
--
-- ⚠️  INCREMENTAL and safe to run against the LIVE database.
--     Do NOT re-run migration_001_initial.sql — that one drops everything.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run more than once (every step is guarded).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.activity_attempts (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  -- quiz | reorder | gapfill | matching | flashcards
  activity   text not null,
  challenge  boolean not null default false,
  -- correct/total are NULL for flashcards (nothing to be accurate about).
  -- For matching: correct = pairs matched, total = attempts taken.
  correct    int,
  total      int,
  xp         int not null default 0,
  seconds    int not null default 0,
  created_at timestamptz not null default now(),
  constraint activity_attempts_activity_check
    check (activity in ('quiz', 'reorder', 'gapfill', 'matching', 'flashcards'))
);

alter table public.activity_attempts enable row level security;

create index if not exists activity_attempts_session_idx on public.activity_attempts (session_id);
create index if not exists activity_attempts_student_idx on public.activity_attempts (student_id);

-- ═══════════════════════ Row-Level Security ═══════════════════════

-- A student may record and read ONLY their own attempts.
drop policy if exists activity_attempts_student_insert on public.activity_attempts;
create policy activity_attempts_student_insert on public.activity_attempts
  for insert with check (student_id = auth.uid());

drop policy if exists activity_attempts_student_select on public.activity_attempts;
create policy activity_attempts_student_select on public.activity_attempts
  for select using (student_id = auth.uid());

-- A tutor may read attempts belonging to sessions THEY own — no others.
drop policy if exists activity_attempts_tutor_select on public.activity_attempts;
create policy activity_attempts_tutor_select on public.activity_attempts
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = activity_attempts.session_id
        and s.tutor_id = auth.uid()
    )
  );

-- Admins may read everything.
drop policy if exists activity_attempts_admin_select on public.activity_attempts;
create policy activity_attempts_admin_select on public.activity_attempts
  for select using (public.is_admin());

-- ─────────────── Result ───────────────
select 'migration 003 complete' as status,
       (select count(*) from public.activity_attempts) as attempts_recorded;
