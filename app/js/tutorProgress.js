/* ═══════════════════════════════════════════════════════
   Almitu Pro — Tutor progress (logic only)

   Pure helpers for the tutor "Students" views: how each student is doing,
   who needs attention, and what the tutor might teach next. Nothing here
   touches the DOM or the database — it only reads data the tutor dashboard
   has already loaded:

     • students   (profiles: id, full_name, level, language, country)
     • sessions   (`sessions` rows: student_id, status, session_type, plan,
                   plan_id, created_at — the tutor's own)
     • attempts   (`activity_attempts` rows for those sessions)

   Reuses the student-side helpers in path.js (steps per session, stars,
   weekly summary). Warm-up and Explore More are not recorded on the server,
   so tutor totals count only the tracked activities.

   Everything is a SUGGESTION: statuses and hints carry their reason, and the
   tutor decides. Thresholds live in config.js.
   ═══════════════════════════════════════════════════════ */

const TP_CORE_SKILLS = ['vocabulary', 'grammar', 'communication'];
const TP_SKILL_LABELS = { vocabulary: 'Vocabulary', grammar: 'Grammar', communication: 'Communication' };

/* Attention order for the board (lower = needs attention sooner). */
const TP_STATUS_RANK = { nudge: 0, support: 1, notstarted: 2, ontrack: 3, ready: 4, none: 5 };
const TP_STATUS_LABEL = {
  nudge: 'Needs a nudge', support: 'Needs support', notstarted: 'Not started',
  ontrack: 'On track', ready: 'Ready to move on', none: 'No sessions yet'
};

/* Thresholds, overridable per call (opts.cfg) so they can be tested and tuned. */
function tutorCfg(opts) {
  return Object.assign({
    nudgeDays: TUTOR_NUDGE_DAYS,
    supportAccuracy: TUTOR_SUPPORT_ACCURACY,
    readyAccuracy: TUTOR_READY_ACCURACY,
    revisitAccuracy: TUTOR_REVISIT_ACCURACY,
    minScored: TUTOR_MIN_SCORED,
    balanceWindow: TUTOR_BALANCE_WINDOW
  }, (opts && opts.cfg) || {});
}

/* ─────────────── feature switch ─────────────── */

/* OFF unless TUTOR_UI_DEFAULT is true, or a tutor/admin opted in with ?tutor=1
   (remembered in this browser; ?tutor=0 turns it back off). */
