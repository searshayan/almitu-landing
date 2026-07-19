/* ═══════════════════════════════════════════════════════
   Almitu Pro — Admin dashboard
   Tabs: Users (approve / set role) · Assignments (tutor↔student) ·
   AI Settings (central engine config). Admins can also open any
   tutor/student dashboard read-only via "View as".
   ═══════════════════════════════════════════════════════ */

var adminActiveTab = 'users';
window.adminData = { users: [], assignments: [] };

async function initAdminDashboard() {
  loadRemoteConfig();
  renderHeaderNav(activeContext());
  const host = document.getElementById('viewAdmin');
  host.innerHTML = '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading…</div>';
  try {
    const [users, assignments] = await Promise.all([dataListUsers(), dataListAssignments()]);
    adminData.users = users;
    adminData.assignments = assignments;
    renderAdmin();
  } catch (e) {
    host.innerHTML = `<div class="card-surface rounded-2xl p-8 text-center text-sm" style="color:#B91C1C;">Could not load admin data: ${escapeHtml(e.message)}</div>`;
  }
}

function adminTab(tab) {
  adminActiveTab = tab;
  renderHeaderNav(activeContext());
  renderAdmin();
}

function renderAdmin() {
  const host = document.getElementById('viewAdmin');
  let body;
  if (adminActiveTab === 'assignments') body = renderAssignmentsTab();
  else if (adminActiveTab === 'settings') body = renderSettingsTab();
  else if (adminActiveTab === 'curriculum') body = renderCurriculumTabBody();
  else body = renderUsersTab();

  host.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-display font-bold" style="color:var(--navy);">Admin Dashboard</h1>
      <p class="text-sm" style="color:var(--muted);">Approve people, set roles, assign students to tutors, and manage the AI engine.</p>
    </div>
    ${body}`;
}

/* ─────────────── Users tab ─────────────── */

function roleOptions(current) {
  const opts = [['', '— no role —'], ['admin', 'Admin'], ['tutor', 'Tutor'], ['student', 'Student']];
  return opts.map(([v, l]) => `<option value="${v}" ${v === (current || '') ? 'selected' : ''}>${l}</option>`).join('');
}

function statusBadge(status) {
  const map = {
    pending:  ['rgba(255,210,63,.15)', '#B45309', 'Pending'],
    approved: ['rgba(6,214,160,.12)', '#059669', 'Approved'],
    rejected: ['rgba(239,68,68,.1)', '#B91C1C', 'Rejected']
  };
  const m = map[status] || map.pending;
  return `<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:${m[0]};color:${m[1]};">${m[2]}</span>`;
}

