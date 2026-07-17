/* ═══════════════════════════════════════════════════════
   Almitu Pro — Progress: XP + active practice time

   Records one row per COMPLETED post-session activity:
     • how well they did (correct / total)
     • how much XP they earned
     • how many ACTIVE seconds they spent (idle tabs don't count)

   Students see the XP; tutors see per-session totals.
   ═══════════════════════════════════════════════════════ */

/* ─────────────── Active-time tracking ───────────────
   Wall-clock would let a tab left open over lunch log an hour of "practice".
   We only count time while the page is actually visible. */

const ActivityTimer = {
  activity: null,
  elapsedMs: 0,
  lastStart: null,
  running: false,

  start(activity) {
    this.activity = activity;
    this.elapsedMs = 0;
    this.lastStart = Date.now();
    this.running = true;
  },

  pause() {
    if (this.running && this.lastStart) {
      this.elapsedMs += Date.now() - this.lastStart;
      this.lastStart = null;
      this.running = false;
    }
  },

  resume() {
    if (this.activity && !this.running) {
      this.lastStart = Date.now();
      this.running = true;
    }
  },

  /* Seconds accrued so far, sanity-capped (a stuck timer shouldn't report hours). */
  seconds() {
    let ms = this.elapsedMs;
    if (this.running && this.lastStart) ms += Date.now() - this.lastStart;
    const secs = Math.round(ms / 1000);
    return Math.max(0, Math.min(secs, 2 * 60 * 60));   // cap at 2h
  },

  /* Read the final value and reset. */
  stop() {
    this.pause();
    const secs = this.seconds();
    this.activity = null;
    this.elapsedMs = 0;
    this.lastStart = null;
    return secs;
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) ActivityTimer.pause(); else ActivityTimer.resume();
});
window.addEventListener('blur', () => ActivityTimer.pause());
window.addEventListener('focus', () => ActivityTimer.resume());

/* ─────────────── XP rules ───────────────
     base   = correct × 10                        (quiz / gapfill / reorder)
            = round(pairs × 10 × pairs/attempts)  (matching — efficiency-scaled,
              otherwise sloppy play scores the same as flawless play)
            = 15 flat                             (flashcards — no accuracy to measure)
     +25    perfect
     ×1.5   Challenge mode
     ×0.5   repeat of the same activity in the same session
*/

const XP_PER_CORRECT = 10;
const XP_PERFECT_BONUS = 25;
const XP_CHALLENGE_MULTIPLIER = 1.5;
const XP_REPEAT_MULTIPLIER = 0.5;
const XP_FLASHCARDS_FLAT = 15;

function isPerfectScore(activity, correct, total) {
  if (activity === 'flashcards') return false;
  if (activity === 'matching') return total > 0 && correct === total;  // matched in the minimum attempts
  return total > 0 && correct === total;
}

function computeXp(opts) {
  const { activity, correct, total, challenge, isRepeat } = opts;
  let xp;

  if (activity === 'flashcards') {
    xp = XP_FLASHCARDS_FLAT;
  } else if (activity === 'matching') {
    // correct = pairs matched, total = attempts taken (attempts >= pairs)
    const efficiency = total > 0 ? Math.min(1, correct / total) : 0;
    xp = Math.round(correct * XP_PER_CORRECT * efficiency);
  } else {
    xp = (correct || 0) * XP_PER_CORRECT;
  }

  if (isPerfectScore(activity, correct, total)) xp += XP_PERFECT_BONUS;
  if (challenge) xp = Math.round(xp * XP_CHALLENGE_MULTIPLIER);
  if (isRepeat) xp = Math.round(xp * XP_REPEAT_MULTIPLIER);
  return Math.max(0, xp);
}

/* ─────────────── Recording ─────────────── */

/* The session the student is currently practising, if any. */
function currentPracticeSessionId() {
  const nb = typeof getActiveNotebook === 'function' ? getActiveNotebook() : null;
  return nb ? nb.id : null;
}

/* Called by each activity when it finishes. Fire-and-forget: a recording
   failure must never break the student's practice. */
async function recordActivityCompletion(activity, correct, total, challenge) {
  const seconds = ActivityTimer.stop();
  const sessionId = currentPracticeSessionId();
  const studentId = typeof currentUserId === 'function' ? currentUserId() : null;

  // Only real students practising a real session are recorded — this keeps
  // an admin's read-only "View as" from polluting the student's stats.
  const ctx = typeof activeContext === 'function' ? activeContext() : null;
  if (!sessionId || !studentId || (ctx && ctx.readOnly)) return null;

  try {
    const priorCount = await dataCountAttempts(sessionId, studentId, activity);
    const xp = computeXp({ activity, correct, total, challenge: !!challenge, isRepeat: priorCount > 0 });
    const row = await dataRecordAttempt({
      session_id: sessionId,
      student_id: studentId,
      activity,
      challenge: !!challenge,
      correct: (correct == null ? null : correct),
      total: (total == null ? null : total),
      xp,
      seconds
    });
    if (window.studentProgress) window.studentProgress.attempts.unshift(row);
    showXpFeedback(xp, priorCount > 0);
    if (typeof renderStudentXpBadge === 'function') renderStudentXpBadge();
    return row;
  } catch (e) {
    console.warn('Could not record activity attempt:', e);
    return null;
  }
}

/* Small celebratory nudge — and honest about the halved repeat value. */
function showXpFeedback(xp, isRepeat) {
  if (!xp) return;
  showToast(`+${xp} XP${isRepeat ? ' (repeat — half XP)' : ''}`, 'success');
}

/* ─────────────── Aggregation helpers (shared by both dashboards) ─────────────── */

function summariseAttempts(attempts) {
  const list = attempts || [];
  return {
    count: list.length,
    xp: list.reduce((n, a) => n + (a.xp || 0), 0),
    seconds: list.reduce((n, a) => n + (a.seconds || 0), 0)
  };
}

/* "12 min" / "45s" — compact, human. */
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

const ACTIVITY_LABELS = {
  quiz: 'Quiz MCQ',
  reorder: 'Reorder',
  gapfill: 'Gap Fill',
  matching: 'Matching',
  flashcards: 'Flashcards'
};

/* Score shown per activity — matching reads as pairs/attempts, not a fraction correct. */
function formatAttemptScore(a) {
  if (a.activity === 'flashcards' || a.correct == null) return '—';
  if (a.activity === 'matching') return `${a.correct} pairs in ${a.total} tries`;
  return `${a.correct}/${a.total}`;
}