function tutorUiEnabled() {
  try {
    const q = new URLSearchParams(location.search).get('tutor');
    if (q === '1' || q === '0') localStorage.setItem('almitu.tutorUi', q);
    const stored = localStorage.getItem('almitu.tutorUi');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch (e) { /* storage blocked: fall through to the default */ }
  return TUTOR_UI_DEFAULT;
}

/* ─────────────── small helpers ─────────────── */

function _tpTz(opts) { return (opts && opts.tz) || _pathTz(); }
function _tpDayKey(ts, tz) { return pathDayKey(new Date(ts), tz); }

/* Whole calendar days from key a to key b ('YYYY-MM-DD'); b later than a → positive. */
function _tpDayDiff(a, b) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/* A sessions row in the minimal notebook shape that path.js understands. */
function _tpNb(row) {
  return { id: row.id, studentId: row.student_id, sessionType: row.session_type, plan: row.plan, createdAt: row.created_at, title: row.title };
}

function _tpPct(r) { return Math.round(r * 100) + '%'; }
function _tpPlural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function _tpAgo(days) { return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago'; }

/* ─────────────── sessions + per-session progress ─────────────── */

/* Sessions actually delivered to a student (with a plan), newest first. */
function tutorDeliveredSessions(sessions, studentId) {
  return (sessions || [])
    .filter(r => r && r.student_id === studentId && r.status === 'completed' && r.plan && r.plan.meta)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/* What a student did on ONE session, from the tracked activities only
   (Warm-up and Explore More are not recorded server-side). Scores use each
   activity's BEST attempt, matching the stars the student sees. */
function tutorSessionProgress(row, attempts) {
  const mine = (attempts || []).filter(a => a.session_id === row.id);
  const steps = pathStepsFor(_tpNb(row)).filter(s => !s.bonus && s.id !== 'warm').map(s => {
    const rows = mine.filter(a => a.activity === s.activity);
    let best = null, bestRow = null;
    rows.forEach(a => { const r = pathAttemptRatio(a); if (r != null && (best == null || r > best)) { best = r; bestRow = a; } });
    return {
      id: s.id, activity: s.activity, label: s.label,
      done: rows.length > 0, attempts: rows.length,
      bestRatio: best, stars: best == null ? null : pathStarsFromRatio(best),
      bestCorrect: bestRow ? bestRow.correct : null, bestTotal: bestRow ? bestRow.total : null,   // the raw score behind the best attempt
      seconds: rows.reduce((n, a) => n + (a.seconds || 0), 0),
      challenge: rows.some(a => a.challenge)
    };
  });
  const scored = steps.filter(s => s.bestRatio != null);
  const doneCount = steps.filter(s => s.done).length;
  return {
    sessionId: row.id, title: row.title, steps,
    total: steps.length, doneCount, allDone: steps.length > 0 && doneCount === steps.length,
    scoredCount: scored.length,
    accuracy: scored.length ? scored.reduce((n, s) => n + s.bestRatio, 0) / scored.length : null,
    seconds: mine.reduce((n, a) => n + (a.seconds || 0), 0),
    xp: mine.reduce((n, a) => n + (a.xp || 0), 0),
    attemptCount: mine.length
  };
}

/* A student's delivered sessions (newest first, up to `limit`), each with its progress. */
function tutorSessionHistory(sessions, attempts, studentId, limit) {
  return tutorDeliveredSessions(sessions, studentId).slice(0, limit || 10)
    .map(row => ({ row, progress: tutorSessionProgress(row, attempts) }));
}

/* ─────────────── status ─────────────── */

/* The status rules, in priority order: nudge, support, not started, ready, on track. */
function tutorStatusFor(x, cfg) {
  if (!x.latest) return { code: 'none', reason: 'No sessions delivered yet' };

  if (!x.practisedSinceClass) {
    if (x.daysSinceClass >= cfg.nudgeDays) return { code: 'nudge', reason: `No practice since the class ${_tpAgo(x.daysSinceClass)}` };
    return { code: 'notstarted', reason: x.daysSinceClass <= 0 ? 'Class was today; no practice yet' : `Class was ${_tpAgo(x.daysSinceClass)}; no practice yet` };
  }

  const left = x.latest.total - x.latest.doneCount;
  if (!x.latest.allDone && x.daysSincePractice != null && x.daysSincePractice >= cfg.nudgeDays) {
    return { code: 'nudge', reason: `Last practised ${_tpAgo(x.daysSincePractice)}; ${_tpPlural(left, 'activity', 'activities')} left` };
  }
  if (x.latest.scoredCount >= cfg.minScored && x.latest.accuracy < cfg.supportAccuracy) {
    return { code: 'support', reason: `Accuracy ${_tpPct(x.latest.accuracy)} across ${_tpPlural(x.latest.scoredCount, 'activity', 'activities')}` };
  }
  if (x.latest.allDone && x.latest.accuracy != null && x.latest.accuracy >= cfg.readyAccuracy) {
    return { code: 'ready', reason: `All activities done at ${_tpPct(x.latest.accuracy)}` };
  }
  return { code: 'ontrack', reason: x.latest.allDone ? 'All activities done' : `${x.latest.doneCount} of ${x.latest.total} activities done` };
}

/* One student's full picture. opts: { now, tz, goal, cfg }. */
function tutorStudentSummary(student, sessions, attempts, opts) {
  opts = opts || {};
  const cfg = tutorCfg(opts), tz = _tpTz(opts), now = opts.now || Date.now();
  const ids = new Set((sessions || []).filter(r => r.student_id === student.id).map(r => r.id));
  const mine = (attempts || []).filter(a => ids.has(a.session_id));

  const delivered = tutorDeliveredSessions(sessions, student.id);
  const latestRow = delivered[0] || null;
  const latest = latestRow ? tutorSessionProgress(latestRow, mine) : null;
  const week = pathWeekSummary(mine, now, tz, opts.goal || PATH_WEEKLY_GOAL);
  const todayKey = week.todayKey;

  let lastAt = null;
  mine.forEach(a => { const t = new Date(a.created_at).getTime(); if (!isNaN(t) && (lastAt == null || t > lastAt)) lastAt = t; });
  const lastKey = lastAt != null ? _tpDayKey(lastAt, tz) : null;
  const classKey = latestRow ? _tpDayKey(latestRow.created_at, tz) : null;

  // Practice since the latest class (any session): how many days, how much time.
  const sinceClass = classKey ? mine.filter(a => a.created_at && _tpDayKey(a.created_at, tz) >= classKey) : [];

  const ctx = {
    latest,
    daysSinceClass: classKey ? _tpDayDiff(classKey, todayKey) : null,
    daysSincePractice: lastKey ? _tpDayDiff(lastKey, todayKey) : null,
    practisedSinceClass: !!classKey && mine.some(a => a.created_at && _tpDayKey(a.created_at, tz) >= classKey)
  };
  const status = tutorStatusFor(ctx, cfg);

  return {
    studentId: student.id, name: student.full_name || 'Student',
    level: student.level || '', language: student.language || '', country: student.country || '',
    deliveredCount: delivered.length, latestRow, latest,
    week, lastPracticedAt: lastAt,
    daysSincePractice: ctx.daysSincePractice, daysSinceClass: ctx.daysSinceClass,
    practisedSinceClass: ctx.practisedSinceClass,
    daysPractisedSinceClass: new Set(sinceClass.map(a => _tpDayKey(a.created_at, tz))).size,
    secondsSinceClass: sinceClass.reduce((n, a) => n + (a.seconds || 0), 0),
    status: status.code, statusLabel: TP_STATUS_LABEL[status.code], statusReason: status.reason,
    attention: TP_STATUS_RANK[status.code]
  };
}

/* How long a student has been quiet: days since they last practised, or, if they
   never have, days since their latest class. Used to order students within a status. */
function _tpQuietDays(r) {
  return r.daysSincePractice != null ? r.daysSincePractice : (r.daysSinceClass != null ? r.daysSinceClass : 0);
}

/* The class board: every student, those needing attention first. */
function tutorBoard(students, sessions, attempts, opts) {
  const rows = (students || []).map(s => tutorStudentSummary(s, sessions, attempts, opts));
  rows.sort((a, b) =>
    (a.attention - b.attention) ||
    (_tpQuietDays(b) - _tpQuietDays(a)) ||
    a.name.localeCompare(b.name));
  const counts = { all: rows.length, nudge: 0, support: 0, notstarted: 0, ontrack: 0, ready: 0, none: 0 };
  rows.forEach(r => { counts[r.status]++; });
  return { rows, counts };
}

/* ─────────────── hints: what to teach next ─────────────── */

/* Index curriculum records by id. `lists` = array of arrays (one per level file),
   each in teaching order, records shaped { curriculum_id, skill, title, ... }. */
function tutorCurriculumIndex(lists) {
  const idx = new Map();
  (lists || []).forEach(list => (list || []).forEach((rec, i) => { if (rec && rec.curriculum_id) idx.set(rec.curriculum_id, { list, i }); }));
  return idx;
}

/* The session after the most recent curriculum session delivered, in the same
   skill sequence. Custom (non-curriculum) sessions have no position, so they
   are skipped; null when nothing is known. */
function tutorNextCurriculum(delivered, index) {
  if (!index) return null;
  for (const row of delivered) {
    const id = row.plan && row.plan.meta && row.plan.meta.curriculumId;
    const hit = id && index.get(id);
    if (!hit) continue;
    const from = hit.list[hit.i];
    for (let j = hit.i + 1; j < hit.list.length; j++) {
      if (hit.list[j].skill === from.skill) return { from, next: hit.list[j], fromSessionId: row.id };
    }
    return { from, next: null, finished: true, fromSessionId: row.id };
  }
  return null;
}

/* Suggestions for the next class. Each: { kind, title, evidence, action }.
   Kinds: checkin, revisit, curriculum, balance. opts: { cfg, curriculum (index) }. */
function tutorHints(summary, sessions, opts) {
  opts = opts || {};
  const cfg = tutorCfg(opts), hints = [];
  const delivered = tutorDeliveredSessions(sessions, summary.studentId);
  const latest = summary.latest;

  // Check in first: practice has stopped or never started.
  if (summary.status === 'nudge') {
    hints.push({
      kind: 'checkin', title: summary.statusReason,
      evidence: 'Ask about barriers before adding new content: time, phone access, motivation.',
      action: { type: 'nudge' }
    });
  }

  // Revisit: practising, but the latest session did not land.
  if (latest && summary.practisedSinceClass) {
    const weak = latest.steps.filter(s => s.bestRatio != null && s.bestRatio < cfg.revisitAccuracy);
    const fewDone = latest.total > 0 && latest.doneCount < Math.ceil(latest.total / 2);
    if (weak.length >= 2 || fewDone) {
      const row = summary.latestRow;
      const items = ((row.plan.content && row.plan.content.practice_bank && row.plan.content.practice_bank.items) || [])
        .map(i => i && i.term).filter(Boolean).slice(0, 6);
      const why = weak.length >= 2
        ? weak.map(s => `${s.label} ${_tpPct(s.bestRatio)}`).join(', ')
        : `Only ${latest.doneCount} of ${latest.total} activities done`;
      hints.push({
        kind: 'revisit', title: `Revisit "${row.title || 'the latest session'}"`,
        evidence: why + (items.length ? `. Target items: ${items.join(', ')}.` : '.'),
        items, weak: weak.map(s => ({ id: s.id, label: s.label, ratio: s.bestRatio })),
        action: { type: 'teachAgain', sessionId: row.id, planId: row.plan_id || null }
      });
    }
  }

  // Next in the curriculum.
  const nx = tutorNextCurriculum(delivered, opts.curriculum);
  if (nx && nx.next) {
    hints.push({
      kind: 'curriculum', title: nx.next.title || nx.next.curriculum_id,
      evidence: `Last curriculum session: "${nx.from.title || nx.from.curriculum_id}". This is next in the ${nx.next.skill} sequence.`,
      action: { type: 'openCurriculum', curriculumId: nx.next.curriculum_id }
    });
  }

  // Balance: a core skill missing from the last few sessions (only when ALL of them are core types).
  const recent = delivered.slice(0, cfg.balanceWindow);
  if (recent.length >= cfg.balanceWindow && recent.every(r => TP_CORE_SKILLS.includes(r.session_type))) {
    const types = recent.map(r => r.session_type);
    const missing = TP_CORE_SKILLS.filter(k => !types.includes(k));
    if (missing.length) {
      hints.push({
        kind: 'balance', title: `No ${missing.map(k => TP_SKILL_LABELS[k]).join(' or ')} in the last ${recent.length} sessions`,
        evidence: 'Last ' + recent.length + ': ' + types.map(k => TP_SKILL_LABELS[k]).join(', ') + '.',
        action: { type: 'planSkill', skill: missing[0] }
      });
    }
  }
  return hints;
}

/* ─────────────── next-class brief ─────────────── */

/* One plain sentence for the top of the brief, plus the weakest tracked activity
   (only when it is below the "ready" accuracy, otherwise there is nothing to flag). */
function tutorBriefSummary(s, opts) {
  const cfg = tutorCfg(opts);
  if (!s.latest) return { line: 'No session has been delivered yet.', weakest: null };
  if (!s.practisedSinceClass) {
    return { line: s.daysSinceClass <= 0 ? 'The last class was today and there is no practice yet.' : `No practice since the last class ${_tpAgo(s.daysSinceClass)}.`, weakest: null };
  }
  const scored = s.latest.steps.filter(x => x.bestRatio != null).sort((a, b) => a.bestRatio - b.bestRatio);
  const weakest = scored.length && scored[0].bestRatio < cfg.readyAccuracy ? { label: scored[0].label, ratio: scored[0].bestRatio } : null;
  const time = typeof pathTimeText === 'function' ? pathTimeText(s.secondsSinceClass) : Math.round(s.secondsSinceClass / 60) + ' min';
  const acc = s.latest.accuracy != null ? `, accuracy ${_tpPct(s.latest.accuracy)}` : '';
  return {
    line: `Since the last class: ${s.latest.doneCount} of ${s.latest.total} activities, ${time} over ${_tpPlural(s.daysPractisedSinceClass, 'day')}${acc}.` +
      (weakest ? ` Weakest: ${weakest.label} (${_tpPct(weakest.ratio)}).` : ''),
    weakest
  };
}

/* The curriculum level of the most recent delivered curriculum session (so we know which
   level file to read to find "next"), and the file slug for a level. */
function tutorCurriculumLevelOf(delivered) {
  for (const row of delivered || []) {
    if (row.plan && row.plan.meta && row.plan.meta.curriculumId) return row.plan.meta.level || null;
  }
  return null;
}
function tutorCurriculumSlug(level) {
  if (!level) return null;
  if (level === 'Literacy' || (typeof isLiteracyLevel === 'function' && isLiteracyLevel(level))) return 'literacy';
  if (typeof isSpeakingLevel === 'function' && isSpeakingLevel(level)) return speakingSlug(level);
  return String(level).toLowerCase();
}

/* ─────────────── nudge draft ─────────────── */

/* A warm, short message the tutor can edit and send. Never sent automatically. */
function tutorNudgeDraft(student, summary) {
  const first = String((student && student.full_name) || '').trim().split(/\s+/)[0] || 'there';
  if (summary && summary.latest && summary.practisedSinceClass) {
    const left = summary.latest.total - summary.latest.doneCount;
    return `Hi ${first}, thank you for the practice so far. You have ${_tpPlural(left, 'activity', 'activities')} left from our last class. Even a few minutes this week helps. Let me know if any of them are hard and I can help.`;
  }
  return `Hi ${first}, I wanted to check in. I haven't seen any practice since our last class. Even 5 minutes helps. Is anything making it hard to fit in? I'm happy to adjust the activities.`;
}
