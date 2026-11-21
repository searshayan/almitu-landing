/* ═══════════════════════════════════════════════════════
   Almitu Pro — Practice Path (logic only)

   Pure helpers for the student "practice path" design: which steps a session
   offers, which are done, stars, what's next, and the weekly practice goal.
   Nothing here touches the DOM or the database — it only reads data the
   student dashboard has already loaded:

     • the notebook  (a `sessions` row mapped by rowToNotebook, see data.js)
     • the attempts  (`activity_attempts` rows, see progress.js)

   "Done" = the student reached the end of the activity (an attempt row exists
   for that session + activity), regardless of score. Stars show accuracy.

   Step availability MIRRORS applyActivityGating() in step3.js exactly (same
   rules, so the path never offers an activity the tiles would hide). When the
   path UI replaces the tiles, applyActivityGating can be retired in favour of
   pathStepsFor().
   ═══════════════════════════════════════════════════════ */

/* Step catalogue, in path order. `activity` is the value stored in
   activity_attempts.activity (Warm-up and Explore are not recorded there). */
const PATH_STEP_CATALOG = [
  { id: 'warm',   activity: 'overview',   label: 'Warm-up',      sub: 'Session overview',            min: 1 },
  { id: 'flash',  activity: 'flashcards', label: 'Flashcards',   sub: 'Flip and learn',              min: 2 },
  { id: 'match',  activity: 'matching',   label: 'Matching',     sub: 'Pair them up',                min: 2 },
  { id: 'quiz',   activity: 'quiz',       label: 'Quiz',         sub: 'Pick the answer',             min: 2 },
  { id: 'gap',    activity: 'gapfill',    label: 'Gap Fill',     sub: 'Complete the sentence',       min: 3 },
  { id: 'reord',  activity: 'reorder',    label: 'Reorder',      sub: 'Build the sentence',          min: 3 },
  { id: 'read',   activity: 'reading',    label: 'Reading',      sub: 'Read and listen',             min: 3 },
  { id: 'listen', activity: 'listening',  label: 'Listening',    sub: 'Hear and answer',             min: 3 },
  { id: 'expl',   activity: 'explore',    label: 'Explore More', sub: 'Bonus: videos and article',   min: 0, bonus: true }
];

/* Literacy (pre-reader) wording: picture-based. */
const PATH_LITERACY_TEXT = {
  flash: { sub: 'Pictures and words' },
  match: { sub: 'Match picture to word' },
  quiz:  { label: 'Picture Quiz', sub: 'Tap the right picture' }
};

/* ─────────────── which steps does this session offer? ─────────────── */

/* Ordered step objects available for a notebook ([] if it has no plan). */
function pathStepsFor(nb) {
  if (!nb || !nb.plan) return [];
  const meta = nb.plan.meta || {};
  const isLit = meta.tier === 'literacy';
  const bank = nb.plan.content ? nb.plan.content.practice_bank : null;
  const imgItems = bank && Array.isArray(bank.items) ? bank.items.filter(i => i && i.image).length : 0;
  const has = key => !!(bank && bank[key]);
  // A skill-gated step is limited to those session types; Literacy is exempt.
  const skillAllows = list => isLit || list.includes(nb.sessionType);
  const CORE_SKILLS = ['vocabulary', 'communication', 'speaking'];

  const available = {
    warm:   true,
    flash:  skillAllows(CORE_SKILLS),
    match:  true,
    quiz:   isLit ? imgItems >= 3 : true,         // Literacy: picture quiz needs ≥3 pictures
    gap:    !isLit,
    reord:  !isLit,
    read:   has('reading') && !isLit,
    listen: has('listening') && !isLit && skillAllows(CORE_SKILLS),
    expl:   has('externalResources') && !isLit
  };

  return PATH_STEP_CATALOG
    .filter(s => available[s.id])
    .map(s => Object.assign({}, s, isLit && PATH_LITERACY_TEXT[s.id] ? PATH_LITERACY_TEXT[s.id] : {}));
}

/* ─────────────── Warm-up memory (browser only, per student + session) ─────────────── */

const PATH_WARM_KEY = 'almitu.warm.v1';

