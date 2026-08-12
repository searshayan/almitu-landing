/* ═══════════════════════════════════════════════════════
   Almitu Pro — Data layer (Supabase CRUD wrappers)

   Thin, typed helpers over the tables in supabase/migration.sql.
   Row-Level Security does the access control; these just shape the
   queries. Every function throws on error so callers can try/catch.
   ═══════════════════════════════════════════════════════ */

function requireSb() {
  const c = sb();
  if (!c) throw new Error('Backend not configured. Add your Supabase URL and anon key in js/supabase.js.');
  return c;
}

function throwIf(error, context) {
  if (error) { console.error(context, error); throw new Error(error.message || String(error)); }
}

/* ─────────────── profiles / users ─────────────── */

async function dataGetMyProfile() {
  const c = requireSb();
  const { data: auth } = await c.auth.getUser();
  if (!auth || !auth.user) return null;
  // maybeSingle → returns null (not an error) if the profile row doesn't exist yet.
  const { data, error } = await c.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  throwIf(error, 'getMyProfile');
  return data;
}

/* Admin: every profile, newest first. */
async function dataListUsers() {
  const c = requireSb();
  const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: false });
  throwIf(error, 'listUsers');
  return data || [];
}

/* Admin: change a user's role and/or status. */
async function dataUpdateUser(id, patch) {
  const c = requireSb();
  const { error } = await c.from('profiles').update(patch).eq('id', id);
  throwIf(error, 'updateUser');
}

/* Admin: approved profiles of a given role (for the assignment UI). */
async function dataListByRole(role) {
  const c = requireSb();
  const { data, error } = await c.from('profiles')
    .select('*').eq('role', role).eq('status', 'approved')
    .order('full_name', { ascending: true });
  throwIf(error, 'listByRole');
  return data || [];
}

/* Anyone: read one profile (RLS decides if it's allowed). */
async function dataGetProfile(id) {
  const c = requireSb();
  const { data, error } = await c.from('profiles').select('*').eq('id', id).single();
  throwIf(error, 'getProfile');
  return data;
}

/* ─────────────── assignments ─────────────── */

/* Admin: all links, with tutor + student names embedded. */
async function dataListAssignments() {
  const c = requireSb();
  const { data, error } = await c.from('assignments')
    .select('id, created_at, tutor:profiles!assignments_tutor_id_fkey(id, full_name, email), student:profiles!assignments_student_id_fkey(id, full_name, email)')
    .order('created_at', { ascending: false });
  throwIf(error, 'listAssignments');
  return data || [];
}

async function dataAssign(tutorId, studentId) {
  const c = requireSb();
  const { error } = await c.from('assignments').insert({ tutor_id: tutorId, student_id: studentId });
  throwIf(error, 'assign');
}

async function dataUnassign(id) {
  const c = requireSb();
  const { error } = await c.from('assignments').delete().eq('id', id);
  throwIf(error, 'unassign');
}

/* Tutor: the students assigned to me. */
async function dataListMyStudents(tutorId) {
  const c = requireSb();
  const { data, error } = await c.from('assignments')
    .select('student:profiles!assignments_student_id_fkey(id, full_name, email, language, country, level)')
    .eq('tutor_id', tutorId);
  throwIf(error, 'listMyStudents');
  return (data || []).map(r => r.student).filter(Boolean);
}

/* Student: my assigned tutor (first, if several). */
async function dataGetMyTutor(studentId) {
  const c = requireSb();
  const { data, error } = await c.from('assignments')
    .select('tutor:profiles!assignments_tutor_id_fkey(id, full_name, email)')
    .eq('student_id', studentId).limit(1);
  throwIf(error, 'getMyTutor');
  return (data && data[0] && data[0].tutor) || null;
}

/* ─────────────── sessions ─────────────── */

const SESSION_SELECT =
  '*, student:profiles!sessions_student_id_fkey(id, full_name, language, country, level), tutor:profiles!sessions_tutor_id_fkey(id, full_name)';

async function dataCreateSession(row) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').insert(row).select(SESSION_SELECT).single();
  throwIf(error, 'createSession');
  return data;
}

async function dataUpdateSession(id, patch) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').update(patch).eq('id', id).select(SESSION_SELECT).single();
  throwIf(error, 'updateSession');
  return data;
}

async function dataDeleteSession(id) {
  const c = requireSb();
  const { error } = await c.from('sessions').delete().eq('id', id);
  throwIf(error, 'deleteSession');
}

