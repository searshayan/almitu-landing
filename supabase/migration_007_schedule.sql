-- ============================================================================
-- Migration 007 — Weekly class schedule + attendance ("can't attend") flags
-- ============================================================================
-- What this adds:
--   • profiles.timezone  — each user's IANA zone (e.g. 'Asia/Tehran'),
--                          auto-detected in the browser. Used to convert
--                          class times into each viewer's local time.
--   • class_schedule     — recurring WEEKLY class slots for a tutor↔student
--                          pair. Set by the coordinator (admin). Times are
--                          stored as the TUTOR's local wall-clock + the
--                          tutor's zone (anchor_tz); the app converts to each
--                          viewer's timezone for display.
--   • class_attendance   — per-occurrence "can't attend" flags. Keyed by
--                          (schedule_id, occurrence_date) so they are
--                          per-week and reset automatically — the app only
--                          ever queries the current week, so last week's
--                          flags simply fall out of view. Either paired party
--                          (tutor or student) may toggle; both see the flag.
--
-- RLS summary:
--   class_schedule  : the paired tutor & student may READ; only admin WRITES.
--   class_attendance: the paired tutor & student may READ and TOGGLE (their
--                     own pair only); admin may do anything.
--
-- Run this in the Supabase SQL Editor (same as migrations 001–006).
-- ============================================================================

-- ─────────── 1. Per-user timezone ───────────
-- IANA zone name captured from the browser (Intl...resolvedOptions().timeZone).
-- Nullable: falls back to UTC in the UI until the user next signs in.
alter table public.profiles
  add column if not exists timezone text;

-- ─────────── 2. class_schedule: recurring weekly slots ───────────
create table if not exists public.class_schedule (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday, in the TUTOR's timezone (JS getDay convention).
  weekday      smallint not null check (weekday between 0 and 6),
  -- Class start as the tutor's local wall-clock time (e.g. '18:00').
  start_time   time not null,
  duration_min integer not null default 60 check (duration_min between 5 and 600),
  -- Snapshot of the tutor's IANA zone at the time the slot was set. This is
  -- the anchor the app converts FROM, so a later profile-timezone change does
  -- not silently move existing classes.
  anchor_tz    text not null,
  label        text,                              -- optional ("Grammar", …)
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists class_schedule_tutor_idx   on public.class_schedule (tutor_id);
create index if not exists class_schedule_student_idx on public.class_schedule (student_id);

alter table public.class_schedule enable row level security;

-- Paired tutor & student may read their own schedule; admin may read all.
drop policy if exists class_schedule_read on public.class_schedule;
create policy class_schedule_read on public.class_schedule
  for select using (
    public.is_admin()
    or tutor_id = auth.uid()
    or student_id = auth.uid()
  );

-- Only the coordinator (admin) creates / edits / removes schedule slots.
drop policy if exists class_schedule_admin_write on public.class_schedule;
create policy class_schedule_admin_write on public.class_schedule
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────── 3. class_attendance: per-week "can't attend" flags ───────────
create table if not exists public.class_attendance (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null references public.class_schedule(id) on delete cascade,
  -- The tutor-local calendar date of the specific occurrence being flagged.
  -- Uniquely identifies "which week's class" without any recurrence math, and
  -- gives free weekly reset (a new date every week).
  occurrence_date date not null,
  -- Room to grow (e.g. 'maybe') without a schema change; v1 uses 'cant_attend'.
  status          text not null default 'cant_attend',
  marked_by       uuid references public.profiles(id) on delete set null,
  marked_role     text,                           -- 'tutor' | 'student' (for display)
  created_at      timestamptz not null default now(),
  unique (schedule_id, occurrence_date)
);

create index if not exists class_attendance_schedule_idx
  on public.class_attendance (schedule_id, occurrence_date);

alter table public.class_attendance enable row level security;

-- Helper: is the current user the tutor or student of this schedule row?
create or replace function public.owns_schedule(sched uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_schedule s
    where s.id = sched
      and (s.tutor_id = auth.uid() or s.student_id = auth.uid())
  );
$$;

-- Paired tutor & student may read flags on their own classes; admin all.
drop policy if exists class_attendance_read on public.class_attendance;
create policy class_attendance_read on public.class_attendance
  for select using (public.is_admin() or public.owns_schedule(schedule_id));

-- Either paired party may raise a flag (only as themselves).
drop policy if exists class_attendance_insert on public.class_attendance;
create policy class_attendance_insert on public.class_attendance
  for insert with check (
    public.owns_schedule(schedule_id) and marked_by = auth.uid()
  );

-- Either paired party may clear a flag on their own class (toggle off).
drop policy if exists class_attendance_delete on public.class_attendance;
create policy class_attendance_delete on public.class_attendance
  for delete using (public.is_admin() or public.owns_schedule(schedule_id));

-- ─────────── 4. Realtime: keep both dashboards in sync ───────────
-- So a flag raised by one party reddens the other's calendar without a reload.
alter publication supabase_realtime add table public.class_schedule;
alter publication supabase_realtime add table public.class_attendance;
