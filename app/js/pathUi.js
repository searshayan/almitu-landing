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
  star:   '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  key:    '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  chat:   '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock:  '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  up:     '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
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
  return `<span class="pp-ring" style="width:${sz}px;height:${sz}px" role="img" aria-label="${done} of ${total} activities done">
    <svg width="${sz}" height="${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="pp-ring-bg"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" class="pp-ring-fg${full ? ' pp-ring-full' : ''}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>
    <b>${full ? pathIcon('check', Math.round(sz * 0.4)) : done + '/' + total}</b></span>`;
}

/* Activity headers (step3.js activityHeader) pass an emoji; with the new design on
   they show the matching line icon instead. */
const PATH_EMOJI_ICON = {
  '\u{1F4CB}': 'warm',     // clipboard   (Overview / Warm-up)
  '\u{1F0CF}': 'flash',    // joker card  (Flashcards)
  '\u2753':    'quiz',     // question mark
  '\u{1F500}': 'reord',    // shuffle
  '\u270F':    'gap',      // pencil (variation selector stripped below)
  '\u{1F517}': 'match',    // link
  '\u{1F4D6}': 'read',     // open book
  '\u{1F3A7}': 'listen',   // headphones
  '\u{1F310}': 'expl'      // globe
};
function pathHeaderIcon(emoji) {
  const key = String(emoji || '').replace(/\uFE0F/g, '');
  const name = PATH_EMOJI_ICON[key];
  return name ? `<span class="pp-hico">${pathIcon(name, 22)}</span>` : emoji;
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

/* View-as preview: activities the viewer "finishes" while looking at a student's dashboard are
   shown (so a tutor can walk the whole flow) but never saved. Cleared whenever the dashboard loads. */
const pathPreview = [];
function pathResetPreview() { pathPreview.length = 0; }
/* Attempts used for PROGRESS (done states, rings, Next): real rows plus any preview rows. */
function pathProgressAttempts() { return pathPreview.length ? pathAttempts().concat(pathPreview) : pathAttempts(); }
function pathRecordPreview(activity, correct, total) {
  const nb = getActiveNotebook();
  if (!nb || !pathUiEnabled()) return;
  pathPreview.push({ id: 'preview-' + pathPreview.length, session_id: nb.id, activity, correct, total, xp: 0, seconds: 0, created_at: new Date().toISOString(), preview: true });
  if (typeof renderNotebooks === 'function') renderNotebooks();
  pathRenderSteps();
  const step = PATH_STEP_CATALOG.find(s => s.activity === activity);
  if (step && pathUiState.cur === step.id) pathShowNextCard(nb, step.id, true);
}

/* ─────────────── top of the dashboard: weekly goal + Continue ─────────────── */

const PATH_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* Seconds → big number + unit ("34" "min", "45" "sec", "1h 5m"). Floors to whole
   minutes, like the tutor export, so a student and tutor see the same figure. */
function pathTimeParts(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec <= 0) return { n: '0', unit: 'min' };           // nothing yet: "0 min", not "0 sec"
  if (sec < 60) return { n: String(sec), unit: 'sec' };
  const m = Math.floor(sec / 60);
  if (m < 60) return { n: String(m), unit: 'min' };
  const h = Math.floor(m / 60), r = m % 60;
  return { n: r ? `${h}h ${r}m` : `${h}h`, unit: '' };
}
function pathTimeText(sec) { const t = pathTimeParts(sec); return t.unit ? `${t.n} ${t.unit}` : t.n; }

/* Idea C: a clock disc with a friendly comparison to last week, under the bars.
   Positive = encouraging; a dip is shown neutrally (no "less than"), and nothing
   at all without last-week data. */
function pathTrendRowHtml(wk) {
  if (!(wk.lastWeekSeconds > 0) || !(wk.seconds > 0)) return '';
  const diff = wk.seconds - wk.lastWeekSeconds;
  const last = `Last week: ${pathTimeText(wk.lastWeekSeconds)}`;
  let main, sub = last, cls = '';
  if (diff >= 60) { main = `${pathIcon('up', 14)} ${pathTimeText(diff)} more than last week`; cls = ' pp-trend-up'; }
  else if (diff <= -60) { main = last; sub = ''; }
  else main = 'About the same as last week';
  return `
    <div class="pp-trendrow">
      <span class="pp-clock" aria-hidden="true">${pathIcon('clock', 24)}</span>
      <div><span class="pp-trend${cls}">${main}</span>${sub ? `<p class="pp-sub" style="margin-top:4px">${sub}</p>` : ''}</div>
    </div>`;
}

