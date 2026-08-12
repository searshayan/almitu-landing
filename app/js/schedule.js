/* ════════════════════════════════════════════════════════════════════════
   schedule.js — Weekly class timetable + "can't attend" flags

   • The coordinator (admin) sets each tutor↔student pair's recurring weekly
     classes (weekday + time), anchored in the TUTOR's timezone.
   • Students see their week under the "Join the Session" banner; tutors see an
     aggregate week (all students) in a "Schedule" tab. Each viewer sees the
     times converted into THEIR OWN timezone — so a class can legitimately land
     on a different weekday for each side (day-shift is expected, not a bug).
   • Default = attending. Tap a class to flag "can't attend" for THIS week's
     occurrence; it reddens on both dashboards (the flag lives on the session,
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

/* This week's occurrence of a slot: the concrete instant + the anchor-tz date
   that identifies it (used as the attendance key, identical for both parties). */
function schedOccurrence(slot) {
  const tz = slot.anchor_tz || 'UTC';
  const today = schedPartsInTz(new Date(), tz);           // anchor-local "today"
  const [hh, mm] = String(slot.start_time).split(':').map(n => parseInt(n, 10));
  // Monday-based index of today, and of the target weekday.
  const todayMonIdx = (today.weekday + 6) % 7;
  const targetMonIdx = (slot.weekday + 6) % 7;
  // Do day arithmetic on midnight-UTC of the anchor-local date (UTC days = 24h,
  // so adding/subtracting days never trips over DST).
  const base = Date.UTC(today.y, today.mo - 1, today.d);
  const target = new Date(base + (targetMonIdx - todayMonIdx) * 86400000);
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
  if (schedState.role === 'student') schedRenderStudent();
  else if (schedState.role === 'tutor') schedRenderTutor();
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
  const disabled = schedState.readOnly ? 'disabled' : '';
  const cursor = schedState.readOnly ? 'default' : 'pointer';

  const bg = flagged ? 'rgba(239,68,68,.08)' : 'rgba(6,214,160,.08)';
  const border = flagged ? 'rgba(239,68,68,.45)' : 'rgba(6,214,160,.30)';
  const timeStyle = flagged ? 'color:#B91C1C;text-decoration:line-through;' : 'color:var(--navy);';

  const caption = flagged
    ? `<span class="block text-[10px] font-semibold mt-0.5" style="color:#B91C1C;">${schedFlagCaption(flag)}</span>`
    : (schedState.readOnly ? '' : `<span class="block text-[10px] mt-0.5" style="color:var(--muted);">tap if you can’t make it</span>`);

  return `
    <button type="button" ${disabled}
      ${schedState.readOnly ? '' : `onclick="schedToggleFlag('${slot.id}')"`}
      class="w-full text-left rounded-xl px-2.5 py-2 mb-1.5 transition-all"
      style="background:${bg};border:1px solid ${border};cursor:${cursor};">
      <span class="block text-xs font-bold" style="${timeStyle}">${escapeHtml(start)}${end ? '–' + escapeHtml(end) : ''}</span>
      ${subtitle ? `<span class="block text-[11px] truncate mt-0.5" style="color:var(--muted);">${bidiText(subtitle)}</span>` : ''}
      ${caption}
    </button>`;
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

/* ─────────────── student view (under the Join banner) ─────────────── */

function schedRenderStudent() {
  const host = document.getElementById('studentScheduleCard');
  if (!host) return;
  if (!schedState.slots.length) { host.classList.add('hidden'); host.innerHTML = ''; return; }

  const cols = schedBucketByViewerDay(schedState.slots);
  const grid = schedWeekGrid(cols, slot => (slot.tutor && slot.tutor.full_name) || 'Tutor');

  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="card-surface rounded-2xl p-5 mb-6">
      <div class="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 class="text-sm font-semibold" style="color:var(--navy);">🗓 Your weekly classes</h2>
        <span class="text-[11px]" style="color:var(--muted);">times shown in your timezone (${escapeHtml(schedState.viewerTz)})</span>
      </div>
      ${grid}
    </div>`;
}

/* ─────────────── tutor view (Schedule tab) ─────────────── */

function schedRenderTutor() {
  const host = document.getElementById('tutorSchedule');
  if (!host) return;

  if (!schedState.loaded) {
    host.innerHTML = '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading your schedule…</div>';
    return;
  }
  if (!schedState.slots.length) {
    host.innerHTML = `
      <div class="card-surface rounded-2xl p-8 text-center">
        <p class="text-sm font-semibold mb-1" style="color:var(--navy);">No classes scheduled yet</p>
        <p class="text-xs" style="color:var(--muted);">Your coordinator sets class times. They'll appear here once assigned.</p>
      </div>`;
    return;
  }

  const cols = schedBucketByViewerDay(schedState.slots);
  schedState.tutorCols = {};
  for (const wd in cols) schedState.tutorCols[wd] = cols[wd].map(s => s.id);

  // "Day off" control per column: flag every class that day at once (or clear).
  const dayExtra = wd => {
    if (schedState.readOnly || !cols[wd].length) return '';
    const allFlagged = cols[wd].every(s => schedFlagFor(s));
    return `<button type="button" onclick="schedTutorDayToggle(${wd})"
       class="block mx-auto mt-0.5 text-[10px] font-semibold" style="color:${allFlagged ? '#B91C1C' : 'var(--muted)'};">
       ${allFlagged ? 'undo day off' : 'day off'}</button>`;
  };
  const grid = schedWeekGrid(cols, slot => (slot.student && slot.student.full_name) || 'Student', dayExtra);

  host.innerHTML = `
    <div class="card-surface rounded-2xl p-5">
      <div class="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 class="text-sm font-semibold" style="color:var(--navy);">🗓 My weekly classes</h2>
        <span class="text-[11px]" style="color:var(--muted);">times in your timezone (${escapeHtml(schedState.viewerTz)}) · tap a class if you can't make it</span>
      </div>
      ${grid}
    </div>`;
}

/* ─────────────── flag toggling + partner notification ─────────────── */

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
  return `${day} at ${time}${mine ? ' (my time)' : ''}`;
}

/* Courtesy chat message to the partner when a class is flagged "can't attend".
   Posts into the existing 1:1 thread (unread badge + realtime). Only fires on
   flagging (not on clearing), and never blocks the flag — failures swallowed. */
async function schedNotifyFlag(slot, occ) {
  try {
    const partnerId = schedPartnerId(slot);
    if (!partnerId) return;
    const when = await schedWhenForPartner(partnerId, occ.instant);
    await dataSendMessage(partnerId, `🗓 Heads up — I can’t attend our class this ${when}, just this week.`);
  } catch (e) { /* courtesy only */ }
}

async function schedToggleFlag(slotId) {
  if (schedState.readOnly) return;
  const slot = schedState.slots.find(s => s.id === slotId);
  const occ = schedState.occBySlot[slotId];
  if (!slot || !occ) return;
  const wasFlagged = !!schedState.flags[`${slotId}|${occ.occDate}`];
  try {
    if (wasFlagged) await dataUnflagAttendance(slotId, occ.occDate);
    else await dataFlagAttendance(slotId, occ.occDate, schedState.myId, schedState.role);
    await schedReload();
    if (!wasFlagged) schedNotifyFlag(slot, occ);   // notify only on "can't attend"
  } catch (e) {
    showToast('Could not update attendance: ' + e.message, 'error');
  }
}

/* One summary message to a student when the tutor flags a whole day off. */
async function schedNotifyDay(partnerId, slots) {
  try {
    if (!partnerId || !slots.length) return;
    const occ = schedState.occBySlot[slots[0].id];
    const when = await schedWhenForPartner(partnerId, occ.instant);   // "Monday at 6:00 PM"
    const day = when.split(' at ')[0];
    const plural = slots.length > 1 ? 'es' : '';
    await dataSendMessage(partnerId, `🗓 Heads up — I can’t make our class${plural} this ${day}, just this week.`);
  } catch (e) { /* courtesy only */ }
}

/* Tutor: flag (or clear) every class in one viewer-day column. */
async function schedTutorDayToggle(wd) {
  if (schedState.readOnly) return;
  const ids = schedState.tutorCols[wd] || [];
  if (!ids.length) return;
  const allFlagged = ids.every(id => {
    const occ = schedState.occBySlot[id];
    return occ && schedState.flags[`${id}|${occ.occDate}`];
  });
  const changed = [];
  try {
    for (const id of ids) {
      const occ = schedState.occBySlot[id];
      if (!occ) continue;
      const isFlagged = !!schedState.flags[`${id}|${occ.occDate}`];
      if (allFlagged && isFlagged) { await dataUnflagAttendance(id, occ.occDate); changed.push(id); }
      else if (!allFlagged && !isFlagged) { await dataFlagAttendance(id, occ.occDate, schedState.myId, schedState.role); changed.push(id); }
    }
    await schedReload();
    // Notify each affected student once — only when flagging (day off), not clearing.
    if (!allFlagged) {
      const byPartner = {};
      for (const id of changed) {
        const slot = schedState.slots.find(s => s.id === id);
        if (!slot) continue;
        const pid = schedPartnerId(slot);
        (byPartner[pid] = byPartner[pid] || []).push(slot);
      }
      for (const pid in byPartner) schedNotifyDay(pid, byPartner[pid]);
    }
  } catch (e) {
    showToast('Could not update the day: ' + e.message, 'error');
  }
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

/* Curated fallback for browsers without Intl.supportedValuesOf (pre-2022). */
const SCHED_TZ_FALLBACK = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Istanbul', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
  'Asia/Jerusalem', 'Asia/Baghdad', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Dubai',
  'Asia/Kabul', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Jakarta',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland'
];

/* The full standard IANA zone list (or the fallback). */
function schedTzList() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const list = Intl.supportedValuesOf('timeZone');
      if (list && list.length) return list;
    }
  } catch (e) {}
  return SCHED_TZ_FALLBACK;
}

/* <optgroup>-grouped <option>s for a tz <select>, `selected` pre-picked. Option
   text is the city (region prefix stripped, underscores → spaces); value is the
   full IANA name. A stored value not in the list is preserved at the top. */
function schedTzOptions(selected) {
  const list = schedTzList();
  const groups = {};
  for (const tz of list) {
    const region = tz.includes('/') ? tz.split('/')[0] : 'Other';
    (groups[region] = groups[region] || []).push(tz);
  }
  let html = '';
  if (selected && !list.includes(selected)) {
    html += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`;
  }
  for (const region of Object.keys(groups).sort()) {
    html += `<optgroup label="${escapeHtml(region)}">` + groups[region].map(tz => {
      const city = tz.includes('/') ? tz.split('/').slice(1).join('/').replace(/_/g, ' ') : tz;
      return `<option value="${escapeHtml(tz)}"${tz === selected ? ' selected' : ''}>${escapeHtml(city)}</option>`;
    }).join('') + `</optgroup>`;
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
