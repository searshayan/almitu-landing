/* ════════════════════════════════════════════════════════════════════════
   schedule.js — Weekly class timetable + "can't attend" flags

   • The coordinator (admin) sets each tutor↔student pair's recurring weekly
     classes (weekday + time), anchored in the TUTOR's timezone.
   • Both roles open their week from a header calendar button (modal); the
     dashboards only show a one-line "Next class". Tutors see an aggregate week
     (all students). Each viewer sees the
     times converted into THEIR OWN timezone — so a class can legitimately land
     on a different weekday for each side (day-shift is expected, not a bug).
   • Default = attending. Tap a class to flag "can't attend" (optional note) for
     THIS week's occurrence; the partner is messaged, and tapping again sends an
     "I can attend after all" message. It reddens on both sides (the flag lives on the session,
     so each side reddens the correct day). Flags reset weekly automatically —
     we only ever look at the current week.

   Depends on: data.js (dataX helpers), ui.js (escapeHtml/showToast/bidiText).
   Timezone math uses only the built-in Intl API (DST-correct, no library).
   ════════════════════════════════════════════════════════════════════════ */

const schedState = {
  role: null, myId: null, readOnly: false,
  viewerTz: 'UTC',
  slots: [],            // class_schedule rows visible to me
  occBySlot: {},        // slot.id -> { instant: Date, occDate: 'YYYY-MM-DD' (anchor tz) }
  flags: {},            // `${slotId}|${occDate}` -> attendance row
  tutorCols: {},        // viewer-weekday (0-6) -> [slotId] (tutor aggregate, for "day off")
  loaded: false,
  channel: null, poll: null,
  dialog: null,         // open flag/unflag dialog
  editor: null          // admin modal state
};

/* Day-of-week: index 0=Sun … 6=Sat (JS getDay). Display order is Monday-first. */
const SCHED_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHED_DAY_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHED_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const SCHED_WD_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/* ─────────────── timezone helpers (Intl only, DST-correct) ─────────────── */

function schedLocalTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch (e) { return 'UTC'; }
}

/* Minutes tz is ahead of UTC at a given instant. */
function schedTzOffset(instant, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const part of dtf.formatToParts(instant)) if (part.type !== 'literal') p[part.type] = part.value;
  let hour = parseInt(p.hour, 10); if (hour === 24) hour = 0;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/* A wall-clock {y, mo(1-12), d, h, mi} in `tz` → the real UTC instant.
   Two passes so a DST transition on that day resolves correctly. */
function schedWallToInstant(y, mo, d, h, mi, tz) {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let off = schedTzOffset(new Date(naive), tz);
  let inst = new Date(naive - off * 60000);
  off = schedTzOffset(inst, tz);
  return new Date(naive - off * 60000);
}

/* Calendar/weekday parts of an instant, as seen in `tz`. */
function schedPartsInTz(instant, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const p = {};
  for (const part of dtf.formatToParts(instant)) if (part.type !== 'literal') p[part.type] = part.value;
  let hour = parseInt(p.hour, 10); if (hour === 24) hour = 0;
  return { y: +p.year, mo: +p.month, d: +p.day, h: hour, mi: +p.minute, weekday: SCHED_WD_MAP[p.weekday] };
}

/* Localised "6:00 PM" for an instant in a tz. */
function schedFmtTime(instant, tz) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(instant);
  } catch (e) { return ''; }
}

/* This week's occurrence of a slot (weekOffset 1 = next week): the concrete instant + the anchor-tz date
   that identifies it (used as the attendance key, identical for both parties). */
function schedOccurrence(slot, weekOffset) {
  const tz = slot.anchor_tz || 'UTC';
  const today = schedPartsInTz(new Date(), tz);           // anchor-local "today"
  const [hh, mm] = String(slot.start_time).split(':').map(n => parseInt(n, 10));
  // Monday-based index of today, and of the target weekday.
  const todayMonIdx = (today.weekday + 6) % 7;
  const targetMonIdx = (slot.weekday + 6) % 7;
  // Do day arithmetic on midnight-UTC of the anchor-local date (UTC days = 24h,
  // so adding/subtracting days never trips over DST).
  const base = Date.UTC(today.y, today.mo - 1, today.d);
  const target = new Date(base + (targetMonIdx - todayMonIdx + 7 * (weekOffset || 0)) * 86400000);
  const ty = target.getUTCFullYear(), tmo = target.getUTCMonth() + 1, td = target.getUTCDate();
  return {
    instant: schedWallToInstant(ty, tmo, td, hh || 0, mm || 0, tz),
    occDate: `${ty}-${String(tmo).padStart(2, '0')}-${String(td).padStart(2, '0')}`
  };
}

/* ─────────────── lifecycle ─────────────── */