function pathWeekCardHtml() {
  const wk = pathWeekSummary(pathAttempts());
  const xp = summariseAttempts(pathAttempts()).xp;
  const days = wk.reached ? 'Weekly goal reached' : `${wk.count} of ${wk.goal} days · ${wk.remaining} to go`;
  const tp = pathTimeParts(wk.seconds);
  const max = Math.max(1, ...wk.days.map(d => d.seconds));
  const bars = wk.days.map((d, i) => {
    const h = d.practiced ? Math.max(18, Math.round(d.seconds / max * 100)) : 6;
    const m = d.seconds <= 0 ? '' : (d.seconds < 60 ? '<1' : Math.floor(d.seconds / 60));
    const what = d.practiced ? (d.seconds > 0 ? `${pathTimeText(d.seconds)} practised` : 'practised') : 'not practised';
    return `
      <div class="pp-col${d.practiced ? ' pp-col-on' : ''}${d.isToday ? ' pp-col-today' : ''}" role="listitem" aria-label="${PATH_DAY_NAMES[i]}${d.isToday ? ' (today)' : ''}: ${what}">
        <span class="pp-col-m" aria-hidden="true">${m}</span><span class="pp-col-b" style="height:${h}%" aria-hidden="true"></span><span class="pp-col-l" aria-hidden="true">${d.label}</span>
      </div>`;
  }).join('');
  return `
    <section class="pp-card" aria-label="This week's practice">
      <div class="pp-row" style="align-items:flex-start">
        <div><h2 class="pp-h">This week's practice</h2><p class="pp-sub">${days}</p></div>
        <div class="pp-side">
          <span class="pp-xp">${pathIcon('bolt', 13, true)} ${xp} XP</span>
          <span class="pp-big${wk.seconds > 0 ? '' : ' pp-big-zero'}" aria-label="${pathTimeText(wk.seconds)} practised this week">${tp.n}${tp.unit ? `<small>${tp.unit}</small>` : ''}</span>
          <span class="pp-side-l">this week</span>
        </div>
      </div>
      <div class="pp-bars" role="list">${bars}</div>
      ${pathTrendRowHtml(wk)}
      ${wk.streak >= 1 ? `<p class="pp-streak">${pathIcon('flame', 14)} Practised ${wk.streak} ${wk.streak === 1 ? 'day' : 'days'} in a row</p>` : ''}
    </section>`;
}

function pathContinueCardHtml() {
  const nbs = pathMyNotebooks();
  if (!nbs.length) return '';
  const { target } = pathSessionSummaries(nbs, pathProgressAttempts());
  if (!target) {
    return `
      <section class="pp-card pp-caught" aria-label="Practice status">
        ${pathIcon('trophy', 26)}
        <div><h2 class="pp-h">You're all caught up</h2><p class="pp-sub">All your practice is done. Great work.</p></div>
      </section>`;
  }
  const p = target.progress, nx = p.next;
  const line = `Activity ${p.doneCount + 1} of ${p.total} · ${nx.label}`;
  return `
    <section class="pp-card pp-continue" aria-label="Continue practising">
      <p class="pp-k">${p.doneCount ? 'Continue where you left off' : 'Start your practice'}</p>
      <h2 class="pp-ct">${bidiText(target.nb.plan.meta.title)}</h2>
      <p class="pp-cl">${escapeHtml(line)}</p>
      <button type="button" class="pp-cbtn" onclick="pathContinue()">Continue ${pathIcon('arrow', 18)}</button>
    </section>`;
}

/* Fill #studentXpBadge with the path home (replaces the classic XP badge). */
function pathRenderHome(host) {
  const nbs = pathMyNotebooks();
  const slot = document.getElementById('pathGoalSlot');
  if (!nbs.length) {
    host.classList.add('hidden'); host.innerHTML = ''; host.classList.remove('path-home');
    if (slot) slot.innerHTML = '';
    return;
  }
  host.classList.remove('hidden');
  host.classList.add('path-home');
  host.innerHTML = `<div class="pp-home">${pathWeekCardHtml()}${pathContinueCardHtml()}</div>`;
  // Wide desktop (≥1280px): the goal moves into the sessions column and the top
  // row is hidden by CSS (the session header carries its own Continue button).
  if (slot) slot.innerHTML = `<div class="pp-goal-side">${pathWeekCardHtml()}</div>`;
}

