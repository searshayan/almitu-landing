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

/* Student (or admin View-as): completed sessions belonging to a student. */
async function dataListStudentSessions(studentId) {
  const c = requireSb();
  const { data, error } = await c.from('sessions').select(SESSION_SELECT)
    .eq('student_id', studentId).eq('status', 'completed')
    .order('created_at', { ascending: false });
  throwIf(error, 'listStudentSessions');
  return data || [];
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