async function initSchedule(ctx) {
  if (!ctx || (ctx.role !== 'tutor' && ctx.role !== 'student')) { teardownSchedule(); return; }

  // Re-init for the same user? just refresh.
  if (schedState.loaded && schedState.myId === ctx.userId) { schedReload(); return; }
  teardownSchedule();

  schedState.role = ctx.role;
  schedState.myId = ctx.userId;
  schedState.readOnly = !!ctx.readOnly;
  schedShowButton();

  // Timezone is admin-controlled: the coordinator sets it per user in the
  // schedule editor. We only auto-detect the browser zone as a first-time
  // BOOTSTRAP (when a user has no zone yet), and never overwrite an existing
  // value — so an admin's choice always wins. Skipped during View-as.
  const localTz = schedLocalTz();
  let storedTz = null;
  try { storedTz = await dataGetTimezone(ctx.userId); } catch (e) {}
  if (!ctx.readOnly && !storedTz) {
    try { await dataSetMyTimezone(ctx.userId, localTz); storedTz = localTz; } catch (e) {}
  }
  schedState.viewerTz = storedTz || localTz;

  await schedLoad();

  schedState.channel = dataSubscribeSchedule(ctx.userId, () => schedReload());
  schedState.poll = setInterval(() => schedReload(), 30000);   // safety net
}

function teardownSchedule() {
  if (schedState.channel) { dataUnsubscribe(schedState.channel); schedState.channel = null; }
  if (schedState.poll) { clearInterval(schedState.poll); schedState.poll = null; }
  schedState.loaded = false;
  schedState.slots = [];
  schedState.occBySlot = {};
  schedState.flags = {};
  schedClose();
  schedHideButton();
  schedRenderNext();
}

/* Full load: slots → occurrences → flags → render. */
async function schedLoad() {
  try {
    schedState.slots = await dataListMySchedule(schedState.myId);
  } catch (e) {
    schedState.slots = [];
    console.warn('schedule load failed', e);
  }
  schedComputeOccurrences();
  await schedLoadFlags();
  schedState.loaded = true;
  schedRenderAll();
}

/* Cheaper refresh (flags only) for realtime/poll ticks. */
async function schedReload() {
  if (!schedState.loaded) return;
  await schedLoadFlags();
  schedRenderAll();
}

function schedComputeOccurrences() {
  schedState.occBySlot = {};
  for (const slot of schedState.slots) schedState.occBySlot[slot.id] = schedOccurrence(slot);
}

async function schedLoadFlags() {
  const ids = schedState.slots.map(s => s.id);
  const dates = [...new Set(Object.values(schedState.occBySlot).map(o => o.occDate))];
  let rows = [];
  try { rows = await dataListAttendance(ids, dates); } catch (e) { rows = []; }
  const map = {};
  for (const r of rows) map[`${r.schedule_id}|${r.occurrence_date}`] = r;
  schedState.flags = map;
}

function schedRenderAll() {
  schedRenderGrid();
  schedRenderNext();
}

/* ─────────────── shared rendering ─────────────── */

/* Bucket slots by the VIEWER's local weekday (0-6). Returns {0..6: [slot]}. */
function schedBucketByViewerDay(slots) {
  const cols = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const slot of slots) {
    const occ = schedState.occBySlot[slot.id];
    if (!occ) continue;
    const wd = schedPartsInTz(occ.instant, schedState.viewerTz).weekday;
    cols[wd].push(slot);
  }
  for (const k in cols) {
    cols[k].sort((a, b) => schedState.occBySlot[a.id].instant - schedState.occBySlot[b.id].instant);
  }
  return cols;
}

function schedFlagFor(slot) {
  const occ = schedState.occBySlot[slot.id];
  return occ ? schedState.flags[`${slot.id}|${occ.occDate}`] || null : null;
}

/* The 7-column week. `subtitleFor(slot)` labels each chip; `dayExtra(wd)` adds
   an optional control under a column header (used for the tutor "day off"). */
function schedWeekGrid(cols, subtitleFor, dayExtra) {
  const columns = SCHED_MON_FIRST.map(wd => {
    const chips = cols[wd].map(s => schedChip(s, subtitleFor ? subtitleFor(s) : '')).join('')
      || `<div class="text-[11px] text-center py-3 rounded-xl" style="color:var(--muted);background:rgba(0,0,0,.02);border:1px dashed var(--line);">—</div>`;
    return `
      <div>
        <div class="text-center mb-1.5">
          <span class="text-[11px] font-bold uppercase tracking-wide" style="color:var(--navy);">${SCHED_DAY_SHORT[wd]}</span>
          ${dayExtra ? dayExtra(wd) : ''}
        </div>
        ${chips}
      </div>`;
  }).join('');
  return `<div class="overflow-x-auto -mx-1 px-1"><div class="grid grid-cols-7 gap-2 min-w-[560px]">${columns}</div></div>`;
}

/* ─────────────── header button + modal ─────────────── */

function schedShowButton() { const b = document.getElementById('scheduleBtn'); if (b) b.classList.remove('hidden'); }
function schedHideButton() { const b = document.getElementById('scheduleBtn'); if (b) b.classList.add('hidden'); }

function schedOpen() {
  if (document.getElementById('schedModal')) return;
  const m = document.createElement('div');
  m.id = 'schedModal';
  m.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  m.style.cssText = 'background:rgba(15,23,42,.45);';
  m.addEventListener('click', e => { if (e.target === m) schedClose(); });
  m.innerHTML = `
    <div class="w-full max-w-4xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style="background:var(--bg,#fff);">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="min-w-0">
          <h2 class="text-base font-display font-bold" style="color:var(--navy);">${schedState.role === 'tutor' ? 'My weekly classes' : 'Your weekly classes'}</h2>
          <p class="text-[11px]" style="color:var(--muted);">Times in your timezone (${escapeHtml(schedState.viewerTz)})${schedState.readOnly ? '' : ' · tap a class if you can’t make it'}</p>
        </div>
        <button onclick="schedClose()" aria-label="Close" class="text-xl leading-none px-2" style="color:var(--muted);">&times;</button>
      </div>
      <div id="schedModalBody"></div>
    </div>`;
  document.body.appendChild(m);
  schedRenderGrid();
}