/* ─────────────── session list cards ─────────────── */

function pathSessionCardsHtml(sessions, selectedId) {
  const { rows } = pathSessionSummaries(sessions, pathProgressAttempts());
  return rows.map(({ nb, progress: p, status }) => {
    const left = p.stepsLeft;
    const pill = !p.total ? ''
      : status === 'done' ? '<span class="pp-pill pp-pill-done">DONE</span>'
      : status === 'next' ? '<span class="pp-pill pp-pill-next">UP NEXT</span>'
      : status === 'old'  ? `<span class="pp-pill pp-pill-old">${left} LEFT</span>`
      :                     `<span class="pp-pill pp-pill-left">${left} LEFT</span>`;
    const meta = [nb.date, nb.plan.meta.level, getSessionType(nb.sessionType).label].filter(Boolean).join(' · ');
    return `
      <button type="button" class="pp-sess${nb.id === selectedId ? ' pp-cur' : ''}"${nb.id === selectedId ? ' aria-current="true"' : ''} onclick="selectSession('${nb.id}')">
        ${p.total ? pathRing(p.doneCount, p.total, 46) : ''}
        <span class="pp-sess-body"><span class="pp-sess-t">${bidiText(nb.plan.meta.title)}</span><span class="pp-sess-m">${escapeHtml(meta)}</span></span>
        ${pill}
      </button>`;
  }).join('');
}

/* ─────────────── session detail: the steps list ─────────────── */

/* Which step is open in the practice area (for the highlight). */
const pathUiState = { sessionId: null, cur: null };

function pathStarsHtml(n) {
  return `<span class="pp-stars" role="img" aria-label="${n} of 3 stars">${[0, 1, 2].map(i =>
    `<svg class="pp-ic pp-ic-fill" width="14" height="14" viewBox="0 0 24 24" style="${i < n ? '' : 'opacity:.28'}" aria-hidden="true">${PATH_ICON_PATHS.star}</svg>`).join('')}</span>`;
}

function pathStepHtml(nb, st, index) {
  const isCur = pathUiState.cur === st.id;
  const right = st.done
    ? (st.stars ? pathStarsHtml(st.stars) : '<span class="pp-pill pp-pill-done">DONE</span>')
    : st.bonus ? '<span class="pp-pill pp-pill-opt">OPTIONAL</span>'
    : st.state === 'next' ? '<span class="pp-pill pp-pill-next">START</span>' : '';
  const label = (st.bonus ? '' : (index + 1) + '. ') + st.label;
  const sub = st.sub;
  return `
    <button type="button" class="pp-step pp-step-${st.state}${st.bonus ? ' pp-step-bonus' : ''}${isCur ? ' pp-step-cur' : ''}"
      ${st.state === 'next' ? 'aria-current="step"' : ''} onclick="pathStartStep('${nb.id}','${st.id}')">
      <span class="pp-orb">${st.done ? pathIcon('check', 22) : pathIcon(st.id, 22)}</span>
      <span class="pp-step-body"><span class="pp-step-n">${escapeHtml(label)}</span><span class="pp-step-d">${escapeHtml(sub)}</span></span>
      <span class="pp-step-r">${right}</span>
    </button>`;
}

/* Amie's phone tile ships with an owl emoji; with the new design on, show a line icon instead. */
function pathSwapAmieIcon() {
  const title = document.getElementById('notebookListTitle');
  if (title) title.textContent = 'Sessions';        // the classic card title ("My Notebook Archives") clashes with the new design
  const icon = document.querySelector('#amieTile > div');
  if (icon && !icon.dataset.pp) {
    icon.dataset.pp = '1';
    icon.innerHTML = `<span style="color:var(--primary);display:inline-block">${pathIcon('chat', 26)}</span>`;
  }
}

/* Header + tutor notes + steps for the selected session. Replaces the classic
   emoji tile grid (hidden by CSS while #step3 carries .pp-on). */
