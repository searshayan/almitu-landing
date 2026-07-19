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
  if (kind !== 'student') stopStudentLivePolling();   // don't poll off-screen

  if (kind === 'admin') initAdminDashboard();
  else if (kind === 'tutor') {
    // A re-route must never yank the tutor out of a running session — they'd
    // lose the slides, timer, notes and the Meet-link box mid-call.
    if (tutorIsInLiveSession()) return;
    initTutorDashboard();
  }
  else initStudentDashboard();
}

/* True while the tutor is actually presenting a started session. */
function tutorIsInLiveSession() {
  const step2 = document.getElementById('step2');
  return !!(window.tutorState && tutorState.currentSessionId
            && step2 && !step2.classList.contains('hidden'));
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
      btn('Curriculum', "adminTab('curriculum')", adminActiveTab === 'curriculum') +
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

window.tutorState = {
  sessions: [],          // delivered sessions (live/completed) — per student
  plans: [],             // the reusable plan library — student-agnostic
  attempts: [],          // students' practice attempts on those sessions
  students: [],
  selectedStudent: null,
  currentPlanId: null,   // library id of the plan currently loaded in the preview
  currentSessionId: null,// the live session row, once started
  openStudentId: null    // which student's history is expanded
};

async function initTutorDashboard() {
  const ctx = activeContext();
  tutorGoHome();
  const home = document.getElementById('tutorHome');
  home.innerHTML = '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading your dashboard…</div>';
  loadRemoteConfig();   // fetch the central AI engine config (non-blocking)
  try {
    const [sessions, plans, students] = await Promise.all([
      dataListTutorSessions(ctx.userId),
      dataListPlans(ctx.userId),
      dataListMyStudents(ctx.userId)
    ]);
    tutorState.sessions = sessions;
    tutorState.plans = plans;
    tutorState.students = students;
    // Practice stats for the tutor's own sessions (RLS scopes this to them).
    tutorState.attempts = await dataListAttemptsForSessions(sessions.map(s => s.id)).catch(() => []);
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

  const newBtn = ctx.readOnly ? '' : `
    <button onclick="tutorNewSession()" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      Generate New Session
    </button>`;

  home.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-display font-bold" style="color:var(--navy);">Tutor Dashboard</h1>
        <p class="text-sm" style="color:var(--muted);">Generate a session once — then reuse it with any student, as many times as you like.</p>
      </div>
      ${newBtn}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7">${plansCard(tutorState.plans, ctx.readOnly)}</div>
      <div class="lg:col-span-5">${studentsCard(tutorState.students)}</div>
    </div>`;
}

/* ── The reusable plan library ── */
function plansCard(plans, readOnly) {
  let rows;
  if (!plans.length) {
    rows = `<div class="text-center py-8 text-sm" style="color:var(--muted);">No saved plans yet. Generate a session and save it — it'll live here for reuse.</div>`;
  } else {
    rows = plans.map(p => {
      const typeLabel = getSessionType(p.session_type) ? getSessionType(p.session_type).label : (p.session_type || '');
      const date = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const use = readOnly ? '' : `<button onclick="tutorUsePlanPrompt('${p.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:var(--primary);">Use for a student</button>`;
      const del = readOnly ? '' : `<button onclick="tutorDeletePlan('${p.id}')" title="Delete plan" class="text-[11px] font-semibold px-2 py-1 rounded-lg ml-auto" style="background:white;border:1px solid var(--line);color:#EF4444;">🗑</button>`;
      return `
        <div class="px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:var(--line);">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold truncate mr-2" style="color:var(--navy);">${escapeHtml(p.title || 'Session')}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style="background:rgba(0,78,137,.06);color:var(--secondary);">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] mb-2" style="color:var(--muted);">
            <span>${escapeHtml(p.level || '')}</span><span>·</span>
            <span>${p.duration || ''}m</span><span>·</span><span>Saved ${date}</span>
          </div>
          <div class="flex gap-2">
            <button onclick="tutorViewPlan('${p.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--muted);">View content</button>
            ${use}${del}
          </div>
        </div>`;
    }).join('');
  }
  return `<div class="card-surface rounded-2xl p-5">
      <h2 class="text-sm font-semibold mb-1" style="color:var(--navy);">📚 My Session Plans</h2>
      <p class="text-[11px] mb-4" style="color:var(--muted);">Reusable — using a plan again costs nothing to generate.</p>
      ${rows}
    </div>`;
}

/* ── Students, each expanding to their own completed history ── */
function studentsCard(students) {
  if (!students.length) {
    return `<div class="card-surface rounded-2xl p-5">
        <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">👥 My Students</h2>
        <div class="text-center py-8 text-sm" style="color:var(--muted);">No students assigned yet. Ask your admin to assign students to you.</div>
      </div>`;
  }
  const rows = students.map(st => {
    const open = tutorState.openStudentId === st.id;
    const done = tutorState.sessions.filter(x => x.student_id === st.id && x.status === 'completed');
    const history = !open ? '' : `
      <div class="mt-3 pt-3" style="border-top:1px dashed var(--line);">
        ${done.length ? done.map(row => {
          const nb = rowToNotebook(row);
          const p = summariseAttempts(((tutorState.attempts) || []).filter(a => a.session_id === row.id));
          const practice = p.count
            ? `<p class="text-[10px] font-semibold" style="color:#B45309;">⚡ ${p.count} ${p.count === 1 ? 'activity' : 'activities'} · ${formatDuration(p.seconds)} · ${p.xp} XP</p>`
            : `<p class="text-[10px]" style="color:var(--muted);">No practice yet</p>`;
          return `<div class="flex items-center justify-between gap-2 py-1.5">
              <div class="min-w-0">
                <p class="text-[12px] font-semibold truncate" style="color:var(--navy);">${escapeHtml(nb.title)}</p>
                <p class="text-[10px]" style="color:var(--muted);">${nb.date} · ${nb.duration}m</p>
                ${practice}
              </div>
              <button onclick="tutorViewSession('${row.id}')" class="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0" style="background:white;border:1px solid var(--line);color:var(--muted);">View</button>
            </div>`;
        }).join('') : `<p class="text-[11px] py-2" style="color:var(--muted);">No completed sessions yet.</p>`}
      </div>`;
    return `
      <div class="px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:${open ? 'rgba(255,107,53,.35)' : 'var(--line)'};">
        <button onclick="tutorToggleStudent('${st.id}')" class="w-full text-left">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate" style="color:var(--navy);">${escapeHtml(st.full_name || 'Student')}</p>
              <p class="text-[11px]" style="color:var(--muted);">${escapeHtml([st.level, st.language, st.country].filter(Boolean).join(' · ') || st.email || '')}</p>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style="background:rgba(6,214,160,.12);color:#059669;">${done.length} done</span>
          </div>
        </button>
        ${history}
      </div>`;
  }).join('');
  return `<div class="card-surface rounded-2xl p-5">
      <h2 class="text-sm font-semibold mb-1" style="color:var(--navy);">👥 My Students</h2>
      <p class="text-[11px] mb-4" style="color:var(--muted);">Click a student to see their completed sessions.</p>
      ${rows}
    </div>`;
}

function tutorToggleStudent(id) {
  tutorState.openStudentId = tutorState.openStudentId === id ? null : id;
  renderTutorHome();
}

/* ── View a saved plan's actual slide content ── */
function tutorViewPlan(planId) {
  const p = tutorState.plans.find(x => x.id === planId);
  if (!p || !p.plan) return;
  const slides = p.plan.slides || [];
  const body = slides.map((sl, i) => `
    <div class="mb-4">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--primary);">${sl.icon || ''} ${escapeHtml(sl.label || ('Slide ' + (i + 1)))}</p>
      <div class="slide-card p-4">${sl.html || ''}</div>
    </div>`).join('') || '<p class="text-sm" style="color:var(--muted);">This plan has no slides.</p>';
  showModal(`
    <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">${escapeHtml(p.title || 'Session')}</h3>
    <p class="text-xs mb-4" style="color:var(--muted);">${escapeHtml(p.level || '')} · ${escapeHtml((getSessionType(p.session_type) || {}).label || '')} · ${p.duration || ''}min · ${slides.length} slides</p>
    <div class="max-h-[60vh] overflow-y-auto pr-1">${body}</div>`);
}

/* ── Reuse a plan: pick a student, then land in the preview as if just generated ── */
function tutorUsePlanPrompt(planId) {
  if (activeContext().readOnly) return;
  const students = tutorState.students || [];
  if (!students.length) { showToast('No students assigned yet — ask your admin to assign one.', 'warn'); return; }
  const p = tutorState.plans.find(x => x.id === planId);
  if (!p) return;
  showModal(`
    <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">Use this plan for…</h3>
    <p class="text-xs mb-4" style="color:var(--muted);">${escapeHtml(p.title || '')} — pick which student this session is for.</p>
    <select id="usePlanStudent" class="w-full rounded-xl px-4 py-3 text-sm field-input mb-4">
      ${students.map(st => `<option value="${st.id}">${escapeHtml(st.full_name || st.email)}</option>`).join('')}
    </select>
    <button onclick="tutorUsePlanConfirm('${planId}')" class="w-full py-3 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">Open session</button>`);
}

function tutorUsePlanConfirm(planId) {
  const studentId = document.getElementById('usePlanStudent').value;
  const p = tutorState.plans.find(x => x.id === planId);
  const st = (tutorState.students || []).find(x => x.id === studentId);
  if (!p || !st) return;
  const modal = document.getElementById('genericModal');
  if (modal) modal.classList.add('hidden');
  tutorLoadPlanIntoPreview(p.plan, p.id, st, 'Reusing: ' + (p.title || ''));
}

/* Load a plan object into the prep preview — the shared path for both
   "freshly generated" and "reused from the library". */
function tutorLoadPlanIntoPreview(plan, planId, student, contextLabel) {
  tutorState.currentPlanId = planId;
  tutorState.currentSessionId = null;
  tutorState.selectedStudent = student || null;
  const s = getState();
  s.generatedLessonPlan = plan;
  s.previewSlide = 0;
  s.generation.fingerprint = plan && plan.fingerprint;
  s.generation.stale = false;
  if (plan && plan.meta) {
    s.sessionType = plan.meta.sessionType || s.sessionType;
    s.sessionDuration = plan.meta.duration || s.sessionDuration;
  }
  document.getElementById('tutorHome').classList.add('hidden');
  document.getElementById('tutorPrepBar').classList.remove('hidden');
  document.getElementById('tutorPrepContext').textContent = contextLabel || '';
  renderTutorStudentPicker();
  showStep(1);
  renderPlanPreview();
  document.getElementById('outputPlaceholder').classList.add('hidden');
  document.getElementById('outputLoading').classList.add('hidden');
  document.getElementById('outputPlan').classList.remove('hidden');
  setGenStatus('current');
}

async function tutorDeletePlan(id) {
  if (activeContext().readOnly) return;
  try {
    await dataDeletePlan(id);
    tutorState.plans = tutorState.plans.filter(x => x.id !== id);
    renderTutorHome();
    showToast('Plan deleted.', 'info');
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

/* ── Tutor: generate a brand-new session (opens the prep engine) ── */
function tutorNewSession() {
  if (activeContext().readOnly) return;
  tutorState.currentPlanId = null;
  tutorState.currentSessionId = null;
  tutorState.selectedStudent = null;
  document.getElementById('tutorHome').classList.add('hidden');
  document.getElementById('tutorPrepBar').classList.remove('hidden');
  document.getElementById('tutorPrepContext').textContent = 'New session';
  renderTutorStudentPicker();
  if (typeof resetPrepForm === 'function') resetPrepForm();
  showStep(1);
}

/* ── Tutor: view a completed session (read-only summary + notes) ── */
function tutorViewSession(id) {
  const row = tutorState.sessions.find(x => x.id === id);
  if (!row) return;
  const nb = rowToNotebook(row);
  const notes = nb.tutorNotes ? escapeHtml(nb.tutorNotes) : '<span style="color:var(--muted);">No notes recorded.</span>';

  const attempts = ((tutorState.attempts) || []).filter(a => a.session_id === row.id);
  const p = summariseAttempts(attempts);
  const practiceBlock = p.count ? `
    <div class="rounded-xl p-4 mt-2" style="background:rgba(255,210,63,.10);border:1px solid rgba(255,210,63,.35);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-2" style="color:#B45309;">⚡ Practice after this session</p>
      <p class="text-sm font-semibold mb-3" style="color:var(--navy);">${p.count} ${p.count === 1 ? 'activity' : 'activities'} · ${formatDuration(p.seconds)} · ${p.xp} XP</p>
      <div class="space-y-1">
        ${attempts.map(a => `
          <div class="flex items-center justify-between gap-2 text-[11px] py-1" style="border-top:1px dashed rgba(180,83,9,.2);">
            <span class="font-semibold" style="color:var(--ink);">${escapeHtml(ACTIVITY_LABELS[a.activity] || a.activity)}${a.challenge ? ' ⚡' : ''}</span>
            <span style="color:var(--muted);">${escapeHtml(formatAttemptScore(a))} · ${formatDuration(a.seconds)} · +${a.xp} XP</span>
          </div>`).join('')}
      </div>
    </div>`
    : `<div class="rounded-xl p-4 mt-2 text-center" style="background:var(--surface);border:1px solid var(--line);">
         <p class="text-xs" style="color:var(--muted);">No post-session practice recorded yet.</p>
       </div>`;

  showModal(`
    <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">${escapeHtml(nb.title)}</h3>
    <p class="text-xs mb-4" style="color:var(--muted);">${escapeHtml((row.student && row.student.full_name) || '')} · ${nb.plan?.meta?.level || ''} · ${getSessionType(nb.sessionType).label} · ${nb.duration}min · ${nb.date}</p>
    <div class="rounded-xl p-4" style="background:rgba(255,107,53,.06);border:1px solid rgba(255,107,53,.15);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--primary);">📝 Notes &amp; Assignments</p>
      <p class="text-sm whitespace-pre-wrap leading-relaxed" style="color:var(--ink);">${notes}</p>
    </div>
    ${practiceBlock}`);
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

window.studentProgress = { attempts: [] };

async function initStudentDashboard() {
  const ctx = activeContext();
  const s = getState();
  try {
    const [rows, attempts] = await Promise.all([
      dataListStudentSessions(ctx.userId),
      dataListAttemptsForStudent(ctx.userId).catch(() => [])
    ]);
    s.savedNotebooks = rows.map(rowToNotebook);
    s.selectedNotebookId = s.savedNotebooks[0] ? s.savedNotebooks[0].id : null;
    studentProgress.attempts = attempts;
  } catch (e) {
    s.savedNotebooks = [];
    showToast('Could not load your sessions: ' + e.message, 'error');
  }
  showStep(3);
  renderNotebooks();
  renderStudentXpBadge();
  if (getActiveNotebook()) actOverview();

  // Watch for the tutor starting a session / sharing the Meet link.
  refreshStudentLive(ctx.userId);
  startStudentLivePolling(ctx.userId);
}

/* ── Student XP badge: lifetime total + this session's practice ── */
function renderStudentXpBadge() {
  const host = document.getElementById('studentXpBadge');
  if (!host) return;
  const all = (window.studentProgress && studentProgress.attempts) || [];
  const lifetime = summariseAttempts(all);
  if (!lifetime.count) { host.classList.add('hidden'); host.innerHTML = ''; return; }

  const nb = getActiveNotebook();
  const thisSession = summariseAttempts(all.filter(a => nb && a.session_id === nb.id));

  const stat = (label, value, color) => `
    <div class="text-center px-3">
      <p class="text-lg font-bold font-display leading-tight" style="color:${color};">${value}</p>
      <p class="text-[10px] uppercase tracking-wide" style="color:var(--muted);">${label}</p>
    </div>`;

  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl mb-6" style="background:rgba(255,210,63,.10); border:1px solid rgba(255,210,63,.35);">
      <div class="flex items-center gap-2">
        <span class="text-xl">⚡</span>
        <div>
          <p class="text-sm font-semibold" style="color:var(--navy);">${lifetime.xp} XP earned</p>
          <p class="text-[11px]" style="color:var(--muted);">${lifetime.count} ${lifetime.count === 1 ? 'activity' : 'activities'} · ${formatDuration(lifetime.seconds)} of practice, all time</p>
        </div>
      </div>
      <div class="flex items-center divide-x" style="border-color:var(--line);">
        ${stat('This session', thisSession.xp + ' XP', '#B45309')}
        ${stat('Activities', thisSession.count, 'var(--secondary)')}
        ${stat('Time', formatDuration(thisSession.seconds), 'var(--secondary)')}
      </div>
    </div>`;
}

/* ── "Join the Session" banner: locked until the tutor shares a link ── */

const STUDENT_POLL_MS = 10000;

function startStudentLivePolling(studentId) {
  stopStudentLivePolling();                     // never stack timers
  window._studentPoll = setInterval(() => refreshStudentLive(studentId), STUDENT_POLL_MS);
}

function stopStudentLivePolling() {
  if (window._studentPoll) { clearInterval(window._studentPoll); window._studentPoll = null; }
}

async function refreshStudentLive(studentId) {
  try {
    const live = await dataGetLiveSessionForStudent(studentId);
    renderStudentLiveBanner(live);
  } catch (e) {
    // Silent: polling shouldn't spam the student with toasts.
    console.warn('live poll failed', e);
  }
}

function renderStudentLiveBanner(live) {
  const host = document.getElementById('studentLiveBanner');
  if (!host) return;
  if (!live) { host.classList.add('hidden'); host.innerHTML = ''; return; }

  const link = live.meet_link;
  const tutorName = (live.tutor && live.tutor.full_name) || 'Your tutor';
  const title = live.title || 'your session';
  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl mb-6" style="background:${link ? 'rgba(6,214,160,.08)' : 'rgba(255,210,63,.10)'}; border:1px solid ${link ? 'rgba(6,214,160,.3)' : 'rgba(255,210,63,.35)'};">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style="background:${link ? '#059669' : '#B45309'};"></span>
        <div class="min-w-0">
          <p class="text-sm font-semibold" style="color:var(--navy);">${link ? 'Your session is ready to join' : 'Your session is starting…'}</p>
          <p class="text-[11px] truncate" style="color:var(--muted);">${escapeHtml(tutorName)} · ${escapeHtml(title)}${link ? '' : ' — waiting for your tutor to share the link'}</p>
        </div>
      </div>
      ${link
        ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold glow-success flex-shrink-0" style="background:linear-gradient(135deg, #06D6A0, #05B586);">
             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
             Join the Session
           </a>`
        : `<button disabled class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 cursor-not-allowed" style="background:#E5E7EB; color:#9CA3AF;">
             Join the Session
           </button>`}
    </div>`;
}

/* Build a sessions-table row (one delivery of a plan to one student). */
function buildSessionRow(plan, student, status, notes) {
  const meta = plan.meta || {};
  return {
    tutor_id: currentUserId(),
    student_id: student ? student.id : null,
    plan_id: tutorState.currentPlanId || null,
    title: meta.title || 'Session',
    session_type: meta.sessionType || getState().sessionType,
    level: meta.level || null,
    duration: meta.duration || getState().sessionDuration,
    status: status,
    plan: plan,
    tutor_notes: notes || ''
  };
}

/* Make sure the plan currently in the preview exists in the tutor's library,
   so it's reusable later. Returns its library id. */
async function ensurePlanInLibrary(plan) {
  if (tutorState.currentPlanId) return tutorState.currentPlanId;
  const meta = plan.meta || {};
  const created = await dataCreatePlan({
    tutor_id: currentUserId(),
    title: meta.title || 'Session',
    session_type: meta.sessionType || getState().sessionType,
    level: meta.level || null,
    duration: meta.duration || getState().sessionDuration,
    plan: plan
  });
  tutorState.currentPlanId = created.id;
  tutorState.plans.unshift(created);
  return created.id;
}

/* Save the generated plan into the reusable library (student-agnostic). */
async function tutorSaveToPlans() {
  if (activeContext().readOnly) return;
  const plan = getState().generatedLessonPlan;
  if (!plan) { showToast('Generate a session first.', 'warn'); return; }
  if (tutorState.currentPlanId) { showToast('This plan is already saved in My Session Plans.', 'info'); return; }
  try {
    await ensurePlanInLibrary(plan);
    showToast('Saved to My Session Plans — reuse it with any student.', 'success');
    await initTutorDashboard();
  } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

/* ── Start The Session: open Google Meet + show the presentation ── */
function startSession() {
  if (activeContext().readOnly) { showToast('Read-only view — cannot start sessions.', 'warn'); return; }
  const plan = getState().generatedLessonPlan;
  if (!plan) { showToast('Generate or open a session first.', 'warn'); return; }
  const student = tutorState.selectedStudent;
  if (!student) { showToast('Pick a student for this session first.', 'warn'); return; }

  // Must fire synchronously inside the click handler, BEFORE any await,
  // or the popup blocker will swallow the new tab.
  window.open('https://meet.google.com/', '_blank', 'noopener');

  if (typeof _editMode !== 'undefined' && _editMode) savePvEdit();
  launchCall();          // shows the presentation in this tab

  // Then persist the live session in the background.
  (async () => {
    try {
      await ensurePlanInLibrary(plan);
      const row = await dataCreateSession(buildSessionRow(plan, student, 'live', ''));
      tutorState.currentSessionId = row.id;
      renderMeetLinkBox();
    } catch (e) {
      showToast('Could not start the session record: ' + e.message, 'error');
    }
  })();
}

/* ── The Meet-link box inside the live view ── */
function renderMeetLinkBox() {
  const host = document.getElementById('meetLinkBox');
  if (!host) return;
  const shared = tutorState.currentMeetLink;
  host.innerHTML = `
    <label class="block text-[11px] font-semibold mb-1.5" style="color:var(--navy);">🔗 Paste your Google Meet link</label>
    <div class="flex gap-1.5">
      <input id="meetLinkInput" type="url" placeholder="https://meet.google.com/abc-defg-hij" value="${escapeHtml(shared || '')}"
        class="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none field-input">
      <button onclick="shareMeetLink()" class="px-3 py-2 rounded-lg text-white text-xs font-semibold flex-shrink-0" style="background:var(--primary);">Share</button>
    </div>
    <p id="meetLinkState" class="text-[10px] mt-1.5" style="color:${shared ? '#059669' : 'var(--muted)'};">
      ${shared ? '✓ Shared — your student can now join.' : 'Your student\'s Join button stays locked until you share this.'}
    </p>
    <p class="text-[10px] mt-1.5" style="color:var(--muted);">
      Meet tab didn't open? Your browser may have blocked it —
      <a href="https://meet.google.com/" target="_blank" rel="noopener" class="font-semibold" style="color:var(--secondary); text-decoration:underline;">open Google Meet</a>.
    </p>`;
}

async function shareMeetLink() {
  const input = document.getElementById('meetLinkInput');
  const link = (input.value || '').trim();
  if (!link) { showToast('Paste the Meet link first.', 'warn'); return; }
  if (!/^https?:\/\/meet\.google\.com\//i.test(link)) {
    showToast('That doesn\'t look like a Google Meet link (https://meet.google.com/...).', 'warn'); return;
  }
  if (!tutorState.currentSessionId) { showToast('Session is still starting — try again in a moment.', 'warn'); return; }
  try {
    await dataSetMeetLink(tutorState.currentSessionId, link);
    tutorState.currentMeetLink = link;
    renderMeetLinkBox();
    showToast('Link shared — your student can join now.', 'success');
  } catch (e) { showToast('Could not share the link: ' + e.message, 'error'); }
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
