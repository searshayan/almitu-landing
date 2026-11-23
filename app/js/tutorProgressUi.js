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
  ['tutorHome', 'tutorCurriculum', 'tutorStudent', 'tutorPrepBar', 'step1', 'step2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('hidden');
  });
  const sec = tutorStudentsSection(); if (sec) sec.classList.remove('hidden');
  renderHeaderNav(activeContext());
  tutorRefreshBoard(true);
}

/* Re-read the practice attempts (cheap, RLS-scoped). On failure we keep what we already had. */
async function _tpFetchAttempts() {
  try {
    const ids = (tutorState.sessions || []).map(s => s.id);
    tutorState.attempts = await dataListAttemptsForSessions(ids);
  } catch (e) {
    console.warn('tutor progress: could not refresh attempts', e);
  }
  tutorBoardState.loaded = true;
  tutorBoardState.updatedAt = Date.now();
}

/* Refresh the practice attempts so the board is current, then draw it. */
async function tutorRefreshBoard(force) {
  const sec = tutorStudentsSection();
  if (!sec || tutorBoardState.loading) return;
  if (force || !tutorBoardState.loaded) {
    tutorBoardState.loading = true;
    if (!tutorBoardState.loaded) sec.innerHTML = '<div class="tp-loading">Loading your students…</div>';
    await _tpFetchAttempts();
    tutorBoardState.loading = false;
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
    ? `<button type="button" class="tp-btn tp-btn-pri" onclick="tutorNudge('${escapeHtml(r.studentId)}')">${pathIcon('send', 16)} Nudge</button>` : '';
  const view = `<button type="button" class="tp-btn" onclick="tutorOpenStudent('${escapeHtml(r.studentId)}')" aria-label="View progress for ${escapeHtml(r.name)}">View</button>`;
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

/* ═══════════════════════════════════════════════════════
   One student's progress page
   ═══════════════════════════════════════════════════════ */

/* Open a student's page from the board. */
function tutorOpenStudent(studentId) {
  tutorBoardState.studentId = studentId;
  tutorState.view = 'student';
  ['tutorHome', 'tutorCurriculum', 'tutorStudents', 'tutorPrepBar', 'step1', 'step2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('hidden');
  });
  const sec = document.getElementById('tutorStudent'); if (sec) sec.classList.remove('hidden');
  renderHeaderNav(activeContext());
  renderTutorStudentPage();
  window.scrollTo(0, 0);
}

async function tutorRefreshStudent() {
  await _tpFetchAttempts();
  renderTutorStudentPage();
}

/* "4 of 6 correct (67%)", "4 pairs in 4 tries", "All cards flipped", "Not started". */
function _tpStepDetail(s) {
  if (!s.done) return 'Not started';
  const extra = (s.attempts > 1 ? ` · ${s.attempts} attempts` : '') + (s.challenge ? ' · challenge' : '');
  if (s.activity === 'flashcards') return 'All cards flipped' + extra;
  if (s.bestRatio == null) return 'Finished' + extra;
  if (s.activity === 'matching') return `${s.bestCorrect} pairs in ${s.bestTotal} ${s.bestTotal === 1 ? 'try' : 'tries'}` + extra;
  return `${s.bestCorrect} of ${s.bestTotal} correct (${Math.round(s.bestRatio * 100)}%)` + extra;
}

function _tpActivityRow(s) {
  const cfg = tutorCfg();
  const meter = s.bestRatio != null
    ? `<div class="tp-meter${s.bestRatio < cfg.revisitAccuracy ? ' tp-meter-lo' : ''}" aria-hidden="true"><i style="width:${Math.round(s.bestRatio * 100)}%"></i></div>` : '';
  const right = s.done
    ? `${s.stars ? pathStarsHtml(s.stars) : ''}${s.seconds > 0 ? `<span class="tp-muted">${pathTimeText(s.seconds)}</span>` : ''}`
    : '<span class="tp-muted">Open</span>';
  return `
    <li class="tp-arow">
      <span class="tp-ai${s.done ? ' tp-ai-done' : ''}">${s.done ? pathIcon('check', 18) : pathIcon(s.id, 18)}</span>
      <div class="tp-ab"><div class="tp-an">${escapeHtml(s.label)}</div><div class="tp-ad">${escapeHtml(_tpStepDetail(s))}</div>${meter}</div>
      <div class="tp-ar">${right}</div>
    </li>`;
}

function _tpDate(ts) {
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
}

function _tpHistoryRow(h) {
  const p = h.progress, row = h.row;
  return `
    <tr>
      <th scope="row" class="tp-name"><b>${bidiText(row.title || 'Session')}</b><span class="tp-muted">${escapeHtml(getSessionType(row.session_type).label)}</span></th>
      <td>${_tpDate(row.created_at)}</td>
      <td>${p.doneCount} of ${p.total}</td>
      <td>${p.accuracy != null ? `<b class="tp-acc${p.accuracy < tutorCfg().supportAccuracy ? ' tp-lo' : p.accuracy >= tutorCfg().readyAccuracy ? ' tp-hi' : ''}">${Math.round(p.accuracy * 100)}%</b>` : '<span class="tp-muted">no data</span>'}</td>
      <td>${pathTimeText(p.seconds)}</td>
      <td>${p.xp} XP</td>
      <td class="tp-act"><button type="button" class="tp-btn" onclick="tutorViewSession('${escapeHtml(row.id)}')" aria-label="Notes and attempts for ${escapeHtml(row.title || 'session')}">Details</button></td>
    </tr>`;
}

function renderTutorStudentPage() {
  const sec = document.getElementById('tutorStudent');
  if (!sec) return;
  const student = (tutorState.students || []).find(s => s.id === tutorBoardState.studentId);
  const back = `<button type="button" class="tp-btn" onclick="tutorGoStudents()">${pathIcon('left', 16)} Students</button>`;
  if (!student) { sec.innerHTML = `<div class="tp-head">${back}</div><div class="tp-card tp-empty">That student is no longer in your list.</div>`; return; }

  const sum = tutorStudentSummary(student, tutorState.sessions, tutorState.attempts, { tz: _pathTz() });
  const latest = sum.latest, wk = sum.week;
  const meta = [sum.level, sum.language, sum.country].filter(Boolean).join(' · ');
  const nudge = _tpCanNudge(sum)
    ? `<button type="button" class="tp-btn tp-btn-pri" onclick="tutorNudge('${escapeHtml(sum.studentId)}')">${pathIcon('send', 16)} Nudge</button>` : '';

  const head = `
    <div class="tp-pagehead">
      ${back}
      <div class="tp-who"><h1 class="tp-title">${bidiText(sum.name)}</h1><p class="tp-sub">${escapeHtml(meta)}</p></div>
      <div class="tp-pagestatus">${_tpPill(sum)}<span class="tp-reason">${escapeHtml(sum.statusReason)}</span></div>
      <div class="tp-pageactions">${nudge}<button type="button" class="tp-btn" onclick="tutorRefreshStudent()">${pathIcon('refresh', 16)} Refresh</button></div>
    </div>`;

  // ── this week ──
  const tp = pathTimeParts(wk.seconds);
  const circles = latest ? `
      <div class="pp-circles">
        <div class="pp-c">${pathRing(latest.doneCount, latest.total, 76)}<span class="pp-c-l">Activities done</span></div>
        <div class="pp-c"><div class="pp-disc${wk.seconds > 0 ? '' : ' pp-disc-zero'}${tp.unit ? '' : ' pp-disc-long'}" role="img" aria-label="${pathTimeText(wk.seconds)} practised this week"><b>${tp.n}</b>${tp.unit ? `<span>${tp.unit}</span>` : ''}</div><span class="pp-c-l">Time this week</span></div>
        <div class="pp-c"><div class="pp-disc pp-disc-xp${latest.xp > 0 ? '' : ' pp-disc-zero'}" role="img" aria-label="${latest.xp} XP on the latest session"><b>${latest.xp}</b><span>XP</span></div><span class="pp-c-l">XP this session</span></div>
      </div>` : '';
  const week = `
    <section class="pp-card" aria-label="This week's practice">
      <div class="pp-row" style="align-items:flex-start">
        <div><h2 class="pp-h">This week's practice</h2><p class="pp-sub">${wk.reached ? 'Weekly goal reached' : `${wk.count} of ${wk.goal} days · ${wk.remaining} to go`}</p></div>
        <div class="pp-side"><span class="pp-big${wk.seconds > 0 ? '' : ' pp-big-zero'}" aria-label="${pathTimeText(wk.seconds)} practised this week">${tp.n}${tp.unit ? `<small>${tp.unit}</small>` : ''}</span><span class="pp-side-l">this week</span></div>
      </div>
      ${pathBarsHtml(wk)}
      ${pathTrendRowHtml(wk)}
      ${wk.streak >= 1 ? `<p class="pp-streak">${pathIcon('flame', 14)} Practised ${wk.streak} ${wk.streak === 1 ? 'day' : 'days'} in a row</p>` : ''}
      ${circles}
    </section>`;

  // ── latest session ──
  const latestCard = latest ? `
    <section class="pp-card" aria-label="Latest session">
      <h2 class="pp-h">Latest session: ${bidiText(sum.latestRow.title || 'Session')}</h2>
      <p class="pp-sub">${_tpDate(sum.latestRow.created_at)} · ${escapeHtml(getSessionType(sum.latestRow.session_type).label)} · ${latest.doneCount} of ${latest.total} activities done</p>
      <ul class="tp-alist">${latest.steps.map(_tpActivityRow).join('')}</ul>
      <p class="tp-note">Warm-up and Explore More are not saved on the server, so they are not shown. Time counts finished activities only.</p>
    </section>` : `
    <section class="pp-card"><h2 class="pp-h">Latest session</h2><p class="pp-sub">No session has been delivered to ${escapeHtml(sum.name)} yet. Once one is, their practice appears here.</p></section>`;

  // ── history ──
  const hist = tutorSessionHistory(tutorState.sessions, tutorState.attempts, student.id, 10);
  const history = hist.length ? `
    <section class="pp-card" aria-label="Session history">
      <h2 class="pp-h">Sessions</h2>
      <div class="tp-scroll"><table class="tp-table tp-always">
        <caption class="tp-sr">Delivered sessions, newest first</caption>
        <thead><tr><th scope="col">Session</th><th scope="col">Date</th><th scope="col">Activities</th><th scope="col">Accuracy</th><th scope="col">Time</th><th scope="col">XP</th><th scope="col"><span class="tp-sr">Actions</span></th></tr></thead>
        <tbody>${hist.map(_tpHistoryRow).join('')}</tbody>
      </table></div>
    </section>` : '';

  sec.innerHTML = head + `<div id="tpBrief">${_tpBriefHtml(sum, student, tutorBoardState.curHintFor === student.id ? tutorBoardState.curIndex : null)}</div>` + `<div class="tp-grid">${week}${latestCard}</div>${history}`;
  tutorLoadCurriculumHint(student);
}

/* ═══════════════════════════════════════════════════════
   Before your next class: the brief and its hints
   ═══════════════════════════════════════════════════════ */

const TP_HINT_ICON = { checkin: 'chat', revisit: 'refresh', curriculum: 'arrow', balance: 'target' };
const TP_HINT_LABEL = { checkin: 'Check in first', revisit: 'Revisit', curriculum: 'Next in the curriculum', balance: 'Balance' };

/* The student's next scheduled class (tutor's timezone), or null. Mirrors schedNextClass(),
   but for one student. */
function tutorNextClassFor(studentId) {
  if (typeof schedState === 'undefined' || !schedState.slots || !schedState.slots.length) return null;
  const now = Date.now();
  let best = null;
  for (const slot of schedState.slots) {
    if (slot.student_id !== studentId) continue;
    const occ = schedState.occBySlot[slot.id];
    if (!occ) continue;
    let instant = occ.instant;
    const upcoming = occ.instant.getTime() + (slot.duration_min || 60) * 60000 > now;
    if (!upcoming || schedFlagFor(slot)) instant = schedOccurrence(slot, 1).instant;
    if (!best || instant < best) best = instant;
  }
  return best ? `${schedDayLabel(best)} · ${schedFmtTime(best, schedState.viewerTz)}` : null;
}

function _tpHintActions(h, student) {
  if (activeContext().readOnly) return '';   // View-as is read-only: evidence only
  const sid = student.id, a = h.action || {};
  if (a.type === 'teachAgain') return `<button type="button" class="tp-btn tp-btn-pri" onclick="tutorTeachAgain('${escapeHtml(a.sessionId)}')">Teach this session again</button>`;
  if (a.type === 'openCurriculum') return `<button type="button" class="tp-btn tp-btn-pri" onclick="tutorTeachNext('${escapeHtml(a.curriculumId)}','${escapeHtml(sid)}')">Teach this next</button>`;
  if (a.type === 'planSkill') return `<button type="button" class="tp-btn" onclick="tutorPlanSkill('${escapeHtml(a.skill)}','${escapeHtml(sid)}')">Plan a ${escapeHtml(TP_SKILL_LABELS[a.skill] || a.skill)} session</button>`;
  if (a.type === 'nudge' && _tpCanNudge({ status: 'nudge', studentId: sid })) return `<button type="button" class="tp-btn" onclick="tutorNudge('${escapeHtml(sid)}')">${pathIcon('send', 16)} Send a nudge</button>`;
  return '';
}

function _tpHintHtml(h, student) {
  const acts = _tpHintActions(h, student);
  return `
    <li class="tp-hint tp-hint-${h.kind}">
      <span class="tp-hi">${pathIcon(TP_HINT_ICON[h.kind] || 'target', 22)}</span>
      <div class="tp-hb">
        <p class="tp-hk">${escapeHtml(TP_HINT_LABEL[h.kind] || h.kind)}</p>
        <p class="tp-ht">${bidiText(h.title)}</p>
        <p class="tp-he">${bidiText(h.evidence)}</p>
        ${acts ? `<div class="tp-hacts">${acts}</div>` : ''}
      </div>
    </li>`;
}

function _tpBriefHtml(sum, student, curriculumIndex) {
  const cfg = tutorCfg();
  const hints = tutorHints(sum, tutorState.sessions, { curriculum: curriculumIndex });
  const brief = tutorBriefSummary(sum);
  const next = tutorNextClassFor(student.id);
  const body = hints.length
    ? `<ul class="tp-hints">${hints.map(h => _tpHintHtml(h, student)).join('')}</ul>`
    : `<p class="tp-allgood">${sum.latest ? 'Nothing to flag. The latest session is going well.' : 'Hints appear after the first session is delivered.'}</p>`;
  return `
    <section class="pp-card tp-brief" aria-label="Before your next class">
      <div class="tp-brief-head">
        <h2 class="pp-h">Before your next class</h2>
        ${next ? `<span class="tp-next">${pathIcon('clock', 14)} Next class: <b>${escapeHtml(next)}</b></span>` : ''}
      </div>
      <p class="pp-sub tp-brief-line">${escapeHtml(brief.line)}</p>
      ${body}
      <details class="tp-how"><summary>How these suggestions are chosen</summary>
        <p><b>Revisit:</b> practising, but at least two activities are under ${Math.round(cfg.revisitAccuracy * 100)}%, or fewer than half were done.
        <b>Next in the curriculum:</b> the session after the last curriculum session delivered, in the same skill sequence (custom sessions have no position).
        <b>Balance:</b> a core skill missing from the last ${cfg.balanceWindow} sessions.
        <b>Check in first:</b> no practice for ${cfg.nudgeDays} or more days.
        These are suggestions only. You decide what to teach.</p>
      </details>
    </section>`;
}

/* The curriculum hint needs the level file (a static JSON). Fetch it once per level, then
   redraw only the brief. Failure is silent: the other hints still show. */
async function tutorLoadCurriculumHint(student) {
  const delivered = tutorDeliveredSessions(tutorState.sessions, student.id);
  const slug = tutorCurriculumSlug(tutorCurriculumLevelOf(delivered));
  if (!slug) return;
  tutorBoardState.curCache = tutorBoardState.curCache || {};
  try {
    if (!tutorBoardState.curCache[slug]) {
      const res = await fetch(`curriculum/${slug}.json`);
      if (!res.ok) return;
      tutorBoardState.curCache[slug] = (await res.json()).sessions || [];
    }
  } catch (e) { return; }
  if (tutorBoardState.studentId !== student.id || tutorState.view !== 'student') return;   // moved on meanwhile
  tutorBoardState.curIndex = tutorCurriculumIndex([tutorBoardState.curCache[slug]]);
  tutorBoardState.curHintFor = student.id;
  const host = document.getElementById('tpBrief');
  if (host) {
    const sum = tutorStudentSummary(student, tutorState.sessions, tutorState.attempts, { tz: _pathTz() });
    host.innerHTML = _tpBriefHtml(sum, student, tutorBoardState.curIndex);
  }
}

/* ─────────────── the actions behind the hint buttons ─────────────── */

/* Leave the Students views before the prep screens take over (they only know about
   My Sessions and Curriculum). */
function _tpLeaveTutorViews() {
  ['tutorStudents', 'tutorStudent'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
}

/* Revisit: open the same plan for this student again (like "Use for a student"). */
function tutorTeachAgain(sessionId) {
  if (activeContext().readOnly) return;
  const row = (tutorState.sessions || []).find(r => r.id === sessionId);
  const student = row && (tutorState.students || []).find(s => s.id === row.student_id);
  if (!row || !row.plan || !student) { showToast('Could not open that session.', 'error'); return; }
  _tpLeaveTutorViews();
  tutorState.view = 'home';
  tutorLoadPlanIntoPreview(row.plan, row.plan_id || null, student, 'Teaching again: ' + (row.title || 'session'));
}

/* Next in the curriculum: open that curriculum session for this student. */
async function tutorTeachNext(curriculumId, studentId) {
  if (activeContext().readOnly) return;
  const student = (tutorState.students || []).find(s => s.id === studentId);
  if (!student) return;
  try {
    const row = await dataGetCurriculumPlan(curriculumId);
    if (!row || !row.plan) { showToast('That curriculum session is not available yet.', 'warn'); return; }
    _tpLeaveTutorViews();
    tutorState.view = 'home';
    tutorLoadPlanIntoPreview(row.plan, row.id, student, 'Curriculum: ' + (row.title || curriculumId), true);
  } catch (e) { showToast('Could not open: ' + e.message, 'error'); }
}

/* Balance: start a new session with that skill and this student already chosen. */
function tutorPlanSkill(skill, studentId) {
  if (activeContext().readOnly) return;
  const student = (tutorState.students || []).find(s => s.id === studentId);
  if (!student) return;
  _tpLeaveTutorViews();
  tutorNewSession();
  tutorState.selectedStudent = student;
  renderTutorStudentPicker();
  selectSessionType(skill);
}

/* Home shortcut: "Prepare" next to the next-class line opens that student's page. */
function tutorPrepareFor(studentId) { tutorOpenStudent(studentId); }

/* ...and the tutor board / student page, if one is open. */
window.addEventListener('almitu:schedule-ready', () => {
  try {
    if (!tutorUiEnabled() || !tutorBoardState.loaded) return;
    if (tutorState.view === 'students') renderTutorBoard();
    else if (tutorState.view === 'student') renderTutorStudentPage();
  } catch (e) { /* tutor dashboard not shown */ }
});
