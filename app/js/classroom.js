/* ═══════════════════════════════════════════════════════
   Virtual Classroom

   A unified live room: a framed content panel (native slides, transform-fit)
   on the left, a video column on the right (placeholder tiles until Phase 3
   wires the Zoom Video SDK), and one control bar.

   Entry model (per the agreed flow):
     • Tutor taps "Enter Classroom" → the room opens and asks which student
       they're teaching. Picking a student creates a LIVE classroom session,
       which is what lights up that student's "Join Classroom".
     • Student's "Join Classroom" stays locked until their tutor is in the room
       and has selected them; tapping it enters the same room.

   Still to come (later increments): loading a deck from the Library, the
   realtime "● Shared" slide sync so the student mirrors the tutor, chat,
   Leave→compile, the mobile Video/Slides flip, and the real video tiles.
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the loaded deck (a session/curriculum plan with .slides)
  let idx = 0;          // current slide index
  let role = 'tutor';   // 'tutor' drives; 'student' is view-only
  let ro = null;        // ResizeObserver that refits on layout change

  /* ─── open / close the room ─── */

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
    // Phase 2 will also tear down the call + run the compile-lesson flow here.
  };

  /* Direct entry with a deck already chosen (preview + the student join path). */
  window.classroomEnter = function (loadedPlan, asRole) {
    plan = loadedPlan || null;
    idx = 0;
    openRoom(asRole);
    roomRenderSlide();
  };

  /* ─── Tutor: enter, then pick the student ─── */

  window.tutorEnterClassroom = function () {
    if (window.tutorState) { tutorState.currentSessionId = null; }
    plan = null; idx = 0;
    openRoom('tutor');
    roomRenderSlide();            // shows the "pick a student / load a deck" prompt
    showPicker();
  };

  function showPicker() {
    const host = document.getElementById('roomPicker');
    const list = document.getElementById('roomPickerList');
    if (!host || !list) return;
    const students = (window.tutorState && tutorState.students) || [];
    host.classList.remove('hidden');
    list.innerHTML = students.length
      ? students.map(s => pickerRow(s, false)).join('')
      : '<p class="room-pick-empty">No students assigned yet.</p>';
    // Best-effort "class today" highlight — refine the list once the schedule loads.
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
      const dow = new Date().getDay();   // 0=Sun..6=Sat, tutor's local ≈ anchor tz
      const todayIds = new Set((rows || []).filter(r => r.weekday === dow).map(r => r.student_id));
      if (!todayIds.size) return;
      // Re-render with today's students first + badged.
      const sorted = students.slice().sort((a, b) => (todayIds.has(b.id) ? 1 : 0) - (todayIds.has(a.id) ? 1 : 0));
      list.innerHTML = sorted.map(s => pickerRow(s, todayIds.has(s.id))).join('');
    } catch (e) { /* highlight is best-effort; the plain list already works */ }
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

  /* ─── Student: join the room the tutor opened ─── */

  window.classroomJoinAsStudent = function (live) {
    plan = (live && live.plan) || null;
    idx = 0;
    openRoom('student');
    roomRenderSlide();
  };

  /* ─── slide rendering (transform:scale contain-fit, iOS-safe) ─── */

  function slides() { return (plan && plan.slides) || []; }

  function roomRenderSlide() {
    const el = document.getElementById('roomSlide');
    const frame = document.getElementById('roomFrame');
    const empty = document.getElementById('roomEmpty');
    if (!el) return;
    const list = slides();
    if (!list.length) {
      // No deck yet — show a centered prompt instead of a blank stage.
      if (frame) frame.style.display = 'none';
      if (empty) {
        empty.hidden = false;
        empty.textContent = role === 'tutor'
          ? 'Pick a student, then load a deck from Library.'
          : 'Waiting for your tutor to share a slide…';
      }
      const src0 = document.getElementById('roomSource'); if (src0) src0.textContent = 'Classroom';
      const c0 = document.getElementById('roomCounter'); if (c0) c0.textContent = '';
      return;
    }
    if (frame) frame.style.display = '';
    if (empty) empty.hidden = true;
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

  window.roomNextSlide = function () { if (role !== 'tutor') return; idx++; roomRenderSlide(); };
  window.roomPrevSlide = function () { if (role !== 'tutor') return; idx--; roomRenderSlide(); };

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
