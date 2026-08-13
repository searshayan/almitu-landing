/* ═══════════════════════════════════════════════════════
   Virtual Classroom — Phase 1 shell

   A unified live room: a framed content panel (native slides, transform-fit)
   on the left, a video column on the right (placeholder tiles until Phase 3
   wires the Zoom Video SDK), and one control bar. This file is the SHELL +
   slide rendering only. Later phases add: the realtime "● Shared" sync so the
   student mirrors the tutor, Library-loading, chat, Leave→compile, the mobile
   Video/Slides flip, and the real video tiles.

   Open with classroomEnter(plan, 'tutor'|'student'); close with classroomLeave().
   ═══════════════════════════════════════════════════════ */

(function () {
  let plan = null;      // the loaded deck (a session/curriculum plan with .slides)
  let idx = 0;          // current slide index
  let role = 'tutor';   // 'tutor' drives; 'student' is view-only
  let ro = null;        // ResizeObserver that refits on layout change

  /* Enter the room with a deck already chosen. */
  window.classroomEnter = function (loadedPlan, asRole) {
    plan = loadedPlan || null;
    role = asRole === 'student' ? 'student' : 'tutor';
    idx = 0;
    const v = document.getElementById('viewClassroom');
    if (!v) return;
    v.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // The tutor drives navigation; the student never sees the nav (Model A).
    const nav = document.getElementById('roomNav');
    if (nav) nav.style.display = role === 'tutor' ? '' : 'none';
    roomRenderSlide();
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => fitRoomSlide());
      const st = document.getElementById('roomStage');
      if (st) ro.observe(st);
    }
    window.addEventListener('resize', fitRoomSlide);
  };

  /* Close the room. Phase 2 will also end the call + run the compile-lesson flow. */
  window.classroomLeave = function () {
    const v = document.getElementById('viewClassroom');
    if (v) v.classList.add('hidden');
    document.body.style.overflow = '';
    if (ro) { ro.disconnect(); ro = null; }
    window.removeEventListener('resize', fitRoomSlide);
  };

  function slides() { return (plan && plan.slides) || []; }

  function roomRenderSlide() {
    const list = slides();
    if (!list.length) return;
    idx = Math.max(0, Math.min(idx, list.length - 1));
    const el = document.getElementById('roomSlide');
    if (!el) return;
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

  /* transform:scale contain-fit — the same iOS-safe approach as the student
     mirror: scale the whole 760px slide to fit the panel, size the frame to
     match, so the entire slide is visible and crisp. */
  function fitRoomSlide() {
    const stage = document.getElementById('roomStage');
    const frame = document.getElementById('roomFrame');
    const content = document.getElementById('roomSlide');
    if (!stage || !frame || !content) return;
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

  /* Tutor-only navigation (Phase 2 broadcasts these to the student). */
  window.roomNextSlide = function () { if (role !== 'tutor') return; idx++; roomRenderSlide(); };
  window.roomPrevSlide = function () { if (role !== 'tutor') return; idx--; roomRenderSlide(); };
})();
