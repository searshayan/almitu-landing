/* ═══════════════════════════════════════════════════════
   Virtual Classroom — the live room reached from "Start Session".

   Reached the EXISTING way: pick content → Teach This → choose student →
   preview & edit → "Start Session" opens THIS room (video + screen share).

   FULL STAGE MIRROR: whatever is on the tutor's Stage is shown identically on
   the student's Stage — the current slide, revealed answers, opened notes, and
   scroll position. The tutor broadcasts the live slide DOM (innerHTML) + scroll
   on every change; the student renders it, view-only (no clicks). Slides fill
   the width and scroll when tall, so they stay big and readable.

   "Share Screen" is separate — it streams the tutor's actual screen (whole
   screen; the browser can't isolate one element) for showing non-slide content.
   Video/voice/screen-share = Daily (daily-video.js). Leave → compiles the lesson.
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the deck being taught (a plan with .slides)
  let idx = 0;          // current slide index (tutor drives)
  let role = 'tutor';   // 'tutor' teaches; 'student' watches, view-only
  let ro = null;        // ResizeObserver that refits on layout change
  let chan = null;      // realtime channel (tutor sends, student receives)
  let mo = null;        // tutor's MutationObserver on the Stage slide
  let hb = null;        // tutor's heartbeat re-broadcast (for late joiners)
  let htmlT = 0, scrollT = 0;   // send throttles
  let studentScrollF = 0;       // scroll the student should hold across re-renders

  const SLIDE = () => document.getElementById('roomSlide');
  const FRAME = () => document.getElementById('roomFrame');

  function openRoom(asRole) {
    role = asRole === 'student' ? 'student' : 'tutor';
    const v = document.getElementById('viewClassroom');
    if (!v) return;
    v.classList.remove('hidden');
    v.classList.toggle('room-student', role === 'student');   // view-only styling
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
    stopStageMirror();
    if (chan) { dataUnsubscribe(chan); chan = null; }
    if (window.almituVideo) almituVideo.leave();

    if (role !== 'tutor') return;

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
    if (window.tutorState && tutorState.currentSessionId) {
      chan = dataOpenLiveChannel(tutorState.currentSessionId);   // send-only channel
      startStageMirror();
      if (window.almituVideo) almituVideo.connect(tutorState.currentSessionId);
    }
  };

  /* Student: join the room. The Stage is driven by the tutor's mirror; the deck
     on the session row gives an immediate base slide until the first frame. */
  window.classroomJoinAsStudent = function (live) {
    plan = (live && live.plan) || null;
    idx = (live && live.current_slide) | 0;
    openRoom('student');
    roomRenderSlide();
    if (window.almituVideo && live && live.id) almituVideo.connect(live.id);
    if (chan) { dataUnsubscribe(chan); chan = null; }
    if (live && live.id) {
      chan = dataOpenLiveChannel(live.id, { onState: onRoomState, onHtml: onStageHtml, onScroll: onStageScroll });
    }
  };

  function onRoomState(row) {
    if (row && row.status && row.status !== 'live') window.classroomLeave();   // tutor ended the class
  }

  /* Student: apply the tutor's live Stage DOM (slide + reveals + notes). */
  function onStageHtml(p) {
    const el = SLIDE();
    if (!el || !p || typeof p.html !== 'string') return;
    const frame = FRAME(); const empty = document.getElementById('roomEmpty');
    if (frame) frame.style.display = '';
    if (empty) empty.hidden = true;
    el.innerHTML = p.html;
    fitRoomSlide();
    applyScroll(studentScrollF);
  }
  function onStageScroll(p) {
    studentScrollF = clamp01(p && typeof p.f === 'number' ? p.f : 0);
    applyScroll(studentScrollF);
  }
  function applyScroll(f) {
    const frame = FRAME(); if (!frame) return;
    const max = frame.scrollHeight - frame.clientHeight;
    frame.scrollTop = max > 0 ? f * max : 0;
  }

  /* ─── Tutor: broadcast the Stage (DOM + scroll) on every change ─── */

  function startStageMirror() {
    stopStageMirror();
    const el = SLIDE(), frame = FRAME();
    if (el && window.MutationObserver) {
      // class/hidden = reveals + note toggles; childList = slide change. (Not
      // 'style' — the zoom-fit sets that and would fire needlessly.)
      mo = new MutationObserver(scheduleHtml);
      mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    }
    if (frame) frame.addEventListener('scroll', scheduleScroll);
    hb = setInterval(broadcastHtmlNow, 2000);   // heartbeat: late joiners catch up
    broadcastHtmlNow();
  }
  function stopStageMirror() {
    if (mo) { mo.disconnect(); mo = null; }
    if (hb) { clearInterval(hb); hb = null; }
    const frame = FRAME(); if (frame) frame.removeEventListener('scroll', scheduleScroll);
  }
  function scheduleHtml() { const t = perf(); if (t - htmlT < 120) return; htmlT = t; broadcastHtmlNow(); }
  function broadcastHtmlNow() {
    const el = SLIDE(); if (!el || !chan || typeof dataBroadcastHtml !== 'function') return;
    dataBroadcastHtml(chan, el.innerHTML);
    broadcastScrollNow();
  }
  function scheduleScroll() { const t = perf(); if (t - scrollT < 80) return; scrollT = t; broadcastScrollNow(); }
  function broadcastScrollNow() {
    const frame = FRAME(); if (!frame || !chan || typeof dataBroadcastScroll !== 'function') return;
    const max = frame.scrollHeight - frame.clientHeight;
    dataBroadcastScroll(chan, max > 0 ? frame.scrollTop / max : 0);
  }

  /* Share Screen — streams the tutor's actual screen to the student (Daily). */
  window.roomShareScreen = function () {
    if (!window.almituVideo) { if (typeof showToast === 'function') showToast('Video isn’t ready yet.', 'warn'); return; }
    if (almituVideo.sharing) almituVideo.stopShare(); else almituVideo.shareScreen();
  };

  /* Re-render the Stage — called by daily-video.js when a screen share ends. */
  window.roomRefreshStage = function () { roomRenderSlide(); if (role !== 'tutor') applyScroll(studentScrollF); };

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

  /* ─── Stage slide rendering (fill-width via zoom; scroll when tall) ─── */

  function slides() { return (plan && plan.slides) || []; }

  function roomRenderSlide() {
    const el = SLIDE();
    const frame = FRAME();
    const empty = document.getElementById('roomEmpty');
    if (!el) return;
    const list = slides();
    if (!list.length) {
      if (frame) frame.style.display = 'none';
      if (empty) {
        empty.hidden = false;
        empty.textContent = role === 'tutor' ? 'Loading your slides…' : 'Waiting for your tutor…';
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
    const frame = FRAME();
    const content = SLIDE();
    if (!stage || !frame || !content) return;
    content.style.zoom = '1';
    const w = content.offsetWidth, h = content.offsetHeight;
    if (!w || !h) return;
    const pad = stage.clientWidth < 520 ? 14 : 28;
    const availW = stage.clientWidth - pad * 2;
    const availH = stage.clientHeight - pad * 2;
    const k = Math.min(availW / w, 2.6);       // fill width; taller → scroll
    content.style.zoom = k;
    frame.style.width = availW + 'px';
    frame.style.height = availH + 'px';
    frame.style.justifyContent = (h * k <= availH) ? 'center' : 'flex-start';
  }

  window.roomNextSlide = function () {
    if (role !== 'tutor' || idx >= slides().length - 1) return;
    idx++; roomRenderSlide();   // innerHTML change → MutationObserver → mirror
  };
  window.roomPrevSlide = function () {
    if (role !== 'tutor' || idx <= 0) return;
    idx--; roomRenderSlide();
  };

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function perf() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
})();