function pathRenderSteps() {
  const host = document.getElementById('pathSteps');
  const step3 = document.getElementById('step3');
  if (!host) return;
  const on = pathUiEnabled();
  if (step3) step3.classList.toggle('pp-on', on);
  const nb = on ? getActiveNotebook() : null;
  if (!nb) { host.classList.add('hidden'); host.innerHTML = ''; return; }

  pathSwapAmieIcon();
  if (pathUiState.sessionId !== nb.id) { pathUiState.sessionId = nb.id; pathUiState.cur = null; }
  const p = pathProgress(nb, pathProgressAttempts());
  const meta = [nb.plan.meta.level, getSessionType(nb.sessionType).label, nb.duration ? nb.duration + ' min class' : ''].filter(Boolean).join(' · ');
  const xpDisc = `<div class="pp-disc pp-disc-xp${p.xp > 0 ? '' : ' pp-disc-zero'}" role="img" aria-label="${p.xp} XP earned on this session"><b>${p.xp}</b><span>XP</span></div>`;
  const st = pathTimeParts(p.seconds);
  const disc = `<div class="pp-disc${p.seconds > 0 ? '' : ' pp-disc-zero'}${st.unit ? '' : ' pp-disc-long'}" role="img" aria-label="${pathTimeText(p.seconds)} practised on this session"><b>${st.n}</b>${st.unit ? `<span>${st.unit}</span>` : ''}</div>`;
  const cta = p.next
    ? `<button type="button" class="pp-cbtn pp-cbtn-solid" onclick="pathStartStep('${nb.id}','${p.next.id}')">Continue · ${escapeHtml(p.next.label)} ${pathIcon('arrow', 18)}</button>`
    : (p.total ? `<p class="pp-doneline">${pathIcon('trophy', 18)} All practice for this session is done.</p>` : '');
  const notes = (nb.tutorNotes && nb.tutorNotes.trim())
    ? `<div class="pp-notes"><p class="pp-notes-k">Notes from your tutor</p><p class="pp-notes-t">${bidiText(nb.tutorNotes)}</p></div>` : '';

  host.classList.remove('hidden');
  host.innerHTML = `
    <section class="pp-card pp-shead" aria-label="Session progress">
      <div class="pp-shead-title"><h2 class="pp-h" style="font-size:16px">${bidiText(nb.plan.meta.title)}</h2><p class="pp-sub">${escapeHtml(meta)}</p></div>
      <div class="pp-circles">
        <div class="pp-c">${pathRing(p.doneCount, p.total, 76)}<span class="pp-c-l">Activities done</span></div>
        <div class="pp-c">${disc}<span class="pp-c-l">Time practised</span></div>
        <div class="pp-c">${xpDisc}<span class="pp-c-l">XP earned</span></div>
      </div>
      ${cta}
    </section>
    ${notes}
    <div class="pp-rightcol">
      <p class="pp-sec">Activities</p>
      <div class="pp-steps">${p.steps.map((st, i) => pathStepHtml(nb, st, i)).join('')}</div>
    </div>`;
}

/* ─────────────── after an activity: the "Next" card ─────────────── */

/* Appended under the activity's own finish screen (never replaces it): what was
   just completed, overall progress, a weekly-goal note when it was just
   reached, and ONE obvious button to the next step. */
function pathNextCardHtml(nb, justId, preview) {
  const p = pathProgress(nb, pathProgressAttempts());
  const just = p.steps.find(s => s.id === justId);
  if (!just) return '';
  const wk = pathWeekSummary(pathAttempts());
  const todays = pathAttempts().filter(a => a.created_at && pathDayKey(new Date(a.created_at), _pathTz()) === wk.todayKey).length;
  const goalNote = (wk.reached && wk.count === wk.goal && todays <= 1)
    ? `<div class="pp-goalnote">${pathIcon('flame', 22)}<div><b>Weekly goal reached</b><span>${wk.goal} practice days this week.</span></div></div>` : '';
  const right = just.stars ? pathStarsHtml(just.stars) : '';
  const explore = p.steps.find(s => s.bonus);

  let action;
  if (p.next) {
    action = `<button type="button" class="pp-cbtn pp-cbtn-solid" onclick="pathStartStep('${nb.id}','${p.next.id}')">Next: ${escapeHtml(p.next.label)} ${pathIcon('arrow', 18)}</button>`;
  } else {
    action = `
      <p class="pp-doneline">${pathIcon('trophy', 18)} All activities done for this session.</p>
      <button type="button" class="pp-cbtn pp-cbtn-solid" onclick="pathBackToSteps()">Back to the path</button>
      ${explore ? `<button type="button" class="pp-link" onclick="pathStartStep('${nb.id}','${explore.id}')">Optional: ${escapeHtml(explore.label)}</button>` : ''}`;
  }
  return `
    <div id="pathNextCard" class="pp-next" role="status">
      <div class="pp-next-head">
        <span class="pp-next-orb">${pathIcon('check', 20)}</span>
        <div style="flex:1;min-width:0"><p class="pp-h">${escapeHtml(just.label)} done</p><p class="pp-sub">${p.doneCount} of ${p.total} activities done</p></div>
        ${right}
      </div>
      ${goalNote}
      ${preview ? '<p class="pp-sub" style="margin-top:12px">Preview only: nothing is saved while viewing as a student.</p>' : ''}
      ${action}
    </div>`;
}

