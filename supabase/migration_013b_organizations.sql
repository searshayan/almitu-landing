-- ═══════════════════════════════════════════════════════════════════
-- Almitu — Migration 013b: Coordinator role + Organizations (B2B)
--
--   A coordinator observes progress for the tutors and students an admin
--   has explicitly placed in their organization ("org_members" — same
--   admin-controlled-linking idea as the existing assignments table).
--   Everything is read-only EXCEPT the class schedule, which a
--   coordinator may create/edit/delete for their org's students — the
--   one place they can actually change data.
--
--   Deliberately NOT granted (no policy = RLS default-denies both read
--   and write, same pattern as app_settings/assignments already use):
--     • app_settings   — API/engine configuration
--     • assignments    — which tutor teaches which student (admin-only)
--     • messages       — tutor↔student chat stays private, even from
--                         admin (see migration_005's existing comment)
--     • session generation — no AI-engine call is wired up for this role
--
-- ⚠️  INCREMENTAL and safe to run against the LIVE database.
--     Do NOT re-run migration_001 — that one drops every table.
--
-- ⚠️  REQUIRES migration_013a_coordinator_enum.sql to have been run and
--     committed FIRST, as its own separate paste. This file references
--     the 'coordinator' enum value, which Postgres won't allow inside
--     the same transaction that created it.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all of THIS
--             file → Run. (After migration_013a, in a separate query.)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────── 1. organizations + org_members ───────────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- One row per (org, profile) — holds the coordinator(s), tutors, and
-- students an admin has placed in that organization. A profile may
-- belong to more than one org (e.g. a shared tutor serving two clients).
create table if not exists public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (org_id, profile_id)
);
alter table public.org_members enable row level security;
create index if not exists org_members_org_idx     on public.org_members (org_id);
create index if not exists org_members_profile_idx on public.org_members (profile_id);

-- ─────────── 2. Helper functions (SECURITY DEFINER, mirrors is_admin()) ───────────

create or replace function public.is_coordinator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordinator' and p.status = 'approved'
  );
$$;

-- The org ids the CALLING coordinator belongs to. security definer so
-- org_members' own policy can call this without recursing into itself
-- (same reason is_admin() is security definer for the profiles policies).
create or replace function public.my_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.org_members where profile_id = auth.uid();
$$;

-- Is `target_profile` a member of one of MY orgs? Every coordinator-scoped
-- policy below is built from this single check.
create or replace function public.coordinator_shares_org(target_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_coordinator() and exists (
    select 1 from public.org_members om
    where om.profile_id = target_profile
      and om.org_id in (select public.my_org_ids())
  );
$$;

-- ═══════════════════════ Row-Level Security ═══════════════════════

-- ---- organizations ----
drop policy if exists organizations_admin_all on public.organizations;
create policy organizations_admin_all on public.organizations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists organizations_coordinator_read on public.organizations;
create policy organizations_coordinator_read on public.organizations
  for select using (public.is_coordinator() and id in (select public.my_org_ids()));

-- ---- org_members ----
drop policy if exists org_members_admin_all on public.org_members;
create policy org_members_admin_all on public.org_members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists org_members_coordinator_read on public.org_members;
create policy org_members_coordinator_read on public.org_members
  for select using (public.is_coordinator() and org_id in (select public.my_org_ids()));

-- ---- profiles: coordinator reads their org's tutors/students/coordinators ----
drop policy if exists profiles_coordinator_reads_org on public.profiles;
create policy profiles_coordinator_reads_org on public.profiles
  for select using (public.coordinator_shares_org(profiles.id));

-- ---- sessions: read-only, scoped to org students ----
drop policy if exists sessions_coordinator_read on public.sessions;
create policy sessions_coordinator_read on public.sessions
  for select using (public.coordinator_shares_org(sessions.student_id));

-- ---- activity_attempts: read-only, scoped to org students ----
drop policy if exists activity_attempts_coordinator_select on public.activity_attempts;
create policy activity_attempts_coordinator_select on public.activity_attempts
  for select using (public.coordinator_shares_org(activity_attempts.student_id));

-- ---- class_schedule: full read/write, scoped to org students ----
-- The one table a coordinator may actually change — "access and change
-- the schedule" for their organization's students.
drop policy if exists class_schedule_coordinator_all on public.class_schedule;
create policy class_schedule_coordinator_all on public.class_schedule
  for all using (public.coordinator_shares_org(class_schedule.student_id))
  with check (public.coordinator_shares_org(class_schedule.student_id));

-- ---- class_attendance: read-only, scoped to org students ----
drop policy if exists class_attendance_coordinator_select on public.class_attendance;
create policy class_attendance_coordinator_select on public.class_attendance
  for select using (
    exists (
      select 1 from public.class_schedule s
      where s.id = class_attendance.schedule_id
        and public.coordinator_shares_org(s.student_id)
    )
  );

-- No policy added for: app_settings, assignments, messages. RLS
-- default-denies both read and write on those to any role without a
-- matching policy — same mechanism that already keeps students out of
-- app_settings today.

-- ─────────── Result ───────────
select 'migration 013b complete' as status,
       (select count(*) from public.organizations) as organizations_total;
