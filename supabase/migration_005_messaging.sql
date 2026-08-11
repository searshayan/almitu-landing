-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Migration 005
--   • messages: 1:1 chat between a tutor and their assigned student
--   • send / delivered / seen are three timestamps (no status enum)
--   • RLS: a message can ONLY exist between an assigned tutor↔student pair
--   • Supabase Realtime: live incoming messages + live tick updates
--
-- ⚠️  INCREMENTAL and safe to run against the LIVE database.
--     Do NOT re-run migration_001 — that one drops every table.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run more than once (every step is guarded).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────── 1. Helper: are two users an assigned pair? ───────────
-- Direction-agnostic: matches whether (a=tutor,b=student) or the reverse.
-- SECURITY DEFINER so it can read assignments regardless of the caller's
-- own RLS view (mirrors is_admin() in migration_001).
create or replace function public.are_paired(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments
    where (tutor_id = a and student_id = b)
       or (tutor_id = b and student_id = a)
  );
$$;

-- ─────────── 2. messages table ───────────
-- created_at   = "sent"       ✓
-- delivered_at = "delivered"  ✓✓   (recipient's device received it)
-- seen_at      = "seen"       ✓✓   (recipient opened the conversation)
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 4000),
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  seen_at      timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);
alter table public.messages enable row level security;

-- Fast thread reads (both directions) and a cheap unread count.
create index if not exists messages_pair_idx
  on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_unread_idx
  on public.messages (recipient_id, seen_at);

-- ─────────── 3. Immutability guard ───────────
-- The recipient is allowed to UPDATE a row (to stamp delivered_at / seen_at),
-- but must never rewrite the content, re-address it, or un-set a tick.
-- Enforced in a trigger because RLS WITH CHECK can't compare OLD vs NEW.
create or replace function public.messages_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id    is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body         is distinct from old.body
     or new.created_at   is distinct from old.created_at then
    raise exception 'messages: sender, recipient, body and created_at are immutable';
  end if;
  -- Ticks are monotonic: once set they can't be cleared or moved backwards.
  if old.delivered_at is not null
     and (new.delivered_at is null or new.delivered_at < old.delivered_at) then
    raise exception 'messages: delivered_at cannot be unset';
  end if;
  if old.seen_at is not null
     and (new.seen_at is null or new.seen_at < old.seen_at) then
    raise exception 'messages: seen_at cannot be unset';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.messages_guard_update();

-- ═══════════════════════ Row-Level Security ═══════════════════════

-- INSERT: you may only send AS yourself, and ONLY to your assigned partner.
-- This single check is what limits chat to assigned tutor↔student pairs.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and public.are_paired(sender_id, recipient_id)
  );

-- SELECT: only the two people on the message can read it.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- UPDATE: only the RECIPIENT can touch a row (to mark delivered / seen).
-- The guard trigger keeps them from editing anything but the ticks.
drop policy if exists messages_recipient_update on public.messages;
create policy messages_recipient_update on public.messages
  for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- (No admin policy on purpose: 1:1 messages stay private to the pair.
--  Admin "View as" therefore won't surface a student's private chat.)

-- ═══════════════════════ Realtime ═══════════════════════
-- Realtime respects RLS, so each client is pushed only the rows their SELECT
-- policy allows: the recipient gets INSERTs addressed to them, and the sender
-- gets the UPDATE events (delivered/seen) on the messages they sent.
alter table public.messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;   -- already added on a previous run
  when undefined_object then null;   -- publication missing (Realtime off) — ignore
end$$;

-- ─────────── Result ───────────
select 'migration 005 complete' as status,
       (select count(*) from public.messages) as messages_total;
