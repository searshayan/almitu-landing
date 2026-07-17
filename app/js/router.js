/* ═══════════════════════════════════════════════════════
   Almitu Pro — Router / app shell

   Single dispatcher (routeApp) that decides which top-level view
   to show based on auth + profile, plus the auth form handlers,
   role-aware header, admin "View as", and the tutor/student homes.
   ═══════════════════════════════════════════════════════ */

/* When an admin is impersonating: { role, id, name }. Null otherwise. */
let viewAsTarget = null;

/* The user + role currently being rendered (respects View-as). */
function activeContext() {
  const p = currentProfile();
  if (viewAsTarget) return { role: viewAsTarget.role, userId: viewAsTarget.id, name: viewAsTarget.name, readOnly: true };
  return { role: p ? p.role : null, userId: currentUserId(), name: p ? p.full_name : '', readOnly: false };
}

/* ─────────────── top-level view switching ─────────────── */

function showOnly(id) {
  ['authView', 'pendingView', 'appShell'].forEach(v => {
    document.getElementById(v).classList.toggle('hidden', v !== id);
  });
}

function routeApp() {
  const a = window.almituAuth;

  if (a.loading) return;                       // wait for the initial session check

  if (!isSupabaseConfigured()) {
    document.getElementById('authConfigWarn').classList.remove('hidden');
    setAuthMode(authMode);
    showOnly('authView');
    return;
  }

  if (!a.user) { setAuthMode(authMode); showOnly('authView'); return; }

  const p = a.profile;
  if (!p || p.status !== 'approved' || !p.role) {
    renderPending(p);
    showOnly('pendingView');
    return;
  }

  // Approved + roled → the app.
  showOnly('appShell');
  const ctx = activeContext();
  renderHeader(ctx, p);
  if (ctx.role === 'admin') showDashboard('admin');
  else if (ctx.role === 'tutor') showDashboard('tutor');
  else showDashboard('student');
}

function showDashboard(kind) {
  document.getElementById('viewAdmin').classList.toggle('hidden', kind !== 'admin');
  document.getElementById('viewTutor').classList.toggle('hidden', kind !== 'tutor');
  document.getElementById('viewStudent').classList.toggle('hidden', kind !== 'student');
  if (kind === 'admin') initAdminDashboard();
  else if (kind === 'tutor') initTutorDashboard();
  else initStudentDashboard();
}

/* ─────────────── header ─────────────── */

function renderHeader(ctx, profile) {
  const roleLabels = { admin: 'Admin', tutor: 'Tutor', student: 'Student' };
  const badge = document.getElementById('roleBadge');
  badge.textContent = roleLabels[ctx.role] || '';
  const badgeColors = {
    admin:   ['rgba(124,58,246,.1)', '#6D28D9'],
    tutor:   ['rgba(255,107,53,.1)', 'var(--primary)'],
    student: ['rgba(0,78,137,.08)', 'var(--secondary)']
  };
  const bc = badgeColors[ctx.role] || badgeColors.student;
  badge.style.background = bc[0]; badge.style.color = bc[1];

  document.getElementById('userNameLabel').textContent = profile.full_name || '';
  document.getElementById('userEmailLabel').textContent = profile.email || '';

  // View-as banner
  const banner = document.getElementById('viewAsBanner');
  if (viewAsTarget) {
    banner.classList.remove('hidden');
    document.getElementById('viewAsName').textContent = viewAsTarget.name || '';
    document.getElementById('viewAsRole').textContent = '(' + (roleLabels[viewAsTarget.role] || '') + ')';
  } else {
    banner.classList.add('hidden');
  }

  // Progress bar is only meaningful in the tutor prep/live flow.
  document.getElementById('progressBar').style.opacity = ctx.role === 'tutor' ? '1' : '0';

  renderHeaderNav(ctx);
}