/* Tutor (or admin View-as): every session a tutor owns. */
async function dataListTutorSessions(tutorId) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').select(SESSION_SELECT)
    .eq('tutor_id', tutorId).order('created_at', { ascending: false });
  throwIf(error, 'listTutorSessions');
  return data || [];
}

/* Set (or clear) the Google Meet link on a live session. */
async function dataSetMeetLink(id, link) {
  return dataUpdateSession(id, { meet_link: link });
}

/* Student: the tutor's currently-running session for this student, if any.
   Polled by the student dashboard so "Join the Session" can light up. */
async function dataGetLiveSessionForStudent(studentId) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').select(SESSION_SELECT)
    .eq('student_id', studentId).eq('status', 'live')
    .order('created_at', { ascending: false }).limit(1);
  throwIf(error, 'getLiveSessionForStudent');
  return (data && data[0]) || null;
}

/* Student (or admin View-as): completed sessions belonging to a student. */
async function dataListStudentSessions(studentId) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').select(SESSION_SELECT)
    .eq('student_id', studentId).eq('status', 'completed')
    .order('created_at', { ascending: false });
  throwIf(error, 'listStudentSessions');
  return data || [];
}

/* ─────────────── activity_attempts (XP + practice time) ───────────────
   One row per completed post-session activity. RLS keeps students to their
   own rows and tutors to attempts on sessions they own. */

async function dataRecordAttempt(row) {
  const c = requireSb();
  const { data, error } = await c.from('activity_attempts').insert(row).select('*').single();
  throwIf(error, 'recordAttempt');
  return data;
}

/* How many times this student already completed this activity for this
   session — drives the "half XP on repeats" rule. Counted server-side so it
   stays correct across devices. */
