-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Supabase schema, security, and bootstrap
--
-- HOW TO RUN
--   1. Create a free project at https://supabase.com  (any region).
--   2. Open the project → SQL Editor → New query.
--   3. Paste this ENTIRE file and click "Run".
--   4. In the app, sign up with your admin email, then run the single
--      bootstrap statement at the very bottom of this file (Step 5) to
--      promote yourself to admin.
--
-- This script is SAFE TO RE-RUN: the cleanup block at the top drops the
-- objects first (fine on a fresh project — there's no data yet).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────── Cleanup (safe re-run) ───────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.sessions     cascade;
drop table if exists public.assignments  cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.profiles     cascade;
drop function if exists public.is_admin()                     cascade;
drop function if exists public.handle_new_user()              cascade;
drop function if exists public.protect_profile_privileges()   cascade;
drop function if exists public.touch_updated_at()             cascade;
drop type if exists public.user_role     cascade;
drop type if exists public.user_status   cascade;
drop type if exists public.session_status cascade;

-- ─────────────────────────── Enums ───────────────────────────
create type public.user_role     as enum ('admin', 'tutor', 'student');
create type public.user_status   as enum ('pending', 'approved', 'rejected');
create type public.session_status as enum ('planned', 'completed');

-- ─────────────────────────── profiles ───────────────────────────
-- One row per auth user. role is NULL until an admin assigns it.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       public.user_role,
  status     public.user_status not null default 'pending',
  -- student-only profile fields (used by the tutor prep engine)
  language   text,
  country    text,
  level      text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ───────────────────── Helper: is current user an approved admin? ─────────────────────
-- Defined AFTER profiles exists. SECURITY DEFINER so it reads profiles
-- WITHOUT triggering profiles' own RLS (prevents infinite recursion in
-- the profiles policies).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'approved'
  );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent non-admins from escalating their own role/status via self-update.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for trusted server-side contexts (SQL editor,
  -- service_role). Only guard against logged-in NON-admin users.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status then
      raise exception 'Only admins can change role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ─────────────────────────── assignments ───────────────────────────
-- Admin links a student to a tutor.
create table public.assignments (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tutor_id, student_id)
);
alter table public.assignments enable row level security;
create index assignments_tutor_idx   on public.assignments (tutor_id);
create index assignments_student_idx on public.assignments (student_id);

-- ─────────────────────────── sessions ───────────────────────────
-- Replaces the old localStorage "notebooks". `plan` holds the exact
-- generatedLessonPlan JSON the frontend already produces.
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid references public.profiles(id) on delete set null,
  title        text,
  session_type text,
  level        text,
  duration     int,
  status       public.session_status not null default 'planned',
  plan         jsonb,
  tutor_notes  text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.sessions enable row level security;
create index sessions_tutor_idx   on public.sessions (tutor_id);
create index sessions_student_idx on public.sessions (student_id);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger sessions_touch_updated
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────── app_settings ───────────────────────────
-- Single-row table for the centrally-managed AI engine config.
create table public.app_settings (
  id           int primary key default 1,
  engine       text not null default 'demo',
  claude_model text default 'claude-sonnet-4-6',
  claude_key   text default '',
  custom_url   text default '',
  custom_key   text default '',
  custom_model text default '',
  updated_at   timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict do nothing;
alter table public.app_settings enable row level security;

-- ═══════════════════════ Row-Level Security policies ═══════════════════════
-- Multiple permissive policies on the same command are OR-ed together.

-- ---- profiles ----
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
  -- (the protect_profile_privileges trigger blocks role/status escalation)

-- a tutor may read the profiles of students assigned to them
create policy profiles_tutor_reads_students on public.profiles
  for select using (
    exists (
      select 1 from public.assignments a
      where a.student_id = profiles.id and a.tutor_id = auth.uid()
    )
  );

-- a student may read the profile of their assigned tutor
create policy profiles_student_reads_tutor on public.profiles
  for select using (
    exists (
      select 1 from public.assignments a
      where a.tutor_id = profiles.id and a.student_id = auth.uid()
    )
  );

-- ---- assignments ----
create policy assignments_admin_all on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

create policy assignments_tutor_read on public.assignments
  for select using (tutor_id = auth.uid());

create policy assignments_student_read on public.assignments
  for select using (student_id = auth.uid());

-- ---- sessions ----
create policy sessions_admin_read on public.sessions
  for select using (public.is_admin());

-- a tutor owns their sessions (create/read/update/delete)
create policy sessions_tutor_all on public.sessions
  for all using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- a student may read sessions where they are the student
create policy sessions_student_read on public.sessions
  for select using (student_id = auth.uid());

-- ---- app_settings ----
-- Read is limited to admins + tutors (students never call the AI engine, and
-- this keeps the API key out of student browsers). Only admins can write.
create policy app_settings_read on public.app_settings
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'tutor')
        and p.status = 'approved'
    )
  );

create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ═══════════════════════ Step 5: bootstrap the first admin ═══════════════════════
-- After you have SIGNED UP in the app with your admin email, run ONLY this
-- line (replace the address with the exact email you signed up with):
--
--   update public.profiles set role = 'admin', status = 'approved'
--   where email = 'telaacademy022@gmail.com';
--
-- ═══════════════════════════════════════════════════════════════════
