/* ═══════════════════════════════════════════════════════
   Almitu Pro — Coordinator dashboard (B2B org role)

   A coordinator observes the tutors and students an admin placed in
   their organization (see migration_013 + admin.js's Organizations
   tab). Read-only everywhere, reusing the existing tutor/student
   dashboards via the same "View as" shell admin already has — RLS
   (not the UI) is what actually keeps it read-only. The one place a
   coordinator can change data is the class schedule, via the same
   modal editor admin uses (schedule.js's schedAdminOpen).
   ═══════════════════════════════════════════════════════ */

window.coordState = { orgs: [], activeOrgId: null, members: [], sessions: [] };

async function initCoordinatorDashboard() {
  renderHeaderNav(activeContext());
  const host = document.getElementById('viewCoordinator');
  host.innerHTML = '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading…</div>';
  try {
    const orgs = await dataListMyOrgs();
    coordState.orgs = orgs;
    if (!orgs.length) {
      host.innerHTML = `<div class="card-surface rounded-2xl p-8 text-center text-sm" style="color:var(--muted);">You haven't been added to an organization yet. Ask your admin to add you in Admin → Organizations.</div>`;
      return;
    }
    if (!coordState.activeOrgId || !orgs.some(o => o.id === coordState.activeOrgId)) {
      coordState.activeOrgId = orgs[0].id;
    }
    await coordLoadOrg();
    renderCoordinator();
  } catch (e) {
    host.innerHTML = `<div class="card-surface rounded-2xl p-8 text-center text-sm" style="color:#B91C1C;">Could not load your organization: ${escapeHtml(e.message)}</div>`;
  }
}

/* Loads the active org's members, then narrows the (RLS-scoped-to-ALL-my-
   orgs) session list down to just this org's students — otherwise a
   coordinator on two orgs would see org B's sessions while viewing org A. */
async function coordLoadOrg() {
  const members = await dataListOrgMembers(coordState.activeOrgId);
  coordState.members = members;
  const studentIds = new Set(
    members.filter(m => m.profile && m.profile.role === 'student').map(m => m.profile.id)
  );
  const allSessions = await dataListOrgSessions();
  coordState.sessions = allSessions.filter(s => studentIds.has(s.student_id));
}

async function coordSwitchOrg(orgId) {
  coordState.activeOrgId = orgId;
  await coordLoadOrg();
  renderCoordinator();
}

function renderCoordinator() {
  const host = document.getElementById('viewCoordinator');
  const orgs = coordState.orgs;
  const activeOrg = orgs.find(o => o.id === coordState.activeOrgId);
  const tutors = coordState.members.filter(m => m.profile && m.profile.role === 'tutor').map(m => m.profile);
  const students = coordState.members.filter(m => m.profile && m.profile.role === 'student').map(m => m.profile);

  const orgSwitcher = orgs.length > 1 ? `
    <select onchange="coordSwitchOrg(this.value)" class="rounded-xl px-3 py-2 text-sm field-input">
      ${orgs.map(o => `<option value="${o.id}" ${activeOrg && o.id === activeOrg.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
    </select>` : '';

  host.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-display font-bold" style="color:var(--navy);">${escapeHtml(activeOrg ? activeOrg.name : 'Organization')}</h1>
        <p class="text-sm" style="color:var(--muted);">Observe your tutors' and students' progress, manage their class schedule, and export activity reports.</p>
      </div>
      ${orgSwitcher}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>${coordRosterCard('Students', students, 'student')}</div>
      <div>${coordRosterCard('Tutors', tutors, 'tutor')}</div>
    </div>`;
}

function coordRosterCard(label, people, role) {
  const rows = people.map(p => {
    const doneCount = coordState.sessions.filter(s =>
      role === 'student' ? s.student_id === p.id : s.tutor_id === p.id
    ).length;
    return `
      <div class="px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:var(--line);">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold truncate" style="color:var(--navy);">${escapeHtml(p.full_name || p.email || 'Unnamed')}</p>
            <p class="text-[11px] truncate" style="color:var(--muted);">${escapeHtml([p.level, p.language, p.country].filter(Boolean).join(' · ') || p.email || '')}</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style="background:rgba(6,214,160,.12);color:#059669;">${doneCount} session${doneCount === 1 ? '' : 's'}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button onclick="coordViewDashboard('${role}','${p.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:#7C3AED;">View dashboard</button>
          ${role === 'student' ? `<button onclick="coordOpenSchedule('${p.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--secondary);">🗓 Schedule</button>` : ''}
        </div>
      </div>`;
  }).join('') || `<div class="text-center py-8 text-sm" style="color:var(--muted);">No ${label.toLowerCase()} in this organization yet.</div>`;

  return `<div class="card-surface rounded-2xl p-5">
    <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">${label}</h2>
    ${rows}
  </div>`;
}

/* Reuses the exact same read-only shell admin's "View as" already built —
   RLS (migration_013), not this UI, is what keeps it from changing or
   deleting anything: no coordinator policy exists on assignments or
   app_settings, and activity_attempts/sessions are select-only for them. */
function coordViewDashboard(role, id) {
  const m = coordState.members.find(x => x.profile && x.profile.id === id);
  const name = (m && m.profile && (m.profile.full_name || m.profile.email)) || (role === 'tutor' ? 'Tutor' : 'Student');
  enterViewAs(role, id, name);
}

/* Opens the same schedule editor modal admin uses (schedule.js). A
   coordinator never sees the assignments table (see migration_013), so
   the tutor for a brand-new student (no sessions yet) is resolved by
   asking, not by reading who they're assigned to. */
function coordOpenSchedule(studentId) {
  const studentRow = coordState.members.find(m => m.profile && m.profile.id === studentId && m.profile.role === 'student');
  if (!studentRow) return;
  const studentName = studentRow.profile.full_name || studentRow.profile.email || 'Student';

  const known = coordState.sessions.find(s => s.student_id === studentId && s.tutor);
  if (known) { schedAdminOpen(known.tutor_id, known.tutor.full_name || 'Tutor', studentId, studentName); return; }

  const tutors = coordState.members.filter(m => m.profile && m.profile.role === 'tutor').map(m => m.profile);
  if (!tutors.length) { showToast('Add a tutor to this organization first.', 'warn'); return; }
  if (tutors.length === 1) { schedAdminOpen(tutors[0].id, tutors[0].full_name || 'Tutor', studentId, studentName); return; }

  showModal(`
    <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">Which tutor?</h3>
    <p class="text-xs mb-4" style="color:var(--muted);">${escapeHtml(studentName)} has no sessions yet, so pick which tutor this schedule is for.</p>
    <select id="coordScheduleTutor" class="w-full rounded-xl px-4 py-3 text-sm field-input mb-4">
      ${tutors.map(t => `<option value="${t.id}">${escapeHtml(t.full_name || t.email)}</option>`).join('')}
    </select>
    <button onclick="coordConfirmScheduleTutor('${studentId}')" class="w-full py-3 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">Continue</button>`);
}

function coordConfirmScheduleTutor(studentId) {
  const sel = document.getElementById('coordScheduleTutor');
  const tutorId = sel && sel.value;
  const tutorRow = coordState.members.find(m => m.profile && m.profile.id === tutorId);
  const studentRow = coordState.members.find(m => m.profile && m.profile.id === studentId);
  if (!tutorRow || !studentRow) return;
  const modal = document.getElementById('genericModal');
  if (modal) modal.classList.add('hidden');
  schedAdminOpen(
    tutorId, tutorRow.profile.full_name || 'Tutor',
    studentId, studentRow.profile.full_name || studentRow.profile.email || 'Student'
  );
}