async function dataCountAttempts(sessionId, studentId, activity) {
  const c = requireSb();
  const { count, error } = await c.from('activity_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId).eq('student_id', studentId).eq('activity', activity);
  throwIf(error, 'countAttempts');
  return count || 0;
}

/* Student: every attempt they've made (for lifetime + per-session XP). */
async function dataListAttemptsForStudent(studentId) {
  const c = requireSb();
  const { data, error } = await c.from('activity_attempts').select('*')
    .eq('student_id', studentId).order('created_at', { ascending: false });
  throwIf(error, 'listAttemptsForStudent');
  return data || [];
}

/* Tutor: attempts across a set of their own sessions (RLS enforces ownership). */
async function dataListAttemptsForSessions(sessionIds) {
  if (!sessionIds || !sessionIds.length) return [];
  const c = requireSb();
  const { data, error } = await c.from('activity_attempts').select('*')
    .in('session_id', sessionIds).order('created_at', { ascending: false });
  throwIf(error, 'listAttemptsForSessions');
  return data || [];
}

/* ─────────────── session_plans (the tutor's reusable library) ───────────────
   A plan is student-agnostic: generated once, reusable for any number of
   students. A `sessions` row is one delivery of a plan to one student. */

async function dataListPlans(tutorId) {
  const c = requireSb();
  const { data, error } = await c.from('session_plans').select('*')
    .eq('tutor_id', tutorId).order('created_at', { ascending: false });
  throwIf(error, 'listPlans');
  return data || [];
}

async function dataCreatePlan(row) {
  const c = requireSb();
  const { data, error } = await c.from('session_plans').insert(row).select('*').single();
  throwIf(error, 'createPlan');
  return data;
}

async function dataDeletePlan(id) {
  const c = requireSb();
  const { error } = await c.from('session_plans').delete().eq('id', id);
  throwIf(error, 'deletePlan');
}

/* ─────────────── curriculum plans (shared, ownerless) ───────────────
   Pre-generated CEFR sessions: tutor_id is null, is_curriculum is true.
   Readable by every approved tutor; only admins can write them (RLS). */

/* Which curriculum sessions already exist — drives resumable generation.
   Selects only the id column, so this stays cheap as the library grows. */
async function dataListCurriculumIds() {
  const c = requireSb();
  const { data, error } = await c.from('session_plans')
    .select('curriculum_id').eq('is_curriculum', true);
  throwIf(error, 'listCurriculumIds');
  return new Set((data || []).map(r => r.curriculum_id).filter(Boolean));
}

async function dataCreateCurriculumPlan(row) {
  const c = requireSb();
  const { data, error } = await c.from('session_plans').insert(row).select('*').single();
  throwIf(error, 'createCurriculumPlan');
  return data;
}

async function dataGetCurriculumPlan(curriculumId) {
  const c = requireSb();
  const { data, error } = await c.from('session_plans').select('*')
    .eq('is_curriculum', true).eq('curriculum_id', curriculumId).maybeSingle();
  throwIf(error, 'getCurriculumPlan');
  return data;
}

/* Remove a curriculum plan so it can be regenerated with the current specs.
   Deleting a non-existent row is a no-op (not an error). */
async function dataDeleteCurriculumPlan(curriculumId) {
  const c = requireSb();
  const { error } = await c.from('session_plans').delete()
    .eq('is_curriculum', true).eq('curriculum_id', curriculumId);
  throwIf(error, 'deleteCurriculumPlan');
}

/* Every curriculum plan for a level — full rows, including the `plan` JSON.
   Heavy: use dataListCurriculumIndex for browsing. */
async function dataListCurriculumPlans(level) {
  const c = requireSb();
  let q = c.from('session_plans').select('*').eq('is_curriculum', true);
  if (level) q = q.eq('level', level);
  const { data, error } = await q.order('curriculum_id', { ascending: true });
  throwIf(error, 'listCurriculumPlans');
  return data || [];
}

/* Lightweight browse index — deliberately EXCLUDES the `plan` jsonb column.
   Each stored plan is tens of KB, so selecting it for a whole level would
   pull megabytes just to render a list of titles. The full plan is fetched
   only when a tutor actually views or teaches one. */
async function dataListCurriculumIndex(level) {
  const c = requireSb();
  let q = c.from('session_plans')
    .select('id, curriculum_id, title, session_type, level, duration')
    .eq('is_curriculum', true);
  if (level) q = q.eq('level', level);
  const { data, error } = await q.order('curriculum_id', { ascending: true });
  throwIf(error, 'listCurriculumIndex');
  return data || [];
}

/* Which levels actually have curriculum content — drives the level picker
   so tutors never see an empty level. */
async function dataListCurriculumLevels() {
  const c = requireSb();
  const { data, error } = await c.from('session_plans')
    .select('level').eq('is_curriculum', true);
  throwIf(error, 'listCurriculumLevels');
  const counts = {};
  (data || []).forEach(r => { if (r.level) counts[r.level] = (counts[r.level] || 0) + 1; });
  return counts;   // { 'Pre-A1': 37, ... }
}

/* One full plan row by primary key (used for View / Teach). */
async function dataGetPlanById(id) {
  const c = requireSb();
  const { data, error } = await c.from('session_plans').select('*').eq('id', id).maybeSingle();
  throwIf(error, 'getPlanById');
  return data;
}

/* ─────────────── messages (tutor ↔ assigned student chat) ───────────────
   send / delivered / seen are three timestamps on each row (see
   supabase/migration_005_messaging.sql). RLS guarantees a message can only
   exist between an assigned pair, so these helpers never have to re-check
   the assignment themselves. */

/* The full conversation between me and one partner, oldest → newest. */
async function dataListThread(myId, otherId) {
  const c = requireSb();
  const { data, error } = await c.from('messages')
    .select('*')
    .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
    .order('created_at', { ascending: true });
  throwIf(error, 'listThread');
  return data || [];
}

/* Send a message. Returns the inserted row (with its id + created_at "sent" mark). */
async function dataSendMessage(recipientId, body) {
  const c = requireSb();
  const { data, error } = await c.from('messages')
    .insert({ sender_id: currentUserId(), recipient_id: recipientId, body })
    .select('*').single();
  throwIf(error, 'sendMessage');
  return data;
}

/* Recipient side: stamp delivered_at on every not-yet-delivered message
   this partner sent me. Called as soon as the client receives them. */
async function dataMarkDelivered(myId, otherId) {
  const c = requireSb();
  const { error } = await c.from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('sender_id', otherId).eq('recipient_id', myId)
    .is('delivered_at', null);
  throwIf(error, 'markDelivered');
}

/* Recipient side: stamp seen_at (and delivered_at, if it somehow skipped)
   on this partner's unseen messages. Called when the thread is on screen. */
async function dataMarkSeen(myId, otherId) {
  const c = requireSb();
  const now = new Date().toISOString();
  // seen implies delivered — set delivered first for any that slipped through.
  await c.from('messages')
    .update({ delivered_at: now })
    .eq('sender_id', otherId).eq('recipient_id', myId).is('delivered_at', null);
  const { error } = await c.from('messages')
    .update({ seen_at: now })
    .eq('sender_id', otherId).eq('recipient_id', myId)
    .is('seen_at', null);
  throwIf(error, 'markSeen');
}

/* How many messages are waiting for me, unseen — for the header badge.
   { total, byUser: { <senderId>: count } } so a tutor can badge per student. */
async function dataUnreadCounts(myId) {
  const c = requireSb();
  const { data, error } = await c.from('messages')
    .select('sender_id')
    .eq('recipient_id', myId).is('seen_at', null);
  throwIf(error, 'unreadCounts');
  const byUser = {};
  (data || []).forEach(r => { byUser[r.sender_id] = (byUser[r.sender_id] || 0) + 1; });
  return { total: (data || []).length, byUser };
}

/* Realtime: live push of messages that touch me. RLS decides what I receive —
   INSERTs addressed to me, and UPDATEs (delivered/seen ticks) on messages I
   sent. `onInsert` / `onUpdate` get the changed row. Returns the channel so
   the caller can dataUnsubscribe() it on teardown. */
function dataSubscribeMessages(myId, onInsert, onUpdate) {
  const c = requireSb();
  if (!c) return null;
  const channel = c.channel('messages:' + myId)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` },
        payload => { if (onInsert) onInsert(payload.new); })
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${myId}` },
        payload => { if (onUpdate) onUpdate(payload.new); })
    .subscribe();
  return channel;
}

