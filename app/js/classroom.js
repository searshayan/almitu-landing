/* ═══════════════════════════════════════════════════════
   Virtual Classroom

   A unified live room: a framed content panel (the Stage, showing native slides)
   on the left, a video column on the right (placeholder tiles until the Zoom
   Video SDK is wired), and one control bar.

   Teaching surface = SCREEN SHARE (not sync). The tutor teaches from the Stage
   and shares it via the video SDK; the student sees the shared Stage. There is
   no slide sync and no pointer — "Share Screen" streams whatever is on the Stage.

   Entry: tutor "Enter Classroom" → pick student (creates the live session that
   lights up the student's "Join Classroom") → load a deck (Curriculum / My
   Session Plans / Generate) → teach → Leave compiles the lesson.
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the loaded deck (a plan with .slides)
  let idx = 0;          // current slide index
  let role = 'tutor';   // 'tutor' drives; 'student' watches the shared screen
  let ro = null;        // ResizeObserver that refits on layout change

  /* ─── open / close ─── */

  function openRoom(asRole) {
    role = asRole === 'student' ? 'student' : 'tutor';
    const v = document.getElementById('viewClassroom');
    if (!v) return;
    v.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nav = document.getElementById('roomNav');
    if (nav) nav.style.display = role === 'tutor' ? '' : 'none';   // only the tutor drives the deck
    const back = document.getElementById('roomBack');
    if (back) back.style.display = role === 'tutor' ? '' : 'none';
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
    if (window.almituVideo) almituVideo.leave();

    if (role !== 'tutor') return;

    // Tutor leaving: if a deck was taught, compile the lesson (reuses endSession,
    // which builds the practice bank, marks the session completed, saves it to
    // the student's dashboard, and returns to the tutor home). If nothing was
    // taught, revert the session to 'planned' so it clears the student's Join
    // without becoming an empty (plan=null) notebook in their history.
    const taughtDeck = slides().length && typeof getState === 'function' && getState().generatedLessonPlan;
    if (taughtDeck && window.tutorState && tutorState.currentSessionId && typeof endSession === 'function') {
      endSession();
    } else if (window.tutorState && tutorState.currentSessionId && typeof dataUpdateSession === 'function') {
      dataUpdateSession(tutorState.currentSessionId, { status: 'planned' }).catch(() => {});
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
      if (window.almituVideo) almituVideo.connect(row.id);   // tutor joins the call
      if (typeof showToast === 'function') showToast((student.full_name || 'Your student') + ' can now Join Classroom.', 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Could not start the classroom: ' + e.message, 'error');
    }
  };

  function setStudentTile(name) {
    const t = document.getElementById('roomTileStudent');
    if (t) t.innerHTML = '<span class="who">' + escHtml(name) + '</span>Waiting to join…';
  }

  /* ─── Tutor: load a deck from the Library onto the Stage ─── */

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
  };

  /* Curriculum + Generate reuse the existing build flow: we stash the classroom
     session, drop into the normal dashboard flow to build/pick a deck, and the
     "Start" button (classroom-aware, see startSession) brings the tutor back
     into the room to teach it. */
  function leaveRoomToBuild() {
    if (window.tutorState) {
      tutorState.classroomSessionId = tutorState.currentSessionId || null;
      tutorState.classroomStudent = tutorState.selectedStudent || null;
      tutorState.fromClassroom = true;
    }
    const v = document.getElementById('viewClassroom'); if (v) v.classList.add('hidden');
    hidePicker();
    document.body.style.overflow = '';
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('resize', fitRoomSlide);
  }

  window.roomLaunchGenerate = function () {
    if (role !== 'tutor') return;
    if (!(window.tutorState && tutorState.currentSessionId)) {
      if (typeof showToast === 'function') showToast('Pick a student first.', 'warn'); return;
    }
    leaveRoomToBuild();
    if (typeof tutorNewSession === 'function') tutorNewSession();
  };

  window.roomLaunchCurriculum = function () {
    if (role !== 'tutor') return;
    if (!(window.tutorState && tutorState.currentSessionId)) {
      if (typeof showToast === 'function') showToast('Pick a student first.', 'warn'); return;
    }
    leaveRoomToBuild();
    if (typeof tutorGoCurriculum === 'function') tutorGoCurriculum();
  };

  /* Called by startSession() when the build began in the classroom: bring the
     finished deck back into the room to teach. */
  window.classroomStartTeaching = function (deck) {
    plan = deck || (typeof getState === 'function' && getState().generatedLessonPlan) || null;
    idx = 0;
    if (window.tutorState) {
      if (tutorState.classroomSessionId) tutorState.currentSessionId = tutorState.classroomSessionId;
      if (tutorState.classroomStudent) tutorState.selectedStudent = tutorState.classroomStudent;
    }
    openRoom('tutor');
    roomRenderSlide();
    if (typeof getState === 'function' && plan) getState().generatedLessonPlan = plan;
    if (window.almituVideo && window.tutorState && tutorState.currentSessionId) almituVideo.connect(tutorState.currentSessionId);
  };

  /* Back to the 3-option launcher to pick a different deck without leaving. */
  window.roomBackToLauncher = function () {
    if (role !== 'tutor') return;
    plan = null; idx = 0;
    if (typeof getState === 'function') getState().generatedLessonPlan = null;
    roomRenderSlide();   // no deck → shows the launcher
  };

  /* Share Screen — streams the Stage (this deck view) to the student via Daily. */
  window.roomShareScreen = function () {
    if (!window.almituVideo) { if (typeof showToast === 'function') showToast('Video isn’t ready yet.', 'warn'); return; }
    if (almituVideo.sharing) almituVideo.stopShare(); else almituVideo.shareScreen();
  };

  /* Re-render the Stage — called by daily-video.js when a screen share ends. */
  window.roomRefreshStage = function () { roomRenderSlide(); };

  /* ─── Student: join and watch the tutor's shared screen ─── */

  window.classroomJoinAsStudent = function (live) {
    plan = null; idx = 0;
    openRoom('student');
    roomRenderSlide();   // "waiting…" note until the tutor shares their screen
    if (window.almituVideo && live && live.id) almituVideo.connect(live.id);
  };

  /* ─── Notes & Assignments (tutor writes for this session) ─── */

  window.roomOpenNotes = function () {
    if (role !== 'tutor') return;
    const panel = document.getElementById('roomNotes');
    const ta = document.getElementById('roomNotesText');
    if (!panel || !ta) return;
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
    const step2 = document.getElementById('tutorNotes'); if (step2) step2.value = notes;   // keep compile in sync
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
      // Tutor sees the 3-option launcher; student waits for the shared screen.
      if (role === 'tutor') {
        if (launcher) launcher.hidden = false;
        if (empty) empty.hidden = true;
      } else {
        if (launcher) launcher.hidden = true;
        if (empty) { empty.hidden = false; empty.textContent = 'Waiting for your tutor to share their screen…'; }
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

  /* Fill the Stage: scale the fixed-width slide to be as BIG as possible while
     still fitting whole (both width and height) — so it's readable, never
     scrolls, and never clips. The cap keeps a short slide from ballooning. */
  function fitRoomSlide() {
    const stage = document.getElementById('roomStage');
    const frame = document.getElementById('roomFrame');
    const content = document.getElementById('roomSlide');
    if (!stage || !frame || !content || !slides().length) return;
    content.style.transform = 'none';
    const w = content.offsetWidth, h = content.offsetHeight;
    if (!w || !h) return;
    const pad = stage.clientWidth < 520 ? 12 : 24;   // tighter margins on small screens
    const availW = stage.clientWidth - pad * 2;
    const availH = stage.clientHeight - pad * 2;
    const k = Math.min(availW / w, availH / h, 3.2);
    content.style.transform = 'scale(' + k + ')';
    frame.style.width = Math.round(w * k) + 'px';
    frame.style.height = Math.round(h * k) + 'px';
  }

  /* Tutor-only deck navigation (no sync — screen share carries it to the student). */
  window.roomNextSlide = function () {
    if (role !== 'tutor' || idx >= slides().length - 1) return;
    idx++; roomRenderSlide();
  };
  window.roomPrevSlide = function () {
    if (role !== 'tutor' || idx <= 0) return;
    idx--; roomRenderSlide();
  };

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