function schedClose() {
  schedDialogClose();
  const m = document.getElementById('schedModal');
  if (m) m.remove();
}

/* The week grid inside the modal (no-op while the modal is closed). */
function schedRenderGrid() {
  const body = document.getElementById('schedModalBody');
  if (!body) return;
  if (!schedState.loaded) {
    body.innerHTML = '<div class="text-center py-12 text-sm" style="color:var(--muted);">Loading your schedule…</div>';
    return;
  }
  if (!schedState.slots.length) {
    body.innerHTML = `
      <div class="rounded-2xl p-8 text-center" style="border:1px dashed var(--line);">
        <p class="text-sm font-semibold mb-1" style="color:var(--navy);">No classes scheduled yet</p>
        <p class="text-xs" style="color:var(--muted);">Your coordinator sets class times. They’ll appear here once assigned.</p>
      </div>`;
    return;
  }

  const cols = schedBucketByViewerDay(schedState.slots);
  if (schedState.role === 'tutor') {
    schedState.tutorCols = {};
    for (const wd in cols) schedState.tutorCols[wd] = cols[wd].map(s => s.id);
    // "Day off" control per column: flag every upcoming class that day at once (or undo).
    const dayExtra = wd => {
      if (schedState.readOnly) return '';
      const act = schedDayActionable(wd);
      if (!act.length) return '';
      const allFlagged = act.every(s => schedFlagFor(s));
      return `<button type="button" onclick="schedOpenDay(${wd})"
         class="block mx-auto mt-0.5 text-[10px] font-semibold" style="color:${allFlagged ? '#B91C1C' : 'var(--muted)'};">
         ${allFlagged ? 'undo day off' : 'day off'}</button>`;
    };
    body.innerHTML = schedWeekGrid(cols, slot => (slot.student && slot.student.full_name) || 'Student', dayExtra);
  } else {
    body.innerHTML = schedWeekGrid(cols, slot => (slot.tutor && slot.tutor.full_name) || 'Tutor');
  }
}

/* ─────────────── "next class" line (dashboards) ─────────────── */

/* Earliest upcoming class I'm attending. A class already over this week — or
   one flagged "can't attend" — rolls to next week's occurrence. */
function schedNextClass() {
  const now = Date.now();
  let best = null, cancelled = 0;
  for (const slot of schedState.slots) {
    const occ = schedState.occBySlot[slot.id];
    if (!occ) continue;
    const upcoming = occ.instant.getTime() + (slot.duration_min || 60) * 60000 > now;
    let instant = occ.instant;
    if (!upcoming || schedFlagFor(slot)) {
      if (upcoming) cancelled++;
      instant = schedOccurrence(slot, 1).instant;
    }
    if (!best || instant < best.instant) best = { slot, instant };
  }
  return { best, cancelled };
}

/* "Today" / "Tomorrow" / "Wed" / "Next Wed", in the viewer's timezone. */
function schedDayLabel(instant) {
  const tz = schedState.viewerTz;
  const a = schedPartsInTz(new Date(), tz), b = schedPartsInTz(instant, tz);
  const diff = Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return (diff >= 7 ? 'Next ' : '') + SCHED_DAY_SHORT[b.weekday];
}

function schedNextLineHtml(mb) {
  const { best, cancelled } = schedNextClass();
  if (!best) return '';
  const who = schedState.role === 'tutor'
    ? (best.slot.student && best.slot.student.full_name)
    : (best.slot.tutor && best.slot.tutor.full_name);
  const when = `${schedDayLabel(best.instant)} · ${schedFmtTime(best.instant, schedState.viewerTz)}`;
  return `
    <button type="button" onclick="schedOpen()" class="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl ${mb} text-left"
      style="background:var(--card);border:1px solid var(--line);">
      <span class="text-xs min-w-0 truncate" style="color:var(--muted);">
        🗓 Next class: <strong style="color:var(--navy);">${escapeHtml(when)}</strong>${who ? ` with ${bidiText(who)}` : ''}${cancelled ? ` <span style="color:#B91C1C;">· ${cancelled} cancelled this week</span>` : ''}
      </span>
      <span class="text-[11px] font-semibold flex-shrink-0" style="color:var(--secondary);">View schedule ›</span>
    </button>`;
}

/* Fill whichever "next class" hosts exist: the student card, and the
   placeholder the tutor home renders (see renderTutorHome). */
function schedRenderNext() {
  const student = document.getElementById('studentScheduleCard');
  if (student) {
    const html = schedState.role === 'student' && schedState.loaded ? schedNextLineHtml('mb-6') : '';
    student.classList.toggle('hidden', !html);
    student.innerHTML = html;
  }
  const tutor = document.getElementById('tutorNextClass');
  if (tutor) tutor.innerHTML = schedState.role === 'tutor' && schedState.loaded ? schedNextLineHtml('mb-4') : '';
}