function dataUnsubscribe(channel) {
  const c = sb();
  if (c && channel) { try { c.removeChannel(channel); } catch (e) { /* already gone */ } }
}

/* ─────────────── Amie (student AI study buddy) ───────────────
   The AI call goes through the `amie-chat` Edge Function so the API key
   stays server-side (app_settings is not student-readable). The client never
   reads the stored history: the visible chat starts fresh each session, while
   the function itself recalls prior turns server-side for continuity. */

/* Send a message to Amie. Returns { reply, remaining } or throws.
   A 4xx from the function (e.g. daily_limit) comes back in `data.error`. */
async function dataAskAmie(message) {
  const c = requireSb();
  const { data, error } = await c.functions.invoke('amie-chat', { body: { message } });
  if (error) {
    // supabase-js hides the function's response body inside error.context
    // (a Response). Pull out the real { error, detail } so we can see it.
    let detail = error.message || 'Amie is unavailable right now.';
    let code = null;
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body && body.error) { code = body.error; detail = body.detail || body.error; }
      }
    } catch (e) { /* body not JSON */ }
    console.error('[amie] function call failed —', { code, detail, raw: error });
    const err = new Error(detail); err.code = code; throw err;
  }
  if (data && data.error) {
    console.error('[amie] function returned error —', data);
    const e = new Error(data.detail || data.error); e.code = data.error; e.payload = data; throw e;
  }
  return data;
}

/* ─────────────── app settings (AI engine config) ─────────────── */

async function dataGetSettings() {
  const c = requireSb();
  const { data, error } = await c.from('app_settings').select('*').eq('id', 1).single();
  if (error) { console.warn('getSettings', error); return null; }
  return data;
}

async function dataSaveSettings(patch) {
  const c = requireSb();
  const { error } = await c.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  throwIf(error, 'saveSettings');
}

/* ─────────────── mapping: sessions row → legacy "notebook" shape ───────────────
   step3.js was written against the old localStorage notebook object. Mapping a
   Supabase row into that exact shape lets the activity code stay untouched. */
function rowToNotebook(row) {
  const student = row.student || {};
  const created = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id: row.id,
    studentId: row.student_id || student.id || null,
    studentName: student.full_name || (row.plan && row.plan.meta && row.plan.meta.student) || 'Student',
    title: row.title || (row.plan && row.plan.meta && row.plan.meta.title) || 'Session',
    date: created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    student: {
      name: student.full_name || 'Student',
      language: student.language || (row.plan && row.plan.meta && row.plan.meta.language) || '',
      countryOfResident: student.country || '',
      level: student.level || row.level || '',
      l1Support: !!(row.plan && row.plan.formData && row.plan.formData.l1Support)
    },
    plan: row.plan,
    tutorNotes: row.tutor_notes || '',
    duration: row.duration,
    sessionType: row.session_type,
    status: row.status,
    chatLog: []   // chat removed; kept empty so any legacy .chatLog access is safe
  };
}

/* ─────────────── class schedule + attendance (migration 007) ─────────────── */

/* Store the signed-in user's detected IANA timezone on their profile, but only
   when it actually changed — avoids a write on every load. RLS: profiles_self_update. */
