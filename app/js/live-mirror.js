/* ═══════════════════════════════════════════════════════
   Live synced slides — STUDENT side (Model A: full mirror)

   While the tutor is presenting, the student sees the SAME slide, scrolled to
   the same spot, drawn natively on their own device — crisp on a phone, and
   almost no bandwidth (the slide HTML already came down with the session; only
   "which slide" + "how far scrolled" travel live). The student never drives
   navigation: which slide and scroll are pushed by the tutor.

   Driven by syncStudentMirror(live), called from refreshStudentLive() on every
   student poll with the live session row (or null when nothing is live).
     • present_active / current_slide → Realtime postgres_changes (durable)
     • scroll fraction                → Realtime broadcast (ephemeral)
   Slide rendering reuses the same fill-width fit as the tutor's Present mode.
   ═══════════════════════════════════════════════════════ */

(function () {
  let sub = null;            // the per-session realtime channel
  let subSessionId = null;   // which session we're currently mirrored to
  let slides = null;         // slide array captured from the session plan
  let curIdx = 0;
  let mirrorRO = null;       // ResizeObserver that refits on layout changes
  let ptr = { fx: 0, fy: 0, on: false };   // last laser-pointer position (content fractions)

  /* Public entry — called each poll with the live session (or null). */
  window.syncStudentMirror = function (live) {
    if (!live || !live.id) { closeMirror(); return; }

    // First sight of this session → subscribe and capture its slides. The plan
    // (and thus the slide HTML) doesn't change mid-session, so caching is safe.
    if (subSessionId !== live.id) {
      closeMirror();
      subSessionId = live.id;
      slides = (live.plan && live.plan.slides) || null;
      sub = dataOpenLiveChannel(live.id, { onState: onState, onScroll: onScroll, onPointer: onPointer });
    }
    // Reflect the row's current state immediately — this is what lets a student
    // who loads mid-lesson land straight on the slide the tutor is showing.
    applyState(live.present_active, live.current_slide);
  };

  function onState(row) { applyState(row.present_active, row.current_slide); }

  function applyState(active, idx) {
    if (!active || !slides || !slides.length) { hideOverlay(); return; }
    const el = document.getElementById('mirrorMode');
    if (!el) return;
    const next = Math.max(0, Math.min(idx | 0, slides.length - 1));
    const slideChanged = next !== curIdx || el.classList.contains('hidden');
    curIdx = next;
    showOverlay();
    if (slideChanged) renderMirror();
  }

  function onScroll(payload) {
    const f = clamp01(payload && typeof payload.f === 'number' ? payload.f : 0);
    const frame = document.getElementById('mirrorScaler');
    if (!frame) return;
    const max = frame.scrollHeight - frame.clientHeight;
    frame.scrollTop = max > 0 ? f * max : 0;
    updateMirrorFade();
    placePointer();   // the dot is in viewport coords, so it must follow the scroll
  }

  /* Laser pointer: place a glowing dot at the tutor's cursor position. Coords
     arrive as fractions of the slide content, so they map onto our own (smaller)
     rendering. Held at the last spot until the tutor moves or { on:false }. */
  function onPointer(payload) {
    if (!payload || !payload.on) { ptr.on = false; placePointer(); return; }
    ptr = { fx: clamp01(payload.x), fy: clamp01(payload.y), on: true };
    placePointer();
  }

  function placePointer() {
    const dot = document.getElementById('mirrorPointer');
    const content = document.getElementById('mirrorSlide');
    if (!dot) return;
    if (!ptr.on || !content) { dot.style.opacity = '0'; return; }
    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { dot.style.opacity = '0'; return; }
    dot.style.left = (rect.left + ptr.fx * rect.width) + 'px';
    dot.style.top = (rect.top + ptr.fy * rect.height) + 'px';
    dot.style.opacity = '1';
  }

  function renderMirror() {
    if (!slides) return;
    const slide = slides[curIdx];
    const el = document.getElementById('mirrorSlide');
    if (!el || !slide) return;
    ptr.on = false;                     // new slide → drop the old pointer spot
    placePointer();
    el.innerHTML = slide.html;
    const label = document.getElementById('mirrorLabel');
    if (label) label.textContent = slide.label || '';
    fitMirror();
    requestAnimationFrame(fitMirror);
    setTimeout(fitMirror, 60);
  }

  /* Same fill-width fit as the tutor's fitPresent(), against the mirror ids:
     scale the fixed-width slide to fill the stage, center if it fits, scroll if
     it's taller. Kept as its own copy so it can't collide with tutor state. */
  function fitMirror() {
    const stage = document.getElementById('mirrorStage');
    const frame = document.getElementById('mirrorScaler');
    const content = document.getElementById('mirrorSlide');
    if (!stage || !frame || !content) return;
    content.style.zoom = '1';
    const w = content.offsetWidth, h = content.offsetHeight;
    if (!w || !h) return;
    const availW = stage.clientWidth - 56;
    const availH = stage.clientHeight - 56;
    const PADX = 48, PADY = 40;
    const innerW = availW - 2 * PADX;
    const innerH = availH - 2 * PADY;
    const k = Math.min(innerW / w, 2.4);          // matches PRESENT_MAX_ZOOM
    content.style.zoom = k;
    frame.style.width = availW + 'px';
    frame.style.height = availH + 'px';
    frame.style.justifyContent = (h * k <= innerH) ? 'center' : 'flex-start';
    stage.style.alignItems = 'center';
    updateMirrorFade();
    placePointer();   // keep the dot glued to its word when the layout refits
  }

  function updateMirrorFade() {
    const stage = document.getElementById('mirrorStage');
    const frame = document.getElementById('mirrorScaler');
    if (!stage || !frame) return;
    const more = (frame.scrollHeight - frame.clientHeight - frame.scrollTop) > 4;
    stage.classList.toggle('can-scroll-down', more);
  }

  function showOverlay() {
    const el = document.getElementById('mirrorMode');
    if (!el || !el.classList.contains('hidden')) return;   // already visible
    if (el.parentElement !== document.body) document.body.appendChild(el);
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.ResizeObserver) {
      mirrorRO = new ResizeObserver(() => fitMirror());
      mirrorRO.observe(document.getElementById('mirrorStage'));
    } else {
      window.addEventListener('resize', fitMirror);
    }
  }

  function hideOverlay() {
    const el = document.getElementById('mirrorMode');
    if (!el || el.classList.contains('hidden')) return;    // already hidden
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    ptr.on = false;
    placePointer();
    if (mirrorRO) { mirrorRO.disconnect(); mirrorRO = null; }
    window.removeEventListener('resize', fitMirror);
  }

  /* Full teardown — session ended or student left the dashboard. */
  function closeMirror() {
    hideOverlay();
    if (sub) { dataUnsubscribe(sub); sub = null; }
    subSessionId = null;
    slides = null;
    curIdx = 0;
  }

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
})();