/* ─────────────── week grid rendering ─────────────── */

/* Is this week's occurrence already over? (Past classes can't be flagged.) */
function schedIsPast(slot) {
  const occ = schedState.occBySlot[slot.id];
  return !occ || occ.instant.getTime() + (slot.duration_min || 60) * 60000 <= Date.now();
}

/* Can I toggle this class? Only future ones, and a flag only by whoever raised it. */
function schedCanAct(slot) {
  if (schedState.readOnly || schedIsPast(slot)) return false;
  const flag = schedFlagFor(slot);
  return !flag || flag.marked_by === schedState.myId;
}

/* Caption under a reddened chip: who raised the flag, from the viewer's POV. */
function schedFlagCaption(flag) {
  if (flag.marked_by && flag.marked_by === schedState.myId) return 'You can’t attend';
  if (flag.marked_role === 'tutor') return 'Tutor can’t attend';
  if (flag.marked_role === 'student') return 'Student can’t attend';
  return 'Can’t attend';
}

/* One class chip. `subtitle` = tutor name (student view) or student name (tutor view). */
function schedChip(slot, subtitle) {
  const occ = schedState.occBySlot[slot.id];
  const tz = schedState.viewerTz;
  const start = schedFmtTime(occ.instant, tz);
  const end = schedFmtTime(new Date(occ.instant.getTime() + (slot.duration_min || 60) * 60000), tz);
  const flag = schedFlagFor(slot);
  const flagged = !!flag;
  const canAct = schedCanAct(slot);
  const past = schedIsPast(slot);

  const bg = flagged ? 'rgba(239,68,68,.08)' : 'rgba(6,214,160,.08)';
  const border = flagged ? 'rgba(239,68,68,.45)' : 'rgba(6,214,160,.30)';
  const timeStyle = flagged ? 'color:#B91C1C;text-decoration:line-through;' : 'color:var(--navy);';

  let caption = '';
  if (flagged) {
    caption = `<span class="block text-[10px] font-semibold mt-0.5" style="color:#B91C1C;">${schedFlagCaption(flag)}</span>`;
    if (flag.note) caption += `<span class="block text-[10px] mt-0.5" style="color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${bidiText(flag.note)}</span>`;
  } else if (canAct) {
    caption = `<span class="block text-[10px] mt-0.5" style="color:var(--muted);">tap if you can’t make it</span>`;
  }

  return `
    <button type="button" ${canAct ? `onclick="schedOpenSlot('${slot.id}')"` : 'disabled'}
      class="w-full text-left rounded-xl px-2.5 py-2 mb-1.5 transition-all"
      style="background:${bg};border:1px solid ${border};cursor:${canAct ? 'pointer' : 'default'};${past && !flagged ? 'opacity:.55;' : ''}">
      <span class="block text-xs font-bold" style="${timeStyle}">${escapeHtml(start)}${end ? '–' + escapeHtml(end) : ''}</span>
      ${subtitle ? `<span class="block text-[11px] truncate mt-0.5" style="color:var(--muted);">${bidiText(subtitle)}</span>` : ''}
      ${caption}
    </button>`;
}

/* ─────────────── flag / unflag dialog + partner notification ─────────────── */

/* The other person in this 1:1 class (from my point of view). */
function schedPartnerId(slot) {
  return slot.tutor_id === schedState.myId ? slot.student_id : slot.tutor_id;
}

/* Phrase a class time in the recipient's own timezone when we can read it, so
   the note lands in their local Mon/Tue frame. Falls back to my zone. */
async function schedWhenForPartner(partnerId, instant) {
  let tz = schedState.viewerTz, mine = true;
  try { const t = await dataGetTimezone(partnerId); if (t) { tz = t; mine = false; } } catch (e) {}
  const day = SCHED_DAY_LONG[schedPartsInTz(instant, tz).weekday];
  const time = schedFmtTime(instant, tz);
  return { day, when: `${day} at ${time}${mine ? ' (my time)' : ''}` };
}

/* Classes I could flag/unflag in a viewer-day column (tutor "day off"):
   upcoming, and either unflagged or flagged by me. */
function schedDayActionable(wd) {
  return (schedState.tutorCols[wd] || [])
    .map(id => schedState.slots.find(s => s.id === id))
    .filter(s => s && schedCanAct(s));
}

function schedDialogClose() {
  schedState.dialog = null;
  const d = document.getElementById('schedDialog');
  if (d) d.remove();
}

/* Tap a class chip → confirm (with a note) to flag, or confirm to un-flag. */
function schedOpenSlot(slotId) {
  const slot = schedState.slots.find(s => s.id === slotId);
  if (!slot || !schedCanAct(slot)) return;
  const occ = schedState.occBySlot[slotId];
  const tz = schedState.viewerTz;
  const label = `${SCHED_DAY_LONG[schedPartsInTz(occ.instant, tz).weekday]} at ${schedFmtTime(occ.instant, tz)}`;
  schedDialogShow({ mode: schedFlagFor(slot) ? 'unflag' : 'flag', ids: [slotId], label, day: false });
}

