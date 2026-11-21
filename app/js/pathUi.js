/* ═══════════════════════════════════════════════════════
   Almitu Pro — Practice Path UI (student home)

   Rendering for the "practice path" design, built on the pure helpers in
   path.js. Only active when pathUiEnabled() is true; otherwise none of this
   runs and the classic student dashboard is untouched.

   Slice 2 (this file): weekly goal + Continue card at the top of the student
   dashboard, and progress-ring session cards in the session list.
   Design rule: line icons only (inline SVG), no emojis.
   ═══════════════════════════════════════════════════════ */

/* ─────────────── icons (line style, inline SVG) ─────────────── */

const PATH_ICON_PATHS = {
  warm:   '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  flash:  '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7V5a1 1 0 0 1 1-1h11a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1h-2"/>',
  match:  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  quiz:   '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  gap:    '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  reord:  '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  read:   '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  listen: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h3z"/><path d="M3 15a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3z"/>',
  expl:   '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  check:  '<path d="M20 6 9 17l-5-5"/>',
  bolt:   '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  flame:  '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  arrow:  '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'
};

function pathIcon(name, size, filled) {
  const s = size || 20;
  return `<svg class="pp-ic${filled ? ' pp-ic-fill' : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${PATH_ICON_PATHS[name] || ''}</svg>`;
}

/* Circular progress: done/total, or a check once everything is done. */
function pathRing(done, total, size) {
  const sz = size || 46, r = (sz - 8) / 2, c = 2 * Math.PI * r;
  const full = total > 0 && done >= total;
  const frac = total ? Math.min(1, done / total) : 0;
  return `<span class="pp-ring" style="width:${sz}px;height:${sz}px" role="img" aria-label="${done} of ${total} steps done">
    <svg width="${sz}" height="${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="pp-ring-bg"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="pp-ring-fg${full ? ' pp-ring-full' : ''}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>
    <b>${full ? pathIcon('check', Math.round(sz * 0.4)) : done + '/' + total}</b></span>`;
}

/* ─────────────── helpers ─────────────── */

/* The student's own notebooks (the dashboard can hold several students' when
   an admin/tutor views as someone). */
function pathMyNotebooks() {
  const s = getState();
  const sid = typeof currentPracticeStudentId === 'function' ? currentPracticeStudentId() : null;
  return s.savedNotebooks.filter(n => !sid || n.studentId === sid);
}
function pathAttempts() { return (window.studentProgress && studentProgress.attempts) || []; }

/* ─────────────── top of the dashboard: weekly goal + Continue ─────────────── */

function pathWeekCardHtml() {
  const wk = pathWeekSummary(pathAttempts());
  const xp = summariseAttempts(pathAttempts()).xp;
  const sub = wk.reached ? 'Weekly goal reached' : `${wk.count} of ${wk.goal} days · ${wk.remaining} to go`;
  return `
    <section class="pp-card" aria-label="This week's practice">
      <div class="pp-row">
        <div><h2 class="pp-h">This week's practice</h2><p class="pp-sub">${sub}</p></div>
        <span class="pp-xp">${pathIcon('bolt', 13, true)} ${xp} XP</span>
      </div>
      <div class="pp-days">${wk.days.map(d => `
        <div class="pp-day${d.practiced ? ' pp-day-on' : ''}${d.isToday ? ' pp-day-today' : ''}">${d.label}
          <span aria-label="${d.practiced ? 'practised' : 'not practised'}">${pathIcon('check', 14)}</span></div>`).join('')}
      </div>
      ${wk.streak >= 1 ? `<p class="pp-streak">${pathIcon('flame', 14)} Practised ${wk.streak} ${wk.streak === 1 ? 'day' : 'days'} in a row</p>` : ''}
    </section>`;
}

