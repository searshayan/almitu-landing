/* ═══════════════════════════════════════════════════════
   Almitu Pro — Tutor "Students" tab: the class board

   Rendering for the tutor progress views, built on the pure helpers in
   tutorProgress.js. Only reachable when tutorUiEnabled() is true (the
   Students tab appears in the tutor header); otherwise none of this runs.

   Slice 1: the class board — one row per student, those who need attention
   first, with status filters. On phones the table becomes cards.
   Line icons only; colours and sizes come from the --pp-* tokens.
   ═══════════════════════════════════════════════════════ */

const tutorBoardState = { filter: 'all', loading: false, updatedAt: null, loaded: false };

/* ─────────────── navigation ─────────────── */

function tutorStudentsSection() { return document.getElementById('tutorStudents'); }

/* Header tab: show the Students view and hide the other tutor views. */
function tutorGoStudents() {
  tutorState.view = 'students';
  ['tutorHome', 'tutorCurriculum', 'tutorPrepBar', 'step1', 'step2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('hidden');
  });
  const sec = tutorStudentsSection(); if (sec) sec.classList.remove('hidden');
  renderHeaderNav(activeContext());
  tutorRefreshBoard(true);
}

/* Re-read the practice attempts (cheap, RLS-scoped) so the board is current, then draw it. */
async function tutorRefreshBoard(force) {
  const sec = tutorStudentsSection();
  if (!sec || tutorBoardState.loading) return;
  if (force || !tutorBoardState.loaded) {
    tutorBoardState.loading = true;
    if (!tutorBoardState.loaded) sec.innerHTML = '<div class="tp-loading">Loading your students…</div>';
    try {
      const ids = (tutorState.sessions || []).map(s => s.id);
      tutorState.attempts = await dataListAttemptsForSessions(ids);
    } catch (e) {
      console.warn('tutor board: could not refresh attempts', e);   // keep what we already had
    }
    tutorBoardState.loading = false;
    tutorBoardState.loaded = true;
    tutorBoardState.updatedAt = Date.now();
  }
  renderTutorBoard();
}

function tutorBoardFilter(code) { tutorBoardState.filter = code; renderTutorBoard(); }

/* ─────────────── small renderers ─────────────── */

function _tpWhenText(r) {
  if (r.daysSincePractice == null) return 'Never';
  return r.daysSincePractice <= 0 ? 'Today' : r.daysSincePractice === 1 ? 'Yesterday' : r.daysSincePractice + ' days ago';
}

function _tpWeekDots(week) {
  const filled = Math.min(week.count, week.goal);
  return `<span class="tp-dots" aria-hidden="true">${Array.from({ length: week.goal }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</span>
    <span class="tp-muted">${week.count} of ${week.goal}</span>`;
}

function _tpSegments(latest) {
  if (!latest || !latest.total) return '';
  return `<span class="tp-seg" aria-hidden="true">${latest.steps.map(s => `<i class="${s.done ? 'on' : ''}"></i>`).join('')}</span>`;
}

function _tpAccuracy(latest) {
  if (!latest || latest.accuracy == null) return '<span class="tp-muted">no data</span>';
  const cfg = tutorCfg();
  const cls = latest.accuracy < cfg.supportAccuracy ? ' tp-lo' : latest.accuracy >= cfg.readyAccuracy ? ' tp-hi' : '';
  return `<b class="tp-acc${cls}">${Math.round(latest.accuracy * 100)}%</b>`;
}

function _tpPill(r) { return `<span class="tp-pill tp-pill-${r.status}">${escapeHtml(r.statusLabel)}</span>`; }

/* Nudge is only offered when the chat is available (real tutors; not View-as) and the
   student is one of the tutor's chat partners. */
function _tpCanNudge(r) {
  const ctx = activeContext();
  return r.status === 'nudge' && !ctx.readOnly && typeof msgOpenWithDraft === 'function'
    && msgState.built && msgState.partners.some(p => p.id === r.studentId);
}

function _tpActions(r) {
  const nudge = _tpCanNudge(r)
    ? `<button type="button" class="tp-btn tp-btn-pri" onclick="tutorNudge('${r.studentId}')">${pathIcon('send', 16)} Nudge</button>` : '';
  const view = r.latestRow
    ? `<button type="button" class="tp-btn" onclick="tutorViewSession('${r.latestRow.id}')" aria-label="View latest session for ${escapeHtml(r.name)}">View</button>` : '';
  return nudge + view;
}

function _tpRowHtml(r) {
  const attn = r.attention <= 1 ? ' tp-attn' : '';
  return `
    <tr class="${attn.trim()}">
      <th scope="row" class="tp-name"><b>${bidiText(r.name)}</b><span class="tp-muted">${escapeHtml([r.level, r.language].filter(Boolean).join(' · '))}</span></th>
      <td>${_tpWeekDots(r.week)}</td>
      <td>${pathTimeText(r.week.seconds)}</td>
      <td>${r.latest ? `${r.latest.doneCount} of ${r.latest.total}` : '<span class="tp-muted">no session</span>'}${_tpSegments(r.latest)}</td>
      <td>${_tpAccuracy(r.latest)}</td>
      <td>${_tpWhenText(r)}</td>
      <td>${_tpPill(r)}<span class="tp-reason">${escapeHtml(r.statusReason)}</span></td>
      <td class="tp-act">${_tpActions(r)}</td>
    </tr>`;
}