function renderHeaderNav(ctx) {
  const nav = document.getElementById('headerNav');
  const btn = (label, fn, active) =>
    `<button onclick="${fn}" class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all" style="${active ? 'background:var(--primary);color:white;' : 'color:var(--muted);'}">${label}</button>`;

  if (ctx.role === 'admin' && !viewAsTarget) {
    nav.innerHTML =
      btn('Users', "adminTab('users')", adminActiveTab === 'users') +
      btn('Assignments', "adminTab('assignments')", adminActiveTab === 'assignments') +
      btn('AI Settings', "adminTab('settings')", adminActiveTab === 'settings');
  } else if (ctx.role === 'tutor') {
    nav.innerHTML = '';   // tutor navigates via the home / prep bar
  } else {
    nav.innerHTML = '';
  }
}

/* ─────────────── auth form ─────────────── */

let authMode = 'signin';

function setAuthMode(mode) {
  authMode = mode;
  const isUp = mode === 'signup';
  document.getElementById('authNameRow').classList.toggle('hidden', !isUp);
  document.getElementById('authName').required = isUp;
  document.getElementById('authSubmit').textContent = isUp ? 'Create account' : 'Sign in';
  document.getElementById('authPassword').setAttribute('autocomplete', isUp ? 'new-password' : 'current-password');
  const on = 'background:var(--primary);color:white;';
  const off = 'color:var(--muted);';
  document.getElementById('authTabSignin').style.cssText = isUp ? off : on;
  document.getElementById('authTabSignup').style.cssText = isUp ? on : off;
  showAuthMsg('');
}

function showAuthMsg(text, kind) {
  const el = document.getElementById('authMsg');
  if (!text) { el.classList.add('hidden'); return; }
  el.textContent = text;
  el.style.color = kind === 'error' ? '#B91C1C' : (kind === 'success' ? '#059669' : 'var(--muted)');
  el.classList.remove('hidden');
}

