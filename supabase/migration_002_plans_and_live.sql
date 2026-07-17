-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Migration 002
--   • session_plans: a tutor's REUSABLE plan library (student-agnostic)
--   • sessions: gains plan_id + meet_link, and a 'live' status
--   • backfills existing session plans into the library
--
-- ⚠️  This is INCREMENTAL and safe to run against the LIVE database.
--     Do NOT re-run migration.sql — that one drops every table.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run more than once (every step is guarded).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────── 1. sessions.status: enum → text + CHECK ───────────
-- We need a new 'live' value. ALTER TYPE ... ADD VALUE cannot run inside the
-- SQL editor's transaction block, so we move to text + CHECK, which is also
-- easier to extend later. (The old session_status enum is left in place,
-- unused and harmless.)
alter table public.sessions alter column status drop default;
alter table public.sessions alter column status type text using status::text;
alter table public.sessions alter column status set default 'planned';

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('planned', 'live', 'completed'));

-- ─────────── 2. session_plans — the reusable library ───────────
create table if not exists public.session_plans (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.profiles(id) on delete cascade,
  title        text,
  session_type text,
  level        text,
  duration     int,
  plan         jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.session_plans enable row level security;
create index if not exists session_plans_tutor_idx on public.session_plans (tutor_id);

-- reuse the existing updated_at helper from migration.sql
drop trigger if exists session_plans_touch_updated on public.session_plans;
create trigger session_plans_touch_updated
  before update on public.session_plans
  for each row execute function public.touch_updated_at();

-- RLS: a tutor fully owns their own plans; admins may read all.
drop policy if exists session_plans_tutor_all on public.session_plans;
create policy session_plans_tutor_all on public.session_plans
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

drop policy if exists session_plans_admin_read on public.session_plans;
create policy session_plans_admin_read on public.session_plans
  for select using (public.is_admin());

-- ─────────── 3. sessions: link to a plan + carry the Meet link ───────────
alter table public.sessions add column if not exists plan_id uuid
  references public.session_plans(id) on delete set null;
alter table public.sessions add column if not exists meet_link text;

-- ─────────── 4. Backfill: lift existing plans into the library ───────────
-- One library entry per (tutor, title), newest wins. Guarded so re-running
-- this migration doesn't create duplicates.
insert into public.session_plans (tutor_id, title, session_type, level, duration, plan, created_at)
select distinct on (s.tutor_id, s.title)
       s.tutor_id, s.title, s.session_type, s.level, s.duration, s.plan, s.created_at
from public.sessions s
where s.plan is not null
  and not exists (
    select 1 from public.session_plans p
    where p.tutor_id = s.tutor_id
      and p.title is not distinct from s.title
  )
order by s.tutor_id, s.title, s.created_at desc;

-- Point existing sessions at their matching library plan.
update public.sessions s
set plan_id = p.id
from public.session_plans p
where s.plan_id is null
  and p.tutor_id = s.tutor_id
  and p.title is not distinct from s.title;

-- ─────────── Result ───────────
select 'migration 002 complete' as status,
       (select count(*) from public.session_plans) as plans_in_library,
       (select count(*) from public.sessions)      as sessions_total;