function _tpCardHtml(r) {
  const attn = r.attention <= 1 ? ' tp-attn' : '';
  return `
    <article class="tp-scard${attn}">
      <div class="tp-scard-top"><div class="tp-name"><b>${bidiText(r.name)}</b><span class="tp-muted">${escapeHtml([r.level, r.language].filter(Boolean).join(' · '))}</span></div>${_tpPill(r)}</div>
      <p class="tp-reason">${escapeHtml(r.statusReason)}</p>
      <dl class="tp-kv">
        <div><dt>This week</dt><dd>${r.week.count} of ${r.week.goal} days</dd></div>
        <div><dt>Time</dt><dd>${pathTimeText(r.week.seconds)}</dd></div>
        <div><dt>Latest session</dt><dd>${r.latest ? `${r.latest.doneCount} of ${r.latest.total}` : 'no session'}</dd></div>
        <div><dt>Accuracy</dt><dd>${_tpAccuracy(r.latest)}</dd></div>
        <div><dt>Last practised</dt><dd>${_tpWhenText(r)}</dd></div>
      </dl>
      <div class="tp-act">${_tpActions(r)}</div>
    </article>`;
}

/* ─────────────── the board ─────────────── */

function renderTutorBoard() {
  const sec = tutorStudentsSection();
  if (!sec) return;
  const students = tutorState.students || [];
  const head = `
    <div class="tp-head">
      <div><h1 class="tp-title">Students</h1><p class="tp-sub">Who is practising, and who may need a nudge.</p></div>
      <button type="button" class="tp-btn" onclick="tutorRefreshBoard(true)">${pathIcon('refresh', 16)} Refresh</button>
    </div>`;

  if (!students.length) {
    sec.innerHTML = head + `<div class="tp-card tp-empty">No students assigned yet. Ask your admin to assign students to you.</div>`;
    return;
  }

  const board = tutorBoard(students, tutorState.sessions, tutorState.attempts, { tz: _pathTz() });
  let filter = tutorBoardState.filter;
  if (filter !== 'all' && !board.counts[filter]) filter = tutorBoardState.filter = 'all';   // that group emptied out
  const rows = filter === 'all' ? board.rows : board.rows.filter(r => r.status === filter);

  const chip = (code, label, count) =>
    `<button type="button" class="tp-chip${filter === code ? ' on' : ''}" aria-pressed="${filter === code}" onclick="tutorBoardFilter('${code}')"><i class="tp-dot tp-dot-${code}"></i>${label} <b>${count}</b></button>`;
  const chips = chip('all', 'All', board.counts.all) +
    ['nudge', 'support', 'notstarted', 'ontrack', 'ready', 'none']
      .filter(c => board.counts[c]).map(c => chip(c, TP_STATUS_LABEL[c], board.counts[c])).join('');

  const cfg = tutorCfg();
  const legend = `<p class="tp-legend"><b>How statuses are decided.</b>
      <b>Needs a nudge:</b> no practice for ${cfg.nudgeDays} or more days after a class.
      <b>Needs support:</b> practising, but accuracy under ${Math.round(cfg.supportAccuracy * 100)}%.
      <b>Not started:</b> a recent class with no practice yet.
      <b>Ready to move on:</b> all activities done at ${Math.round(cfg.readyAccuracy * 100)}% or better.
      <b>On track:</b> everything else. Counts cover the activities recorded on the server, so Warm-up is not included, and time counts finished activities only. Weeks follow your timezone.</p>`;

  sec.innerHTML = head + `
    <div class="tp-chips" role="group" aria-label="Filter students by status">${chips}</div>
    <p class="tp-count" aria-live="polite">Showing ${rows.length} of ${board.counts.all} students${tutorBoardState.updatedAt ? ' · updated just now' : ''}</p>
    <div class="tp-card">
      <table class="tp-table">
        <caption class="tp-sr">Students, ordered by who needs attention first</caption>
        <thead><tr><th scope="col">Student</th><th scope="col">This week</th><th scope="col">Time</th><th scope="col">Latest session</th><th scope="col">Accuracy</th><th scope="col">Last practised</th><th scope="col">Status</th><th scope="col"><span class="tp-sr">Actions</span></th></tr></thead>
        <tbody>${rows.map(_tpRowHtml).join('')}</tbody>
      </table>
      <div class="tp-cards">${rows.map(_tpCardHtml).join('')}</div>
    </div>
    ${legend}`;
}

/* ─────────────── actions ─────────────── */

/* Open the chat with a friendly draft already typed in. The tutor reads it, edits it
   if they like, and presses Send: nothing is ever sent automatically. */
async function tutorNudge(studentId) {
  const student = (tutorState.students || []).find(s => s.id === studentId);
  if (!student) return;
  const summary = tutorStudentSummary(student, tutorState.sessions, tutorState.attempts, { tz: _pathTz() });
  const ok = await msgOpenWithDraft(studentId, tutorNudgeDraft(student, summary));
  if (ok) showToast('Draft ready. Edit it if you like, then press Send.', 'info');
  else showToast('Chat is not available right now.', 'warn');
}