/* Tutor "day off" (or undo) for one viewer-day column. */
function schedOpenDay(wd) {
  const act = schedDayActionable(wd);
  if (!act.length) return;
  const allFlagged = act.every(s => schedFlagFor(s));
  const n = act.length;
  schedDialogShow({
    mode: allFlagged ? 'unflag' : 'flag', ids: act.map(s => s.id),
    label: `${SCHED_DAY_LONG[wd]} · ${n} class${n > 1 ? 'es' : ''}`, day: true
  });
}

function schedDialogShow(d) {
  schedDialogClose();
  schedState.dialog = d;
  const flag = d.mode === 'flag';
  const first = !flag && schedFlagFor(schedState.slots.find(s => s.id === d.ids[0]));
  const el = document.createElement('div');
  el.id = 'schedDialog';
  el.className = 'fixed inset-0 flex items-center justify-center p-4';
  el.style.cssText = 'z-index:60;background:rgba(15,23,42,.45);';
  el.addEventListener('click', e => { if (e.target === el) schedDialogClose(); });
  el.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl p-5" style="background:var(--bg,#fff);">
      <h3 class="text-base font-display font-bold mb-0.5" style="color:var(--navy);">${flag ? (d.day ? 'Take this day off?' : 'Can’t attend this class?') : (d.day ? 'Available again?' : 'Can you attend after all?')}</h3>
      <p class="text-xs mb-3" style="color:var(--muted);">${escapeHtml(d.label)} · this week only</p>
      ${flag
        ? `<textarea id="schedNote" dir="auto" rows="3" maxlength="300" placeholder="Add a note (optional) — e.g. I’m travelling"
             class="w-full rounded-xl px-3 py-2 text-sm field-input mb-1" style="resize:none;"></textarea>
           <p class="text-[11px] mb-3" style="color:var(--muted);">We’ll message ${d.day ? 'your students' : 'them'} about it.</p>`
        : `${first && first.note ? `<p class="text-xs rounded-xl px-3 py-2 mb-3" style="background:rgba(0,0,0,.03);color:var(--muted);">Your note: ${bidiText(first.note)}</p>` : ''}
           <p class="text-[11px] mb-3" style="color:var(--muted);">We’ll let ${d.day ? 'your students' : 'them'} know you’re available.</p>`}
      <div class="flex gap-2">
        <button onclick="schedDialogClose()" class="flex-1 py-2.5 rounded-xl text-sm font-semibold" style="background:white;border:1px solid var(--line);color:var(--muted);">Cancel</button>
        <button id="schedDialogGo" onclick="schedDialogConfirm()" class="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
          style="background:${flag ? '#DC2626' : '#059669'};">${flag ? (d.day ? 'Take the day off' : 'I can’t attend') : 'Yes, I can attend'}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const ta = document.getElementById('schedNote');
  if (ta) ta.focus();
}

async function schedDialogConfirm() {
  const d = schedState.dialog;
  if (!d || schedState.readOnly) return;
  const flagging = d.mode === 'flag';
  const noteEl = document.getElementById('schedNote');
  const note = flagging && noteEl ? noteEl.value.trim() : '';
  const go = document.getElementById('schedDialogGo');
  if (go) { go.disabled = true; go.style.opacity = '.6'; }

  const changed = [];
  try {
    for (const id of d.ids) {
      const occ = schedState.occBySlot[id];
      if (!occ) continue;
      if (flagging) await dataFlagAttendance(id, occ.occDate, schedState.myId, schedState.role, note);
      else await dataUnflagAttendance(id, occ.occDate);
      changed.push(id);
    }
  } catch (e) {
    showToast('Could not update attendance: ' + e.message, 'error');
  }
  schedDialogClose();
  await schedReload();

  // One message per partner (a summary if several of their classes changed).
  const byPartner = {};
  for (const id of changed) {
    const slot = schedState.slots.find(s => s.id === id);
    const pid = slot && schedPartnerId(slot);
    if (pid) (byPartner[pid] = byPartner[pid] || []).push(slot);
  }
  for (const pid in byPartner) schedNotify(pid, byPartner[pid], flagging, note);
}

/* Courtesy chat message into the existing 1:1 thread (unread badge + realtime).
   Never blocks the flag — failures are swallowed. */
async function schedNotify(partnerId, slots, flagging, note) {
  try {
    const occ = schedState.occBySlot[slots[0].id];
    const w = await schedWhenForPartner(partnerId, occ.instant);
    const many = slots.length > 1;
    const what = many ? 'our classes' : 'our class';
    const when = many ? w.day : w.when;
    let text = flagging
      ? `Heads up — I can’t ${many ? 'make' : 'attend'} ${what} this ${when}, just this week.`
      : `Good news — I can ${many ? 'make' : 'attend'} ${what} this ${when} after all.`;
    if (flagging && note) text += `\nNote: ${note}`;
    await dataSendMessage(partnerId, text);
  } catch (e) { /* courtesy only */ }
}

/* ════════════════════════════════════════════════════════════════════════
   Admin editor — set a pairing's weekly classes (opened from Assignments)
   ════════════════════════════════════════════════════════════════════════ */

async function schedAdminOpen(tutorId, tutorName, studentId, studentName) {
  const fallback = schedLocalTz();
  let tutorTz = null, studentTz = null;
  try { tutorTz = await dataGetTimezone(tutorId); } catch (e) {}
  try { studentTz = await dataGetTimezone(studentId); } catch (e) {}
  schedState.editor = {
    tutorId, tutorName, studentId, studentName,
    tutorTz: tutorTz || fallback,
    studentTz: studentTz || fallback,
    slots: []
  };
  await schedAdminReloadSlots();
  schedAdminRenderModal();
}

/* True if `tz` is a timezone the browser's Intl accepts (guards typos). */
function schedValidTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
  catch (e) { return false; }
}

