/* ═══════════════════════════════════════════════════════
   Virtual Classroom

   A unified live room: a framed content panel (native slides, transform-fit)
   on the left, a video column on the right (placeholder tiles until Phase 3
   wires the Zoom Video SDK), and one control bar.

   Entry model:
     • Tutor taps "Enter Classroom" → picks the student they're teaching →
       that creates a LIVE classroom session, lighting up the student's
       "Join Classroom".
     • Tutor taps "Library" → loads a saved deck onto the stage. Loading it, and
       every slide change, is shared over Realtime so the student mirrors it
       (Model A: tutor drives, student view-only). Slides fit whole (transform),
       so there's nothing to scroll and the student always sees the full slide.

   Still to come: chat, Leave→compile, the mobile Video/Slides flip, real video.
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the loaded deck (a plan with .slides)
  let idx = 0;          // current slide index
  let role = 'tutor';   // 'tutor' drives; 'student' is view-only
  let ro = null;        // ResizeObserver that refits on layout change
  let sub = null;       // student's realtime subscription to the session row
  let liveId = null;    // the live session id (student side)

  /* ─── open / close ─── */

  function openRoom(asRole) {
    role = asRole === 'student' ? 'student' : 'tutor';
    const v = document.getElementById('viewClassroom');
    if (!v) return;
    v.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nav = document.getElementById('roomNav');
    if (nav) nav.style.display = role === 'tutor' ? '' : 'none';   // tutor drives (Model A)
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => fitRoomSlide());
      const st = document.getElementById('roomStage');
      if (st) ro.observe(st);
    }
    window.addEventListener('resize', fitRoomSlide);
  }

  window.classroomLeave = function () {
    const v = document.getElementById('viewClassroom');
    if (v) v.classList.add('hidden');
    hidePicker();
    document.body.style.overflow = '';
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('resize', fitRoomSlide);
    if (sub) { dataUnsubscribe(sub); sub = null; }
    liveId = null;

    if (role !== 'tutor') return;

    // Tutor leaving: if a deck was taught, compile the lesson (reuses endSession,
    // which builds the practice bank, marks the session completed, saves it to
    // the student's dashboard, and returns to the tutor home). If nothing was
    // taught, just close the still-"live" session so the student's Join clears.
    const taughtDeck = slides().length && typeof getState === 'function' && getState().generatedLessonPlan;
    if (taughtDeck && window.tutorState && tutorState.currentSessionId && typeof endSession === 'function') {
      endSession();
    } else if (window.tutorState && tutorState.currentSessionId && typeof dataUpdateSession === 'function') {
      dataUpdateSession(tutorState.currentSessionId, { status: 'completed' }).catch(() => {});
      tutorState.currentSessionId = null;
    }
  };

  /* Direct entry with a deck already chosen (preview path). */
  window.classroomEnter = function (loadedPlan, asRole) {
    plan = loadedPlan || null; idx = 0;
    openRoom(asRole);
    roomRenderSlide();
  };

  /* ─── Tutor: enter, then pick the student ─── */

  window.tutorEnterClassroom = function () {
    if (window.tutorState) tutorState.currentSessionId = null;
    plan = null; idx = 0;
    openRoom('tutor');
    roomRenderSlide();
    showPicker();
  };

  function setPicker(title, sub) {
    const t = document.getElementById('roomPickerTitle'); if (t) t.textContent = title;
    const s = document.getElementById('roomPickerSub'); if (s) s.textContent = sub;
  }

  function showPicker() {
    const host = document.getElementById('roomPicker');
    const list = document.getElementById('roomPickerList');
    if (!host || !list) return;
    setPicker('Who are you teaching now?', "Pick the student for this class — they'll be able to Join Classroom.");
    const students = (window.tutorState && tutorState.students) || [];
    host.classList.remove('hidden');
    list.innerHTML = students.length
      ? students.map(s => pickerRow(s, false)).join('')
      : '<p class="room-pick-empty">No students assigned yet.</p>';
    markScheduledToday(students, list);
  }
  function hidePicker() { const h = document.getElementById('roomPicker'); if (h) h.classList.add('hidden'); }

  function pickerRow(s, today) {
    const name = escHtml(s.full_name || 'Student');
    const initial = (s.full_name || 'S').charAt(0).toUpperCase();
    return `<button class="room-pick" onclick="classroomSelectStudent('${s.id}')">
      <span class="room-pick-av">${initial}</span>
      <span class="room-pick-name">${name}</span>
      ${today ? '<span class="room-pick-badge">Class today</span>' : ''}
    </button>`;
  }

  async function markScheduledToday(students, list) {
    try {
      if (typeof dataListMySchedule !== 'function' || !window.currentUserId) return;
      const rows = await dataListMySchedule(currentUserId());
      const dow = new Date().getDay();
      const todayIds = new Set((rows || []).filter(r => r.weekday === dow).map(r => r.student_id));
      if (!todayIds.size) return;
      const sorted = students.slice().sort((a, b) => (todayIds.has(b.id) ? 1 : 0) - (todayIds.has(a.id) ? 1 : 0));
      list.innerHTML = sorted.map(s => pickerRow(s, todayIds.has(s.id))).join('');
    } catch (e) { /* best-effort */ }
  }

  window.classroomSelectStudent = async function (studentId) {
    const students = (window.tutorState && tutorState.students) || [];
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    try {
      const row = await dataCreateSession({
        tutor_id: currentUserId(),
        student_id: student.id,
        title: 'Live Classroom',
        status: 'live',
        is_classroom: true,
        plan: null
      });
      if (window.tutorState) { tutorState.currentSessionId = row.id; tutorState.selectedStudent = student; }
      hidePicker();
      setStudentTile(student.full_name || 'Student');
      if (typeof showToast === 'function') showToast((student.full_name || 'Your student') + ' can now Join Classroom.', 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Could not start the classroom: ' + e.message, 'error');
    }
  };

  function setStudentTile(name) {
    const t = document.getElementById('roomTileStudent');
    if (t) t.innerHTML = '<span class="who">' + escHtml(name) + '</span>Waiting to join…';
  }

  /* ─── Tutor: load a deck from the Library and share it ─── */

  window.roomOpenLibrary = function () {
    if (role !== 'tutor') return;
    const host = document.getElementById('roomPicker');
    const list = document.getElementById('roomPickerList');
    if (!host || !list) return;
    setPicker('Choose a deck', 'Load one of your saved sessions onto the stage.');
    const plans = (window.tutorState && tutorState.plans) || [];
    host.classList.remove('hidden');
    list.innerHTML = plans.length
      ? plans.map(p => deckRow(p)).join('')
      : '<p class="room-pick-empty">No saved sessions yet — build one first.</p>';
  };

  function deckRow(p) {
    return `<button class="room-pick" onclick="classroomLoadDeck('${p.id}')">
      <span class="room-pick-av">📚</span>
      <span class="room-pick-name">${escHtml(p.title || 'Session')}</span>
    </button>`;
  }

  window.classroomLoadDeck = function (planId) {
    const plans = (window.tutorState && tutorState.plans) || [];
    const entry = plans.find(p => p.id === planId);
    if (!entry || !entry.plan) return;
    plan = entry.plan; idx = 0;
    // Reuse the existing workspace state so Leave→compile (endSession) and any
    // in-place editing operate on this deck, exactly like the normal flow.
    if (typeof getState === 'function') getState().generatedLessonPlan = plan;
    if (window.tutorState) tutorState.currentPlanId = entry.id;
    hidePicker();
    roomRenderSlide();
    // Share the deck with the student + mark presenting on the live session row.
    if (window.tutorState && tutorState.currentSessionId && typeof dataUpdateSession === 'function') {
      dataUpdateSession(tutorState.currentSessionId, { plan: plan, present_active: true, current_slide: 0 }).catch(() => {});
    }
  };

  /* The other two stage-launcher options (fully wired in the next pass). */
  window.roomLaunchCurriculum = function () {
    if (typeof showToast === 'function') showToast('Curriculum-in-room is the next piece — use My Session Plans for now.', 'info');
  };
  window.roomLaunchGenerate = function () {
    if (typeof showToast === 'function') showToast('Generate-in-room is next — build a session in My Sessions, then load it here.', 'info');
  };

  /* ─── Notes & Assignments (tutor writes for this session) ─── */

  window.roomOpenNotes = function () {
    if (role !== 'tutor') return;
    const panel = document.getElementById('roomNotes');
    const ta = document.getElementById('roomNotesText');
    if (!panel || !ta) return;
    // Prefer the shared step-2 notes field so this stays in sync with compile.
    const step2Notes = (document.getElementById('tutorNotes') || {}).value;
    ta.value = (window.tutorState && tutorState.currentNotes) || step2Notes || '';
    panel.classList.remove('hidden');
    ta.focus();
  };
  window.roomCloseNotes = function () {
    const panel = document.getElementById('roomNotes');
    if (panel) panel.classList.add('hidden');
  };
  window.roomSaveNotes = async function () {
    const ta = document.getElementById('roomNotesText');
    if (!ta) return;
    const notes = ta.value || '';
    if (window.tutorState) tutorState.currentNotes = notes;
    // Mirror into the step-2 field so Leave→compile (endSession) keeps these notes.
    const step2 = document.getElementById('tutorNotes'); if (step2) step2.value = notes;
    if (window.tutorState && tutorState.currentSessionId && typeof dataUpdateSession === 'function') {
      try {
        await dataUpdateSession(tutorState.currentSessionId, { tutor_notes: notes });
        if (typeof showToast === 'function') showToast('Notes saved for this session.', 'success');
      } catch (e) {
        if (typeof showToast === 'function') showToast('Could not save notes: ' + e.message, 'error');
      }
    }
    roomCloseNotes();
  };

  /* ─── Student: join and mirror the tutor ─── */

  window.classroomJoinAsStudent = function (live) {
    if (sub) { dataUnsubscribe(sub); sub = null; }   // never stack subscriptions on re-join
    plan = (live && live.plan) || null;
    idx = (live && live.current_slide) | 0;
    liveId = live && live.id;
    openRoom('student');
    roomRenderSlide();
    if (liveId && typeof dataOpenLiveChannel === 'function') {
      sub = dataOpenLiveChannel(liveId, { onState: onRoomState });
    }
  };

  /* The tutor's row changed: pick up a (re)loaded deck and the current slide. */
  function onRoomState(row) {
    if (!row) return;
    if (row.status && row.status !== 'live') { window.classroomLeave(); return; }  // tutor ended the class
    if (row.plan) plan = row.plan;              // deck loaded/replaced by the tutor
    if (!row.present_active || !slides().length) { roomRenderSlide(); return; }
    idx = Math.max(0, row.current_slide | 0);
    roomRenderSlide();
  }

  /* ─── slide rendering (transform:scale contain-fit, iOS-safe) ─── */

  function slides() { return (plan && plan.slides) || []; }

  function roomRenderSlide() {
    const el = document.getElementById('roomSlide');
    const frame = document.getElementById('roomFrame');
    const empty = document.getElementById('roomEmpty');
    if (!el) return;
    const list = slides();
    const launcher = document.getElementById('roomLauncher');
    if (!list.length) {
      if (frame) frame.style.display = 'none';
      // Tutor sees the 3-option launcher; student sees a gentle "waiting" note.
      if (role === 'tutor') {
        if (launcher) launcher.hidden = false;
        if (empty) empty.hidden = true;
      } else {
        if (launcher) launcher.hidden = true;
        if (empty) { empty.hidden = false; empty.textContent = 'Waiting for your tutor to share a slide…'; }
      }
      const src0 = document.getElementById('roomSource'); if (src0) src0.textContent = 'Classroom';
      const c0 = document.getElementById('roomCounter'); if (c0) c0.textContent = '';
      return;
    }
    if (frame) frame.style.display = '';
    if (empty) empty.hidden = true;
    if (launcher) launcher.hidden = true;
    idx = Math.max(0, Math.min(idx, list.length - 1));
    el.innerHTML = list[idx].html;
    const src = document.getElementById('roomSource');
    if (src) src.textContent = (plan.meta && plan.meta.title) || 'Session';
    const c = document.getElementById('roomCounter');
    if (c) c.textContent = (idx + 1) + ' / ' + list.length;
    const p = document.getElementById('roomPrev'), n = document.getElementById('roomNext');
    if (p) p.disabled = idx === 0;
    if (n) n.disabled = idx === list.length - 1;
    fitRoomSlide();
    requestAnimationFrame(fitRoomSlide);
    setTimeout(fitRoomSlide, 60);
  }

  function fitRoomSlide() {
    const stage = document.getElementById('roomStage');
    const frame = document.getElementById('roomFrame');
    const content = document.getElementById('roomSlide');
    if (!stage || !frame || !content || !slides().length) return;
    content.style.transform = 'none';
    const w = content.offsetWidth, h = content.offsetHeight;
    if (!w || !h) return;
    const availW = stage.clientWidth - 32;
    const availH = stage.clientHeight - 32;
    const k = Math.min(availW / w, availH / h, 2.4);
    content.style.transform = 'scale(' + k + ')';
    frame.style.width = (w * k) + 'px';
    frame.style.height = (h * k) + 'px';
  }

  /* Tutor-only nav — persists the slide so the student mirrors it. */
  window.roomNextSlide = function () {
    if (role !== 'tutor' || idx >= slides().length - 1) return;
    idx++; roomRenderSlide(); persistSlide();
  };
  window.roomPrevSlide = function () {
    if (role !== 'tutor' || idx <= 0) return;
    idx--; roomRenderSlide(); persistSlide();
  };
  function persistSlide() {
    if (window.tutorState && tutorState.currentSessionId && typeof dataSetPresentState === 'function') {
      dataSetPresentState(tutorState.currentSessionId, { present_active: true, current_slide: idx }).catch(() => {});
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