async function submitAuth(event) {
  event.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const submit = document.getElementById('authSubmit');
  submit.disabled = true;
  const original = submit.textContent;
  submit.textContent = 'Please wait…';
  try {
    if (authMode === 'signup') {
      if (!name) { showAuthMsg('Please enter your full name.', 'error'); return; }
      const { needsConfirmation } = await authSignUp(email, password, name);
      if (needsConfirmation) {
        setAuthMode('signin');
        showAuthMsg('Account created. Confirm via the email link (or ask your admin), then sign in.', 'success');
      } else {
        showAuthMsg('', '');   // onAuthStateChange will route to the pending screen
      }
    } else {
      await authSignIn(email, password);
      showAuthMsg('', '');     // onAuthStateChange routes onward
    }
  } catch (e) {
    showAuthMsg(e.message || 'Something went wrong.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
}

function renderPending(profile) {
  const msg = document.getElementById('pendingMsg');
  if (!profile) {
    msg.textContent = 'Loading your account…';
    return;
  }
  if (profile.status === 'rejected') {
    msg.innerHTML = 'Your account request was declined. Please contact your Almitu admin if you think this is a mistake.';
  } else {
    msg.innerHTML = `Your account (<strong>${escapeHtml(profile.email || '')}</strong>) is pending review. ` +
      `You'll get access once an admin approves you and assigns a role.`;
  }
}

async function recheckApproval() {
  await refreshProfile();
  routeApp();
  const p = currentProfile();
  if (p && p.status === 'approved' && p.role) showToast('Approved! Welcome.', 'success');
  else showToast('Still pending — check back soon.', 'info');
}

/* ─────────────── admin View-as ─────────────── */

function enterViewAs(role, id, name) {
  viewAsTarget = { role, id, name };
  routeApp();
}

function exitViewAs(silent) {
  viewAsTarget = null;
  if (!silent) routeApp();
}

/* ═════════════════════ TUTOR DASHBOARD ═════════════════════ */

window.tutorState = { sessions: [], students: [], editingSessionId: null, selectedStudent: null };

async function initTutorDashboard() {
  const ctx = activeContext();
  tutorGoHome();
  const home = document.getElementById('tutorHome');
  home.innerHTML = '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading your dashboard…</div>';
  loadRemoteConfig();   // fetch the central AI engine config (non-blocking)
  try {
    const [sessions, students] = await Promise.all([
      dataListTutorSessions(ctx.userId),
      dataListMyStudents(ctx.userId)
    ]);
    tutorState.sessions = sessions;
    tutorState.students = students;
    renderTutorHome();
  } catch (e) {
    home.innerHTML = `<div class="card-surface rounded-2xl p-8 text-center text-sm" style="color:#B91C1C;">Could not load your dashboard: ${escapeHtml(e.message)}</div>`;
  }
}

/* Show the tutor landing (sessions + students); hide the prep/live steps. */
function tutorGoHome() {
  document.getElementById('tutorHome').classList.remove('hidden');
  document.getElementById('tutorPrepBar').classList.add('hidden');
  document.getElementById('step1').classList.add('hidden');
  document.getElementById('step2').classList.add('hidden');
}

function renderTutorHome() {
  const ctx = activeContext();
  const home = document.getElementById('tutorHome');
  const s = tutorState;
  const planned = s.sessions.filter(x => x.status === 'planned');
  const completed = s.sessions.filter(x => x.status === 'completed');

  const newBtn = ctx.readOnly ? '' : `
    <button onclick="tutorNewSession()" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      New Session
    </button>`;

  home.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-display font-bold" style="color:var(--navy);">Tutor Dashboard</h1>
        <p class="text-sm" style="color:var(--muted);">Plan sessions ahead, run them live, and keep notes for each student.</p>
      </div>
      ${newBtn}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-8 space-y-6">
        ${sessionListCard('🗓 Planned sessions', planned, 'planned', ctx.readOnly)}
        ${sessionListCard('✅ Completed sessions', completed, 'completed', ctx.readOnly)}
      </div>
      <div class="lg:col-span-4">
        ${studentsCard(s.students)}
      </div>
    </div>`;
}

function sessionListCard(title, list, kind, readOnly) {
  let rows;
  if (!list.length) {
    rows = `<div class="text-center py-8 text-sm" style="color:var(--muted);">No ${kind} sessions yet.</div>`;
  } else {
    rows = list.map(row => {
      const nb = rowToNotebook(row);
      const studentName = (row.student && row.student.full_name) || nb.studentName || 'Unassigned';
      const open = kind === 'planned' && !readOnly
        ? `<button onclick="tutorOpenPlanned('${row.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:var(--primary);">Open &amp; launch</button>`
        : `<button onclick="tutorViewSession('${row.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--muted);">View</button>`;
      const del = readOnly ? '' : `<button onclick="tutorDeleteSession('${row.id}')" title="Delete" class="text-[11px] font-semibold px-2 py-1 rounded-lg ml-auto" style="background:white;border:1px solid var(--line);color:#EF4444;">🗑</button>`;
      return `
        <div class="px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:var(--line);">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold truncate mr-2" style="color:var(--navy);">${escapeHtml(nb.title)}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style="background:rgba(0,78,137,.06);color:var(--secondary);">${escapeHtml(getSessionType(nb.sessionType).label)}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] mb-2" style="color:var(--muted);">
            <span>👤 ${escapeHtml(studentName)}</span><span>·</span>
            <span>${escapeHtml(nb.plan?.meta?.level || nb.student.level || '')}</span><span>·</span>
            <span>${nb.duration}m</span><span>·</span><span>${nb.date}</span>
          </div>
          <div class="flex gap-2">${open}${del}</div>
        </div>`;
    }).join('');
  }
  return `<div class="card-surface rounded-2xl p-5">
      <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">${title}</h2>
      ${rows}
    </div>`;
}

function studentsCard(students) {
  const rows = students.length
    ? students.map(st => `
        <div class="px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:var(--line);">
          <p class="text-sm font-semibold" style="color:var(--navy);">${escapeHtml(st.full_name || 'Student')}</p>
          <p class="text-[11px]" style="color:var(--muted);">${escapeHtml([st.level, st.language, st.country].filter(Boolean).join(' · ') || st.email || '')}</p>
        </div>`).join('')
    : `<div class="text-center py-8 text-sm" style="color:var(--muted);">No students assigned yet. Ask your admin to assign students to you.</div>`;
  return `<div class="card-surface rounded-2xl p-5">
      <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">👥 My Students</h2>
      ${rows}
    </div>`;
}

/* ── Tutor: start a new session (opens the prep engine) ── */
function tutorNewSession() {
  if (activeContext().readOnly) return;
  tutorState.editingSessionId = null;
  tutorState.selectedStudent = null;
  document.getElementById('tutorHome').classList.add('hidden');
  document.getElementById('tutorPrepBar').classList.remove('hidden');
  document.getElementById('tutorPrepContext').textContent = 'New session';
  renderTutorStudentPicker();
  if (typeof resetPrepForm === 'function') resetPrepForm();
  showStep(1);
}

/* ── Tutor: open a planned session → load its plan into the preview to launch ── */
function tutorOpenPlanned(id) {
  const row = tutorState.sessions.find(x => x.id === id);
  if (!row) return;
  tutorState.editingSessionId = id;
  tutorState.selectedStudent = row.student || null;
  const st = getState();
  st.generatedLessonPlan = row.plan;
  st.previewSlide = 0;
  st.generation.fingerprint = row.plan && row.plan.fingerprint;
  st.generation.stale = false;
  document.getElementById('tutorHome').classList.add('hidden');
  document.getElementById('tutorPrepBar').classList.remove('hidden');
  document.getElementById('tutorPrepContext').textContent =
    'Planned: ' + ((row.plan && row.plan.meta && row.plan.meta.title) || row.title || '');
  renderTutorStudentPicker();
  showStep(1);
  renderPlanPreview();
  document.getElementById('outputPlaceholder').classList.add('hidden');
  document.getElementById('outputLoading').classList.add('hidden');
  document.getElementById('outputPlan').classList.remove('hidden');
  setGenStatus('current');
}

/* ── Tutor: view a completed session (read-only summary + notes) ── */
function tutorViewSession(id) {
  const row = tutorState.sessions.find(x => x.id === id);
  if (!row) return;
  const nb = rowToNotebook(row);
  const notes = nb.tutorNotes ? escapeHtml(nb.tutorNotes) : '<span style="color:var(--muted);">No notes recorded.</span>';
  showModal(`
    <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">${escapeHtml(nb.title)}</h3>
    <p class="text-xs mb-4" style="color:var(--muted);">${escapeHtml((row.student && row.student.full_name) || '')} · ${nb.plan?.meta?.level || ''} · ${getSessionType(nb.sessionType).label} · ${nb.duration}min · ${nb.date}</p>
    <div class="rounded-xl p-4 mb-2" style="background:rgba(255,107,53,.06);border:1px solid rgba(255,107,53,.15);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--primary);">📝 Notes &amp; Assignments</p>
      <p class="text-sm whitespace-pre-wrap leading-relaxed" style="color:var(--ink);">${notes}</p>
    </div>`);
}

async function tutorDeleteSession(id) {
  if (activeContext().readOnly) return;
  try {
    await dataDeleteSession(id);
    tutorState.sessions = tutorState.sessions.filter(x => x.id !== id);
    renderTutorHome();
    showToast('Session deleted.', 'info');
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

/* Student picker injected into the prep form (Step 1). */
function renderTutorStudentPicker() {
  const host = document.getElementById('tutorStudentPicker');
  if (!host) return;
  const students = tutorState.students || [];
  if (!students.length) {
    host.innerHTML = `<div class="px-3 py-2 rounded-xl text-[11px]" style="background:rgba(255,107,53,.06);border:1px solid rgba(255,107,53,.15);color:var(--primary);">No students assigned yet — an admin needs to assign students before you can save a session for one.</div>`;
    return;
  }
  const sel = tutorState.selectedStudent ? tutorState.selectedStudent.id : '';
  host.innerHTML = `
    <label class="block text-xs font-medium mb-1.5" style="color:var(--muted);">Student <span style="color:var(--primary);">*</span></label>
    <select id="tutorStudentSelect" onchange="onTutorStudentPick(this.value)" class="w-full rounded-xl px-4 py-3 text-sm appearance-none cursor-pointer focus:outline-none field-input">
      <option value="">Choose a student…</option>
      ${students.map(st => `<option value="${st.id}" ${st.id === sel ? 'selected' : ''}>${escapeHtml(st.full_name || st.email)}</option>`).join('')}
    </select>`;
  if (tutorState.selectedStudent) applyStudentToForm(tutorState.selectedStudent);
}

function onTutorStudentPick(id) {
  const st = (tutorState.students || []).find(x => x.id === id) || null;
  tutorState.selectedStudent = st;
  if (st) applyStudentToForm(st);
}

/* Copy a chosen student's profile into the prep form fields. */
function applyStudentToForm(st) {
  const nameEl = document.getElementById('inputName');
  if (nameEl) nameEl.value = st.full_name || '';
  const langEl = document.getElementById('inputLang');
  if (langEl && st.language) langEl.value = st.language;
  const countryEl = document.getElementById('inputCountry');
  if (countryEl && st.country) countryEl.value = st.country;
  const levelEl = document.getElementById('inputLevel');
  if (levelEl && st.level) { levelEl.value = st.level; if (typeof updateTierBadge === 'function') updateTierBadge(); }
}

/* ═════════════════════ STUDENT DASHBOARD ═════════════════════ */

async function initStudentDashboard() {
  const ctx = activeContext();
  const s = getState();
  try {
    const rows = await dataListStudentSessions(ctx.userId);
    s.savedNotebooks = rows.map(rowToNotebook);
    s.selectedNotebookId = s.savedNotebooks[0] ? s.savedNotebooks[0].id : null;
  } catch (e) {
    s.savedNotebooks = [];
    showToast('Could not load your sessions: ' + e.message, 'error');
  }
  showStep(3);
  renderNotebooks();
  if (getActiveNotebook()) actOverview();
}

/* Build a sessions-table row from the current generated plan. */
function buildSessionRow(plan, student, status, notes) {
  const meta = plan.meta || {};
  return {
    tutor_id: currentUserId(),
    student_id: student ? student.id : null,
    title: meta.title || 'Session',
    session_type: meta.sessionType || getState().sessionType,
    level: meta.level || null,
    duration: meta.duration || getState().sessionDuration,
    status: status,
    plan: plan,
    tutor_notes: notes || ''
  };
}

/* Save the current generated plan as a "planned" session (create or update). */
async function tutorSavePlanned() {
  if (activeContext().readOnly) return;
  const plan = getState().generatedLessonPlan;
  if (!plan) { showToast('Generate a session first.', 'warn'); return; }
  const student = tutorState.selectedStudent;
  if (!student) { showToast('Pick a student for this session first.', 'warn'); return; }
  try {
    const row = buildSessionRow(plan, student, 'planned', '');
    if (tutorState.editingSessionId) await dataUpdateSession(tutorState.editingSessionId, row);
    else { const created = await dataCreateSession(row); tutorState.editingSessionId = created.id; }
    showToast('Session saved under Planned sessions.', 'success');
    await initTutorDashboard();
  } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

/* ═════════════════════ tiny modal helper ═════════════════════ */

function showModal(innerHtml) {
  let modal = document.getElementById('genericModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'genericModal';
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-card p-6">
      <div class="flex justify-end -mt-2 -mr-2"><button onclick="document.getElementById('genericModal').classList.add('hidden')" class="text-xl leading-none" style="color:var(--muted);">&times;</button></div>
      ${innerHtml}
    </div>`;
  modal.classList.remove('hidden');
}
