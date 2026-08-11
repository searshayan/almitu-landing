-- ═══════════════════════════════════════════════════════════════════
-- Almitu Pilot — Migration 006
--   • amie_messages: a student's private chat with "Amie", the AI study buddy
--   • Rows are written ONLY by the amie-chat Edge Function (service role),
--     which is also where the AI key lives — students never see the key.
--   • Students may read their own history; nobody else (privacy, like DMs).
--   • A daily message cap is enforced by the Edge Function by counting the
--     student's 'user' rows created today (cheap cost guardrail for the pilot).
--
-- ⚠️  INCREMENTAL and safe to run against the LIVE database.
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run more than once (every step is guarded).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.amie_messages (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);
alter table public.amie_messages enable row level security;

-- Read the thread newest-last; also backs the "messages sent today" cap count.
create index if not exists amie_messages_student_idx
  on public.amie_messages (student_id, created_at);

-- Students read ONLY their own conversation. No client insert/update/delete
-- policy on purpose: only the Edge Function (service role, bypasses RLS)
-- writes here, so a student can never forge an assistant turn or another
-- student's history.
drop policy if exists amie_messages_student_read on public.amie_messages;
create policy amie_messages_student_read on public.amie_messages
  for select using (student_id = auth.uid());

select 'migration 006 complete' as status,
       (select count(*) from public.amie_messages) as amie_messages_total;