/* Curated world timezone list — [IANA, City, Country] — one entry per major
   city/country across every offset, weighted toward Almitu's regions. Shown as
   "(GMT+03:30) Tehran, Iran", sorted by live GMT offset. A stored zone not in
   this list is still preserved (prepended raw) so no one's setting is lost. */
const SCHED_TZ_ZONES = [
  ['Pacific/Midway', 'Midway', 'US Minor Islands'],
  ['Pacific/Honolulu', 'Honolulu', 'United States'],
  ['America/Anchorage', 'Anchorage', 'United States'],
  ['America/Los_Angeles', 'Los Angeles', 'United States'],
  ['America/Vancouver', 'Vancouver', 'Canada'],
  ['America/Tijuana', 'Tijuana', 'Mexico'],
  ['America/Denver', 'Denver', 'United States'],
  ['America/Phoenix', 'Phoenix', 'United States'],
  ['America/Edmonton', 'Edmonton', 'Canada'],
  ['America/Chicago', 'Chicago', 'United States'],
  ['America/Mexico_City', 'Mexico City', 'Mexico'],
  ['America/Winnipeg', 'Winnipeg', 'Canada'],
  ['America/Guatemala', 'Guatemala City', 'Guatemala'],
  ['America/New_York', 'New York', 'United States'],
  ['America/Toronto', 'Toronto', 'Canada'],
  ['America/Bogota', 'Bogotá', 'Colombia'],
  ['America/Lima', 'Lima', 'Peru'],
  ['America/Halifax', 'Halifax', 'Canada'],
  ['America/Santiago', 'Santiago', 'Chile'],
  ['America/Caracas', 'Caracas', 'Venezuela'],
  ['America/St_Johns', "St. John's", 'Canada'],
  ['America/Sao_Paulo', 'São Paulo', 'Brazil'],
  ['America/Argentina/Buenos_Aires', 'Buenos Aires', 'Argentina'],
  ['Atlantic/South_Georgia', 'South Georgia', 'South Georgia'],
  ['Atlantic/Azores', 'Azores', 'Portugal'],
  ['Atlantic/Cape_Verde', 'Praia', 'Cape Verde'],
  ['UTC', 'UTC', ''],
  ['Europe/London', 'London', 'United Kingdom'],
  ['Europe/Dublin', 'Dublin', 'Ireland'],
  ['Europe/Lisbon', 'Lisbon', 'Portugal'],
  ['Africa/Casablanca', 'Casablanca', 'Morocco'],
  ['Europe/Paris', 'Paris', 'France'],
  ['Europe/Madrid', 'Madrid', 'Spain'],
  ['Europe/Berlin', 'Berlin', 'Germany'],
  ['Europe/Rome', 'Rome', 'Italy'],
  ['Europe/Amsterdam', 'Amsterdam', 'Netherlands'],
  ['Europe/Stockholm', 'Stockholm', 'Sweden'],
  ['Europe/Warsaw', 'Warsaw', 'Poland'],
  ['Africa/Lagos', 'Lagos', 'Nigeria'],
  ['Africa/Cairo', 'Cairo', 'Egypt'],
  ['Africa/Johannesburg', 'Johannesburg', 'South Africa'],
  ['Europe/Athens', 'Athens', 'Greece'],
  ['Europe/Bucharest', 'Bucharest', 'Romania'],
  ['Europe/Kyiv', 'Kyiv', 'Ukraine'],
  ['Europe/Helsinki', 'Helsinki', 'Finland'],
  ['Asia/Jerusalem', 'Jerusalem', 'Israel'],
  ['Asia/Beirut', 'Beirut', 'Lebanon'],
  ['Europe/Istanbul', 'Istanbul', 'Türkiye'],
  ['Europe/Moscow', 'Moscow', 'Russia'],
  ['Asia/Baghdad', 'Baghdad', 'Iraq'],
  ['Asia/Riyadh', 'Riyadh', 'Saudi Arabia'],
  ['Asia/Qatar', 'Doha', 'Qatar'],
  ['Africa/Nairobi', 'Nairobi', 'Kenya'],
  ['Asia/Tehran', 'Tehran', 'Iran'],
  ['Asia/Dubai', 'Dubai', 'United Arab Emirates'],
  ['Asia/Baku', 'Baku', 'Azerbaijan'],
  ['Asia/Yerevan', 'Yerevan', 'Armenia'],
  ['Asia/Tbilisi', 'Tbilisi', 'Georgia'],
  ['Asia/Kabul', 'Kabul', 'Afghanistan'],
  ['Asia/Karachi', 'Karachi', 'Pakistan'],
  ['Asia/Tashkent', 'Tashkent', 'Uzbekistan'],
  ['Asia/Yekaterinburg', 'Yekaterinburg', 'Russia'],
  ['Asia/Kolkata', 'Kolkata', 'India'],
  ['Asia/Colombo', 'Colombo', 'Sri Lanka'],
  ['Asia/Kathmandu', 'Kathmandu', 'Nepal'],
  ['Asia/Dhaka', 'Dhaka', 'Bangladesh'],
  ['Asia/Almaty', 'Almaty', 'Kazakhstan'],
  ['Asia/Yangon', 'Yangon', 'Myanmar'],
  ['Asia/Bangkok', 'Bangkok', 'Thailand'],
  ['Asia/Jakarta', 'Jakarta', 'Indonesia'],
  ['Asia/Ho_Chi_Minh', 'Ho Chi Minh City', 'Vietnam'],
  ['Asia/Shanghai', 'Shanghai', 'China'],
  ['Asia/Hong_Kong', 'Hong Kong', 'Hong Kong'],
  ['Asia/Singapore', 'Singapore', 'Singapore'],
  ['Asia/Kuala_Lumpur', 'Kuala Lumpur', 'Malaysia'],
  ['Asia/Manila', 'Manila', 'Philippines'],
  ['Australia/Perth', 'Perth', 'Australia'],
  ['Asia/Taipei', 'Taipei', 'Taiwan'],
  ['Asia/Tokyo', 'Tokyo', 'Japan'],
  ['Asia/Seoul', 'Seoul', 'South Korea'],
  ['Australia/Darwin', 'Darwin', 'Australia'],
  ['Australia/Brisbane', 'Brisbane', 'Australia'],
  ['Australia/Adelaide', 'Adelaide', 'Australia'],
  ['Australia/Sydney', 'Sydney', 'Australia'],
  ['Australia/Melbourne', 'Melbourne', 'Australia'],
  ['Pacific/Guam', 'Guam', 'Guam'],
  ['Pacific/Noumea', 'Nouméa', 'New Caledonia'],
  ['Pacific/Auckland', 'Auckland', 'New Zealand'],
  ['Pacific/Fiji', 'Suva', 'Fiji'],
  ['Pacific/Tongatapu', "Nuku'alofa", 'Tonga']
];