function _pathWarmMap() {
  try { return JSON.parse(localStorage.getItem(PATH_WARM_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function _pathWarmId(nb) { return (nb.studentId || '') + ':' + nb.id; }

function pathWarmDone(nb) {
  return !!(nb && _pathWarmMap()[_pathWarmId(nb)]);
}
/* Call when the student opens the Warm-up (session overview). */
function pathMarkWarmDone(nb) {
  if (!nb || !nb.id) return;
  try {
    const map = _pathWarmMap();
    if (map[_pathWarmId(nb)]) return;
    map[_pathWarmId(nb)] = Date.now();
    localStorage.setItem(PATH_WARM_KEY, JSON.stringify(map));
  } catch (e) { /* storage blocked: Warm-up just stays "open" */ }
}

/* ─────────────── stars ─────────────── */

/* Accuracy 0..1 for one attempt, or null when there is nothing to score. */
function pathAttemptRatio(a) {
  if (!a || a.activity === 'flashcards') return null;
  if (a.activity === 'matching') return a.total > 0 ? Math.min(1, a.correct / a.total) : null;   // pairs / tries
  return a.total > 0 ? a.correct / a.total : null;
}
function pathStarsFromRatio(r) { return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1; }

/* Best star rating across attempts of one activity (null = unscored, show "Done"). */
function pathBestStars(attemptsForActivity) {
  let best = null;
  (attemptsForActivity || []).forEach(a => {
    const r = pathAttemptRatio(a);
    if (r != null && (best == null || r > best)) best = r;
  });
  return best == null ? null : pathStarsFromRatio(best);
}

/* ─────────────── progress for one session ─────────────── */

/* The full path state for a notebook.
   steps[].state: 'done' | 'next' | 'open'  (exactly one 'next', the first
   unfinished non-bonus step; nothing is ever locked).
   Bonus steps (Explore More) don't count toward progress. */
function pathProgress(nb, attempts) {
  const mine = (attempts || []).filter(a => nb && a.session_id === nb.id);
  const steps = pathStepsFor(nb).map(s => {
    let done = false, stars = null, count = 0;
    if (s.id === 'warm') {
      done = pathWarmDone(nb);
    } else if (!s.bonus) {
      const rows = mine.filter(a => a.activity === s.activity);
      count = rows.length;
      done = count > 0;
      stars = done ? pathBestStars(rows) : null;
    }
    return Object.assign({}, s, { done, stars, attemptCount: count, state: done ? 'done' : 'open' });
  });

  const core = steps.filter(s => !s.bonus);
  const next = core.find(s => !s.done) || null;
  if (next) next.state = 'next';
  const doneCount = core.filter(s => s.done).length;
  const left = core.length - doneCount;

  return {
    sessionId: nb ? nb.id : null,
    steps,
    total: core.length,
    doneCount,
    pct: core.length ? Math.round(doneCount / core.length * 100) : 0,
    next,
    allDone: core.length > 0 && !next,
    minutesLeft: core.filter(s => !s.done).reduce((n, s) => n + (s.min || 0), 0),
    stepsLeft: left
  };
}

/* ─────────────── across sessions ─────────────── */

/* Sessions older than this stop counting as "behind" (not hidden, just not nagging). */
function pathIsStale(nb, now) {
  if (!nb || !nb.createdAt) return false;
  const t = new Date(nb.createdAt).getTime();
  if (isNaN(t)) return false;
  return ((now || Date.now()) - t) > PATH_STALE_DAYS * 86400000;
}

/* One summary per session, in the order given (the dashboard lists newest first).
   status: 'next' (the session the Continue card points at) | 'left' (unfinished,
   not the target) | 'done' | 'old' (unfinished but stale). Exactly one 'next'. */
function pathSessionSummaries(notebooks, attempts, now) {
  const list = (notebooks || []).map(nb => ({ nb, progress: pathProgress(nb, attempts), status: 'done' }));
  let target = null;
  list.forEach(row => {
    const p = row.progress;
    if (p.allDone || !p.total) { row.status = 'done'; return; }
    if (pathIsStale(row.nb, now)) { row.status = 'old'; return; }
    if (!target) { target = row; row.status = 'next'; return; }
    row.status = 'left';
  });
  return { rows: list, target };
}

/* ─────────────── weekly practice goal + streak ─────────────── */

function _pathTz() {
  if (typeof schedState !== 'undefined' && schedState && schedState.viewerTz) return schedState.viewerTz;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
}

/* 'YYYY-MM-DD' of an instant, in a timezone (DST-correct, Intl only). */
function pathDayKey(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const g = t => parts.find(p => p.type === t).value;
  return g('year') + '-' + g('month') + '-' + g('day');
}

/* Shift a 'YYYY-MM-DD' key by whole days (calendar arithmetic, no DST issues). */
function pathShiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* Monday = 0 … Sunday = 6 for a 'YYYY-MM-DD' key. */
function _pathWeekdayIdx(key) {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const PATH_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* This week's practice (weeks start Monday) in the student's timezone.
   A "practice day" is any day with at least one recorded attempt. */
function pathWeekSummary(attempts, now, tz, goal) {
  tz = tz || _pathTz();
  goal = goal || PATH_WEEKLY_GOAL;
  const nowD = new Date(now || Date.now());
  const todayKey = pathDayKey(nowD, tz);
  const practiced = new Set((attempts || []).map(a => a.created_at ? pathDayKey(new Date(a.created_at), tz) : null).filter(Boolean));

  const monday = pathShiftKey(todayKey, -_pathWeekdayIdx(todayKey));
  const days = PATH_DAY_LABELS.map((label, i) => {
    const key = pathShiftKey(monday, i);
    return { key, label, practiced: practiced.has(key), isToday: key === todayKey, isFuture: key > todayKey };
  });
  const count = days.filter(d => d.practiced).length;

  // Streak: consecutive practice days ending today, or yesterday if the
  // student simply hasn't practised yet today (the streak is still alive).
  let cursor = practiced.has(todayKey) ? todayKey : pathShiftKey(todayKey, -1);
  let streak = 0;
  while (practiced.has(cursor)) { streak++; cursor = pathShiftKey(cursor, -1); }

  return { days, count, goal, remaining: Math.max(0, goal - count), reached: count >= goal, streak, todayKey, practicedToday: practiced.has(todayKey) };
}

/* ─────────────── feature switch ─────────────── */

/* The new design is OFF unless PATH_UI_DEFAULT is true, or the student/admin
   opted in with ?path=1 (remembered in this browser; ?path=0 turns it back off). */
function pathUiEnabled() {
  try {
    const q = new URLSearchParams(location.search).get('path');
    if (q === '1' || q === '0') localStorage.setItem('almitu.pathUi', q);
    const stored = localStorage.getItem('almitu.pathUi');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch (e) { /* storage blocked: fall through to the default */ }
  return PATH_UI_DEFAULT;
}