function pathContinueCardHtml() {
  const nbs = pathMyNotebooks();
  if (!nbs.length) return '';
  const { target } = pathSessionSummaries(nbs, pathAttempts());
  if (!target) {
    return `
      <section class="pp-card pp-caught" aria-label="Practice status">
        ${pathIcon('trophy', 26)}
        <div><h2 class="pp-h">You're all caught up</h2><p class="pp-sub">All your practice is done. Great work.</p></div>
      </section>`;
  }
  const p = target.progress, nx = p.next;
  const line = `Step ${p.doneCount + 1} of ${p.total} · ${nx.label} · about ${nx.min || 1} min`;
  return `
    <section class="pp-card pp-continue" aria-label="Continue practising">
      <p class="pp-k">${p.doneCount ? 'Continue where you left off' : 'Start your practice'}</p>
      <h2 class="pp-ct">${escapeHtml(target.nb.plan.meta.title)}</h2>
      <p class="pp-cl">${escapeHtml(line)}</p>
      <button type="button" class="pp-cbtn" onclick="pathContinue()">Continue ${pathIcon('arrow', 18)}</button>
    </section>`;
}

/* Fill #studentXpBadge with the path home (replaces the classic XP badge). */
function pathRenderHome(host) {
  const nbs = pathMyNotebooks();
  if (!nbs.length) { host.classList.add('hidden'); host.innerHTML = ''; host.classList.remove('path-home'); return; }
  host.classList.remove('hidden');
  host.classList.add('path-home');
  host.innerHTML = `<div class="pp-home">${pathWeekCardHtml()}${pathContinueCardHtml()}</div>`;
}

/* ─────────────── session list cards ─────────────── */

function pathSessionCardsHtml(sessions, selectedId) {
  const { rows } = pathSessionSummaries(sessions, pathAttempts());
  return rows.map(({ nb, progress: p, status }) => {
    const left = p.stepsLeft;
    const pill = !p.total ? ''
      : status === 'done' ? '<span class="pp-pill pp-pill-done">DONE</span>'
      : status === 'next' ? '<span class="pp-pill pp-pill-next">UP NEXT</span>'
      : status === 'old'  ? `<span class="pp-pill pp-pill-old">${left} LEFT</span>`
      :                     `<span class="pp-pill pp-pill-left">${left} LEFT</span>`;
    const meta = [nb.date, nb.plan.meta.level, getSessionType(nb.sessionType).label].filter(Boolean).join(' · ');
    return `
      <button type="button" class="pp-sess${nb.id === selectedId ? ' pp-cur' : ''}" onclick="selectSession('${nb.id}')">
        ${p.total ? pathRing(p.doneCount, p.total, 46) : ''}
        <span class="pp-sess-body"><span class="pp-sess-t">${escapeHtml(nb.plan.meta.title)}</span><span class="pp-sess-m">${escapeHtml(meta)}</span></span>
        ${pill}
      </button>`;
  }).join('');
}

/* ─────────────── actions ─────────────── */

/* Open a step of a session. (Slice 3 reuses this for the steps list.) */
function pathStartStep(sessionId, stepId) {
  const s = getState();
  const step3 = document.getElementById('step3');
  if (s.selectedNotebookId !== sessionId) {
    selectSession(sessionId);                       // phones: this also opens the session's detail view
  } else if (_svIsMobile() && step3 && step3.getAttribute('data-mview') !== 'detail') {
    showSessionObjective(sessionId);                // already selected, still on the list: open the detail view
  }
  const nb = getActiveNotebook();
  if (!nb) return;
  const run = {
    warm:   () => { pathMarkWarmDone(nb); actOverview(nb); },
    flash:  () => actFlashcards(),
    match:  () => actMatching(),
    quiz:   () => actQuiz(),
    gap:    () => actGapFill(),
    reord:  () => actReorder(),
    read:   () => actReading(),
    listen: () => actListening(),
    expl:   () => actExplore()
  }[stepId];
  if (!run) return;
  run();
  pathRefresh();
}

/* The Continue card: jump into the next unfinished step. */
function pathContinue() {
  const { target } = pathSessionSummaries(pathMyNotebooks(), pathAttempts());
  if (target && target.progress.next) pathStartStep(target.nb.id, target.progress.next.id);
}

/* Re-draw everything that shows progress (home cards + session list). */
function pathRefresh() {
  if (typeof renderStudentXpBadge === 'function') renderStudentXpBadge();
  if (typeof renderNotebooks === 'function') renderNotebooks();
}

/* Called after an attempt is recorded (progress.js). The XP badge hook has
   already refreshed the home cards; here we refresh the ring/status list. */
function pathAfterAttempt() {
  if (pathUiEnabled() && typeof renderNotebooks === 'function') renderNotebooks();
}