/* "GMT+03:30" for an offset in minutes. */
function schedGmt(offMin) {
  const sign = offMin < 0 ? '-' : '+';
  const a = Math.abs(offMin);
  return `GMT${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/* <option>s for a tz <select>, sorted by live GMT offset and labelled
   "(GMT±HH:MM) City, Country". `selected` is pre-picked; a stored zone outside
   the curated list is preserved (prepended raw) rather than dropped. */
function schedTzOptions(selected) {
  const now = new Date();
  const zones = SCHED_TZ_ZONES.map(z => ({ tz: z[0], city: z[1], country: z[2], off: schedTzOffset(now, z[0]) }));
  zones.sort((a, b) => a.off - b.off || a.city.localeCompare(b.city));
  let html = '';
  if (selected && !SCHED_TZ_ZONES.some(z => z[0] === selected)) {
    html += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`;
  }
  for (const z of zones) {
    const place = z.country ? `${z.city}, ${z.country}` : z.city;
    html += `<option value="${escapeHtml(z.tz)}"${z.tz === selected ? ' selected' : ''}>(${schedGmt(z.off)}) ${escapeHtml(place)}</option>`;
  }
  return html;
}

async function schedAdminReloadSlots() {
  const ed = schedState.editor;
  try { ed.slots = await dataListScheduleForPair(ed.tutorId, ed.studentId); }
  catch (e) { ed.slots = []; }
}

function schedAdminClose() {
  schedState.editor = null;
  const m = document.getElementById('schedAdminModal');
  if (m) m.remove();
}