/* Put the Next card at the bottom of the open activity and bring it into view. */
function pathShowNextCard(nb, justId, preview) {
  const host = document.getElementById('practiceContent');
  if (!host || host.classList.contains('hidden')) return;
  const old = document.getElementById('pathNextCard'); if (old) old.remove();
  const html = pathNextCardHtml(nb, justId, preview);
  if (!html) return;
  host.insertAdjacentHTML('beforeend', html);
  const el = document.getElementById('pathNextCard');
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
}

/* ─────────────── phones: the activity gets the whole screen ─────────────── */

function pathEnterActivity() {
  if (!_svIsMobile()) return;
  const s3 = document.getElementById('step3'); if (!s3) return;
  s3.setAttribute('data-mview', 'activity');
  const vs = document.getElementById('viewStudent'); if (vs) vs.classList.add('sv-detail');
  const label = document.getElementById('svBackLabel'); if (label) label.textContent = 'Activities';
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* Back from a full-screen activity to the session's path (phones). */
function pathExitActivity() {
  const s3 = document.getElementById('step3'); if (!s3) return;
  s3.setAttribute('data-mview', 'detail');
  const label = document.getElementById('svBackLabel'); if (label) label.textContent = 'Sessions';
  pathUiState.cur = null;
  resetActivityArea();
  pathRenderSteps();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* "Back to the path" from the Next card. */
function pathBackToSteps() {
  if (_svIsMobile()) { pathExitActivity(); return; }
  pathUiState.cur = null;
  resetActivityArea();
  pathRenderSteps();
  const host = document.getElementById('pathSteps');
  if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'auto', block: 'start' });
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
  pathUiState.sessionId = nb.id;
  pathUiState.cur = stepId;
  pathEnterActivity();                // phones: full-screen activity
  run();
  pathRefresh();
  if (stepId === 'warm') {                                    // Warm-up is "done" as soon as it's opened
    if (pathViewingAs()) pathRecordPreview('overview'); else pathShowNextCard(nb, 'warm');
  }
}

/* The Continue card: jump into the next unfinished step. */
function pathContinue() {
  const { target } = pathSessionSummaries(pathMyNotebooks(), pathProgressAttempts());
  if (target && target.progress.next) pathStartStep(target.nb.id, target.progress.next.id);
}

/* Re-draw everything that shows progress (home cards + session list). */
function pathRefresh() {
  if (typeof renderStudentXpBadge === 'function') renderStudentXpBadge();
  if (typeof renderNotebooks === 'function') renderNotebooks();
  pathRenderSteps();
}

/* Called after an attempt is recorded (progress.js). The XP badge hook has
   already refreshed the home cards; here we refresh the ring/status list. */
function pathAfterAttempt() {
  if (!pathUiEnabled()) return;
  if (typeof renderNotebooks === 'function') renderNotebooks();
  pathRenderSteps();
  // Show "Next" under the activity the student just finished (only while that
  // step is still the one on screen).
  const last = pathAttempts()[0], nb = getActiveNotebook();
  if (!last || !nb || last.session_id !== nb.id) return;
  const step = PATH_STEP_CATALOG.find(s => s.activity === last.activity);
  if (step && pathUiState.cur === step.id) pathShowNextCard(nb, step.id);
}