function renderUsersTab() {
  const users = adminData.users;
  const pending = users.filter(u => u.status === 'pending');

  const rows = users.map(u => {
    const isSelf = u.id === currentUserId();
    const actions = [];
    if (u.status === 'pending') {
      actions.push(`<button onclick="adminApprove('${u.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:var(--success);">Approve</button>`);
      actions.push(`<button onclick="adminSetStatus('${u.id}','rejected')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:#B91C1C;">Reject</button>`);
    } else if (u.status === 'approved') {
      if ((u.role === 'tutor' || u.role === 'student') && !isSelf)
        actions.push(`<button onclick="adminViewAs('${u.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:#7C3AED;">View as</button>`);
      if (!isSelf)
        actions.push(`<button onclick="adminSetStatus('${u.id}','pending')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--muted);">Suspend</button>`);
    } else if (u.status === 'rejected') {
      actions.push(`<button onclick="adminSetStatus('${u.id}','pending')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--muted);">Reconsider</button>`);
    }

    return `
      <tr style="border-top:1px solid var(--line);">
        <td class="py-3 pr-3">
          <div class="text-sm font-semibold" style="color:var(--navy);">${escapeHtml(u.full_name || '—')} ${isSelf ? '<span class="text-[9px] px-1.5 py-0.5 rounded" style="background:rgba(0,78,137,.08);color:var(--secondary);">you</span>' : ''}</div>
          <div class="text-[11px]" style="color:var(--muted);">${escapeHtml(u.email || '')}</div>
        </td>
        <td class="py-3 pr-3">
          <select onchange="adminSetRole('${u.id}', this.value)" ${isSelf ? 'disabled' : ''} class="rounded-lg px-2 py-1.5 text-xs field-input ${isSelf ? 'opacity-60' : ''}">${roleOptions(u.role)}</select>
        </td>
        <td class="py-3 pr-3">${statusBadge(u.status)}</td>
        <td class="py-3"><div class="flex flex-wrap gap-1.5">${actions.join('')}</div></td>
      </tr>`;
  }).join('');

  return `
    ${pending.length ? `<div class="mb-4 px-4 py-2.5 rounded-xl text-sm" style="background:rgba(255,210,63,.12);border:1px solid rgba(255,210,63,.3);color:#B45309;"><strong>${pending.length}</strong> ${pending.length === 1 ? 'account is' : 'accounts are'} waiting for approval.</div>` : ''}
    <div class="card-surface rounded-2xl p-5 overflow-x-auto">
      <table class="w-full text-left" style="min-width:640px;">
        <thead><tr class="text-[10px] uppercase tracking-wide" style="color:var(--muted);">
          <th class="pb-2 font-semibold">User</th><th class="pb-2 font-semibold">Role</th><th class="pb-2 font-semibold">Status</th><th class="pb-2 font-semibold">Actions</th>
        </tr></thead>
        <tbody>${rows || '<tr><td class="py-6 text-sm" style="color:var(--muted);">No users yet.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function userById(id) { return adminData.users.find(u => u.id === id); }

async function adminSetRole(id, role) {
  try {
    await dataUpdateUser(id, { role: role || null });
    const u = userById(id); if (u) u.role = role || null;
    showToast('Role updated.', 'success');
    renderAdmin();
  } catch (e) { showToast('Could not update role: ' + e.message, 'error'); }
}

async function adminApprove(id) {
  const u = userById(id);
  if (!u.role) { showToast('Assign a role first (use the Role dropdown), then approve.', 'warn'); return; }
  await adminSetStatus(id, 'approved');
}

async function adminSetStatus(id, status) {
  try {
    await dataUpdateUser(id, { status });
    const u = userById(id); if (u) u.status = status;
    showToast('Status updated.', 'success');
    renderAdmin();
  } catch (e) { showToast('Could not update status: ' + e.message, 'error'); }
}

function adminViewAs(id) {
  const u = userById(id);
  if (!u || !u.role) return;
  enterViewAs(u.role, u.id, u.full_name || u.email);
}

/* ─────────────── Assignments tab ─────────────── */

function renderAssignmentsTab() {
  const tutors = adminData.users.filter(u => u.role === 'tutor' && u.status === 'approved');
  const students = adminData.users.filter(u => u.role === 'student' && u.status === 'approved');

  const tutorOpts = tutors.map(t => `<option value="${t.id}">${escapeHtml(t.full_name || t.email)}</option>`).join('');
  const studentOpts = students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.email)}</option>`).join('');

  const list = adminData.assignments.map(a => `
    <div class="flex items-center justify-between px-4 py-3 rounded-xl border mb-2" style="background:white;border-color:var(--line);">
      <div class="text-sm" style="color:var(--navy);">
        <span class="font-semibold">${escapeHtml(a.student ? (a.student.full_name || a.student.email) : '—')}</span>
        <span style="color:var(--muted);"> → </span>
        <span class="font-semibold">${escapeHtml(a.tutor ? (a.tutor.full_name || a.tutor.email) : '—')}</span>
      </div>
      <button onclick="adminUnassign('${a.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:#EF4444;">Remove</button>
    </div>`).join('') || `<div class="text-center py-8 text-sm" style="color:var(--muted);">No assignments yet.</div>`;

  const canAssign = tutors.length && students.length;

  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-5">
        <div class="card-surface rounded-2xl p-5">
          <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">Assign a student to a tutor</h2>
          ${canAssign ? `
            <label class="block text-xs font-medium mb-1.5" style="color:var(--muted);">Student</label>
            <select id="assignStudent" class="w-full mb-3 rounded-xl px-4 py-3 text-sm field-input">${studentOpts}</select>
            <label class="block text-xs font-medium mb-1.5" style="color:var(--muted);">Tutor</label>
            <select id="assignTutor" class="w-full mb-4 rounded-xl px-4 py-3 text-sm field-input">${tutorOpts}</select>
            <button onclick="adminAssign()" class="w-full py-3 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">Assign</button>
          ` : `<p class="text-sm" style="color:var(--muted);">You need at least one approved tutor and one approved student. Approve users and set their roles first.</p>`}
        </div>
      </div>
      <div class="lg:col-span-7">
        <div class="card-surface rounded-2xl p-5">
          <h2 class="text-sm font-semibold mb-4" style="color:var(--navy);">Current assignments</h2>
          ${list}
        </div>
      </div>
    </div>`;
}

async function adminAssign() {
  const studentId = document.getElementById('assignStudent').value;
  const tutorId = document.getElementById('assignTutor').value;
  if (!studentId || !tutorId) return;
  try {
    await dataAssign(tutorId, studentId);
    adminData.assignments = await dataListAssignments();
    showToast('Student assigned.', 'success');
    renderAdmin();
  } catch (e) {
    showToast(/duplicate|unique/i.test(e.message) ? 'That student is already assigned to that tutor.' : ('Assign failed: ' + e.message), 'error');
  }
}

async function adminUnassign(id) {
  try {
    await dataUnassign(id);
    adminData.assignments = adminData.assignments.filter(a => a.id !== id);
    showToast('Assignment removed.', 'info');
    renderAdmin();
  } catch (e) { showToast('Remove failed: ' + e.message, 'error'); }
}

/* ─────────────── AI Settings tab ─────────────── */

function renderSettingsTab() {
  const cfg = getConfig();
  const labels = { demo: 'Demo Engine (rule-based)', claude: 'Claude API', custom: 'Custom API' };
  return `
    <div class="card-surface rounded-2xl p-6 max-w-lg">
      <h2 class="text-base font-semibold mb-1" style="color:var(--navy);">AI Engine</h2>
      <p class="text-xs mb-4" style="color:var(--muted);">This choice applies to every tutor's session generation. Keys are stored in your project's database and only sent to the provider you pick.</p>
      <div class="flex items-center justify-between px-4 py-3 rounded-xl mb-4" style="background:var(--surface);border:1px solid var(--line);">
        <span class="text-sm font-semibold" style="color:var(--navy);">Current: ${labels[cfg.engine] || 'Demo Engine'}</span>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:rgba(6,214,160,.12);color:#059669;">active</span>
      </div>
      <button onclick="openSettings()" class="w-full py-3 rounded-xl text-white text-sm font-semibold glow-primary" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">Manage AI configuration</button>
    </div>`;
}