function schedAdminRenderModal() {
  const ed = schedState.editor;
  if (!ed) return;
  let m = document.getElementById('schedAdminModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'schedAdminModal';
    m.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    m.style.cssText = 'background:rgba(15,23,42,.45);';
    m.addEventListener('click', e => { if (e.target === m) schedAdminClose(); });
    document.body.appendChild(m);
  }

  const dayOpts = SCHED_MON_FIRST.map(wd =>
    `<option value="${wd}">${SCHED_DAY_LONG[wd]}</option>`).join('');

  const rows = ed.slots.map(s => `
    <div class="flex items-center justify-between px-3 py-2 rounded-xl border mb-1.5" style="background:white;border-color:var(--line);">
      <div class="text-sm" style="color:var(--navy);">
        <span class="font-semibold">${SCHED_DAY_LONG[s.weekday]}</span>
        <span style="color:var(--muted);"> · ${escapeHtml(String(s.start_time).slice(0, 5))} · ${s.duration_min}m</span>
      </div>
      <button onclick="schedAdminDelete('${s.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:#EF4444;">Remove</button>
    </div>`).join('') || `<div class="text-center py-4 text-xs" style="color:var(--muted);">No classes set yet.</div>`;

  m.innerHTML = `
    <div class="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style="background:var(--bg,#fff);">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-base font-display font-bold" style="color:var(--navy);">Weekly schedule</h2>
        <button onclick="schedAdminClose()" class="text-xl leading-none px-2" style="color:var(--muted);">&times;</button>
      </div>
      <p class="text-xs mb-3" style="color:var(--muted);">
        ${bidiText(ed.studentName)} <span style="color:var(--muted);">→</span> ${bidiText(ed.tutorName)}
      </p>

      <div class="rounded-xl p-3 mb-3" style="background:rgba(255,210,63,.08);border:1px solid rgba(255,210,63,.30);">
        <p class="text-[11px] mb-2" style="color:#92400E;">Set each person's timezone. Class times are entered in the <strong>tutor's</strong> timezone; the student sees them converted to theirs.</p>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] mb-1 truncate" style="color:var(--muted);">Tutor — ${bidiText(ed.tutorName)}</label>
            <select id="schedTutorTz" class="w-full rounded-xl px-3 py-2 text-sm field-input">${schedTzOptions(ed.tutorTz)}</select>
          </div>
          <div>
            <label class="block text-[11px] mb-1 truncate" style="color:var(--muted);">Student — ${bidiText(ed.studentName)}</label>
            <select id="schedStudentTz" class="w-full rounded-xl px-3 py-2 text-sm field-input">${schedTzOptions(ed.studentTz)}</select>
          </div>
        </div>
        <button onclick="schedAdminSaveTz()" class="w-full mt-2 py-2 rounded-xl text-sm font-semibold" style="background:white;border:1px solid var(--line);color:var(--secondary);">Save timezones</button>
      </div>

      <div class="mb-4">${rows}</div>

      <div class="rounded-xl p-3 mb-1" style="background:rgba(0,0,0,.02);border:1px solid var(--line);">
        <p class="text-xs font-semibold mb-2" style="color:var(--navy);">Add a class</p>
        <div class="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label class="block text-[11px] mb-1" style="color:var(--muted);">Day</label>
            <select id="schedDay" class="w-full rounded-xl px-3 py-2 text-sm field-input">${dayOpts}</select>
          </div>
          <div>
            <label class="block text-[11px] mb-1" style="color:var(--muted);">Start time</label>
            <input id="schedTime" type="time" value="18:00" class="w-full rounded-xl px-3 py-2 text-sm field-input" />
          </div>
          <div>
            <label class="block text-[11px] mb-1" style="color:var(--muted);">Duration (min)</label>
            <input id="schedDur" type="number" min="5" max="600" step="5" value="60" class="w-full rounded-xl px-3 py-2 text-sm field-input" />
          </div>
        </div>
        <button onclick="schedAdminAdd()" class="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">Add class</button>
      </div>
    </div>`;
}

/* Read the two tz inputs, validate, and persist any change to each profile.
   Changing the tutor's zone also re-anchors this pairing's existing slots so
   their times move with it. Returns the validated {tutorTz, studentTz} or null. */
async function schedAdminPersistTz() {
  const ed = schedState.editor;
  const tutorTz = (document.getElementById('schedTutorTz').value || '').trim();
  const studentTz = (document.getElementById('schedStudentTz').value || '').trim();
  if (!schedValidTz(tutorTz) || !schedValidTz(studentTz)) {
    showToast('Enter valid IANA timezones (e.g. Asia/Tehran, Europe/London).', 'error');
    return null;
  }
  if (tutorTz !== ed.tutorTz) {
    await dataSetMyTimezone(ed.tutorId, tutorTz);
    await dataReanchorSchedule(ed.tutorId, ed.studentId, tutorTz);
  }
  if (studentTz !== ed.studentTz) await dataSetMyTimezone(ed.studentId, studentTz);
  ed.tutorTz = tutorTz; ed.studentTz = studentTz;
  return { tutorTz, studentTz };
}

async function schedAdminSaveTz() {
  if (!schedState.editor) return;
  try {
    const tz = await schedAdminPersistTz();
    if (!tz) return;
    await schedAdminReloadSlots();
    schedAdminRenderModal();
    showToast('Timezones saved.', 'success');
  } catch (e) {
    showToast('Could not save timezones: ' + e.message, 'error');
  }
}

async function schedAdminAdd() {
  const ed = schedState.editor;
  if (!ed) return;
  const weekday = parseInt(document.getElementById('schedDay').value, 10);
  const time = document.getElementById('schedTime').value;       // "HH:MM"
  const dur = parseInt(document.getElementById('schedDur').value, 10) || 60;
  if (!time) { showToast('Pick a start time.', 'error'); return; }

  try {
    const tz = await schedAdminPersistTz();     // also validates the zones
    if (!tz) return;
    await dataAddScheduleSlot({
      tutor_id: ed.tutorId, student_id: ed.studentId,
      weekday, start_time: time, duration_min: dur,
      anchor_tz: tz.tutorTz,
      created_by: (window.almituAuth && window.almituAuth.user && window.almituAuth.user.id) || null
    });
    await schedAdminReloadSlots();
    schedAdminRenderModal();
    showToast('Class added.', 'success');
  } catch (e) {
    showToast('Could not add class: ' + e.message, 'error');
  }
}

async function schedAdminDelete(id) {
  try {
    await dataDeleteScheduleSlot(id);
    await schedAdminReloadSlots();
    schedAdminRenderModal();
    showToast('Class removed.', 'info');
  } catch (e) {
    showToast('Could not remove class: ' + e.message, 'error');
  }
}
