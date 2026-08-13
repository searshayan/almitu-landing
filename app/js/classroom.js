/* ═══════════════════════════════════════════════════════
   Virtual Classroom — the live room reached from "Start Session".

   The tutor picks content and the student the EXISTING way (Curriculum /
   Generate / My Session Plans → Teach This / choose student → preview & edit).
   "Start Session" then opens THIS room instead of Google Meet: video tiles +
   mic/camera + screen share, with the tutor teaching from the Stage.

     • startSession() → creates the live is_classroom session, then
       classroomStartTeaching(deck) opens the room as tutor + connects video.
     • The student's "Join Classroom" banner opens the same room.
     • Leave → compiles the lesson (reuses endSession).

   Video/voice/screen-share = Daily (see daily-video.js). No slide sync here yet
   (that's a later decision) — the student sees the tutor's shared screen.
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the deck being taught (a plan with .slides)
  let idx = 0;          // current slide index (tutor's Stage)
  let role = 'tutor';   // 'tutor' teaches; 'student' watches
  let ro = null;        // ResizeObserver that refits on layout change
  let sub = null;       // student's realtime slide-follow subscription

  function openRoom(asRole) {
    role = asRole === 'student' ? 'student' : 'tutor';
    const v = document.getElementById('viewClassroom');
    if (!v) return;
    v.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nav = document.getElementById('roomNav');
    if (nav) nav.style.display = role === 'tutor' ? '' : 'none';
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
    document.body.style.overflow = '';
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('resize', fitRoomSlide);
    if (sub) { dataUnsubscribe(sub); sub = null; }
    if (window.almituVideo) almituVideo.leave();

    if (role !== 'tutor') return;

    // Tutor leaving: if a deck was taught, compile the lesson (endSession builds
    // the practice bank, marks the session completed, saves it to the student's
    // dashboard, returns home). Otherwise revert to 'planned' so it never becomes
    // an empty notebook and clears the student's Join.
    const taughtDeck = slides().length && typeof getState === 'function' && getState().generatedLessonPlan;
    if (taughtDeck && window.tutorState && tutorState.currentSessionId && typeof endSession === 'function') {
      endSession();
    } else if (window.tutorState && tutorState.currentSessionId && typeof dataUpdateSession === 'function') {
      dataUpdateSession(tutorState.currentSessionId, { status: 'planned' }).catch(() => {});
      tutorState.currentSessionId = null;
    }
  };

  /* Tutor: called by startSession() once the live session exists + deck is set. */
  window.classroomStartTeaching = function (deck) {
    plan = deck || (typeof getState === 'function' && getState().generatedLessonPlan) || null;
    idx = 0;
    openRoom('tutor');
    roomRenderSlide();
    if (typeof getState === 'function' && plan) getState().generatedLessonPlan = plan;
    persistSlide();   // publish the starting slide so the student mirrors it
    if (window.almituVideo && window.tutorState && tutorState.currentSessionId) {
      almituVideo.connect(tutorState.currentSessionId);
    }
  };

  /* Student: join the room the tutor started. The deck rides on the session row,
     so the student renders the slides natively (crisp, scrollable) and follows
     the tutor's current slide over Realtime — no screen-video for the slides. */
  window.classroomJoinAsStudent = function (live) {
    plan = (live && live.plan) || null;
    idx = (live && live.current_slide) | 0;
    openRoom('student');
    roomRenderSlide();
    if (window.almituVideo && live && live.id) almituVideo.connect(live.id);
    if (sub) { dataUnsubscribe(sub); sub = null; }
    if (live && live.id && typeof dataOpenLiveChannel === 'function') {
      sub = dataOpenLiveChannel(live.id, { onState: onRoomState });
    }
  };

  /* The tutor's row changed: pick up the deck + current slide (unless a screen
     share is currently overlaying the Stage — then just remember the slide). */
  function onRoomState(row) {
    if (!row) return;
    if (row.status && row.status !== 'live') { window.classroomLeave(); return; }
    if (row.plan) plan = row.plan;
    idx = Math.max(0, row.current_slide | 0);
    if (!document.getElementById('rv-screen')) roomRenderSlide();
  }

  /* Tutor: publish the current slide so the student's Stage follows. */
  function persistSlide() {
    if (role !== 'tutor') return;
    if (window.tutorState && tutorState.currentSessionId && typeof dataSetPresentState === 'function') {
      dataSetPresentState(tutorState.currentSessionId, { current_slide: idx }).catch(() => {});
    }
  }

  /* Share Screen — streams the tutor's screen to the student (Daily). */
  window.roomShareScreen = function () {
    if (!window.almituVideo) { if (typeof showToast === 'function') showToast('Video isn’t ready yet.', 'warn'); return; }
    if (almituVideo.sharing) almituVideo.stopShare(); else almituVideo.shareScreen();
  };

  /* Re-render the Stage — called by daily-video.js when a screen share ends. */
  window.roomRefreshStage = function () { roomRenderSlide(); };

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

  /* ─── Stage slide rendering (contain-fit for now; scroll fix comes later) ─── */

  function slides() { return (plan && plan.slides) || []; }

  function roomRenderSlide() {
    const el = document.getElementById('roomSlide');
    const frame = document.getElementById('roomFrame');
    const empty = document.getElementById('roomEmpty');
    if (!el) return;
    const list = slides();
    if (!list.length) {
      if (frame) frame.style.display = 'none';
      if (empty) {
        empty.hidden = false;
        empty.textContent = role === 'tutor'
          ? 'Loading your slides…'
          : 'Waiting for your tutor to share their screen…';
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

  /* Fill the WIDTH (so slides are big and readable) and SCROLL when a slide is
     taller than the Stage — short slides center, long slides scroll, nothing is
     squished. `zoom` scales layout so the frame scrolls naturally. */
  function fitRoomSlide() {
    const stage = document.getElementById('roomStage');
    const frame = document.getElementById('roomFrame');
    const content = document.getElementById('roomSlide');
    if (!stage || !frame || !content || !slides().length) return;
    content.style.zoom = '1';
    const w = content.offsetWidth, h = content.offsetHeight;
    if (!w || !h) return;
    const pad = stage.clientWidth < 520 ? 14 : 28;
    const availW = stage.clientWidth - pad * 2;
    const availH = stage.clientHeight - pad * 2;
    const k = Math.min(availW / w, 2.6);       // fill width (capped); taller → scroll
    content.style.zoom = k;
    frame.style.width = availW + 'px';
    frame.style.height = availH + 'px';
    frame.style.justifyContent = (h * k <= availH) ? 'center' : 'flex-start';
  }

  window.roomNextSlide = function () {
    if (role !== 'tutor' || idx >= slides().length - 1) return;
    idx++; roomRenderSlide(); persistSlide();
  };
  window.roomPrevSlide = function () {
    if (role !== 'tutor' || idx <= 0) return;
    idx--; roomRenderSlide(); persistSlide();
  };
})();