async function dataSetMyTimezone(userId, tz) {
  if (!userId || !tz) return;
  const c = requireSb();
  const { error } = await c.from('profiles').update({ timezone: tz }).eq('id', userId);
  throwIf(error, 'setMyTimezone');
}

/* Read one profile's stored timezone (used to skip redundant writes / for the
   admin editor's anchor). Returns null if unset. */
async function dataGetTimezone(userId) {
  const c = requireSb();
  const { data, error } = await c.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  throwIf(error, 'getTimezone');
  return (data && data.timezone) || null;
}

/* Every weekly slot visible to me (tutor sees all their students; student sees
   their own). RLS scopes this to the caller. Names come along for labelling. */
async function dataListMySchedule(userId) {
  const c = requireSb();
  const { data, error } = await c.from('class_schedule')
    .select('id, tutor_id, student_id, weekday, start_time, duration_min, anchor_tz, ' +
            'tutor:profiles!class_schedule_tutor_id_fkey(id, full_name), ' +
            'student:profiles!class_schedule_student_id_fkey(id, full_name)')
    .or(`tutor_id.eq.${userId},student_id.eq.${userId}`);
  throwIf(error, 'listMySchedule');
  return data || [];
}

/* Admin editor: the slots for one specific pairing. */
async function dataListScheduleForPair(tutorId, studentId) {
  const c = requireSb();
  const { data, error } = await c.from('class_schedule')
    .select('id, tutor_id, student_id, weekday, start_time, duration_min, anchor_tz')
    .eq('tutor_id', tutorId).eq('student_id', studentId)
    .order('weekday').order('start_time');
  throwIf(error, 'listScheduleForPair');
  return data || [];
}

/* Admin: add one weekly slot. */
async function dataAddScheduleSlot(row) {
  const c = requireSb();
  const { data, error } = await c.from('class_schedule').insert(row).select().single();
  throwIf(error, 'addScheduleSlot');
  return data;
}

/* Admin: re-anchor a pairing's existing slots when the tutor's zone is changed,
   so already-entered class times move with it (times are stored in the tutor's
   wall-clock, anchor_tz just tells the app which zone that is). */
async function dataReanchorSchedule(tutorId, studentId, tz) {
  const c = requireSb();
  const { error } = await c.from('class_schedule')
    .update({ anchor_tz: tz }).eq('tutor_id', tutorId).eq('student_id', studentId);
  throwIf(error, 'reanchorSchedule');
}

/* Admin: remove one weekly slot (cascades its attendance flags). */
async function dataDeleteScheduleSlot(id) {
  const c = requireSb();
  const { error } = await c.from('class_schedule').delete().eq('id', id);
  throwIf(error, 'deleteScheduleSlot');
}

/* "Can't attend" flags for a set of schedule rows within a set of occurrence
   dates (this week's dates). RLS scopes to the caller's pairs. */
async function dataListAttendance(scheduleIds, occurrenceDates) {
  if (!scheduleIds.length || !occurrenceDates.length) return [];
  const c = requireSb();
  const { data, error } = await c.from('class_attendance')
    .select('id, schedule_id, occurrence_date, status, marked_by, marked_role')
    .in('schedule_id', scheduleIds)
    .in('occurrence_date', occurrenceDates);
  throwIf(error, 'listAttendance');
  return data || [];
}

/* Raise a "can't attend" flag for one occurrence. */
async function dataFlagAttendance(scheduleId, occurrenceDate, myId, role) {
  const c = requireSb();
  const { error } = await c.from('class_attendance').insert({
    schedule_id: scheduleId, occurrence_date: occurrenceDate,
    status: 'cant_attend', marked_by: myId, marked_role: role
  });
  throwIf(error, 'flagAttendance');
}

/* Clear a "can't attend" flag (toggle off). */
async function dataUnflagAttendance(scheduleId, occurrenceDate) {
  const c = requireSb();
  const { error } = await c.from('class_attendance')
    .delete().eq('schedule_id', scheduleId).eq('occurrence_date', occurrenceDate);
  throwIf(error, 'unflagAttendance');
}

/* Realtime: fire cb() whenever any schedule/attendance row changes. The filter
   is coarse (whole tables) but RLS still gates what the client can read, and
   these tables are tiny + change rarely. */
function dataSubscribeSchedule(myId, cb) {
  const c = requireSb();
  if (!c) return null;
  return c.channel('schedule:' + myId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_attendance' }, () => cb && cb())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedule' }, () => cb && cb())
    .subscribe();
}
