/* ═══════════════════════════════════════════════════════
   Almitu Pro — Step 2: Live Session & Slide Viewer
   Layout: 2/3 slide deck | 1/3 timer + tutor notes.
   (Chat and the tutor/student video tiles were removed — the call
   itself runs on Google Meet; this workspace drives the slides and
   captures the tutor's notes/assignments for the student.)
   ═══════════════════════════════════════════════════════ */

function launchCall() {
  const s = getState();
  s.currentSlide = 0;
  showStep(2);

  const student = (window.tutorState && tutorState.selectedStudent) || null;
  const name = (student && student.full_name) || s.studentProfile.name || 'Student';
  document.getElementById('studentAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('studentVidName').textContent = name;

  const notesEl = document.getElementById('tutorNotes');
  if (notesEl) notesEl.value = '';
  const saveState = document.getElementById('notesSaveState');
  if (saveState) saveState.textContent = '';

  // Each session starts with a fresh Meet link box.
  if (window.tutorState) tutorState.currentMeetLink = null;
  if (typeof renderMeetLinkBox === 'function') renderMeetLinkBox();

  renderSlideViewer();
  startTimer();

  // Generate post-session practice in the background during the live call so
  // it's ready the moment the session is saved to the student's dashboard.
  kickoffPracticeBank();

  // Reset the prep surface so the next session starts clean.
  clearPrepArea();
}

/* ─── Deferred post-session practice generation ─── */

function kickoffPracticeBank() {
  const plan = getState().generatedLessonPlan;
  if (!plan || plan.practiceReady) return Promise.resolve();
  if (plan.practiceGenerating && plan._practicePromise) return plan._practicePromise;
  plan.practiceGenerating = true;
  plan._practicePromise = (async () => {
    try {
      plan.content.practice_bank = await generatePracticeBank(plan.formData, plan.slides);
    } catch (e) {
      console.error('practice bank generation failed:', e);
      plan.content.practice_bank = demoPracticeBank(plan.formData);
    } finally {
      plan.practiceReady = true;
      plan.practiceGenerating = false;
    }
  })();
  return plan._practicePromise;
}

function ensurePracticeBank() {
  const plan = getState().generatedLessonPlan;
  if (!plan || plan.practiceReady) return Promise.resolve();
  if (plan.practiceGenerating && plan._practicePromise) return plan._practicePromise;
  return kickoffPracticeBank();
}

/* ─── Slide Viewer ─── */

function renderSlideViewer() {
  const s = getState();
  const plan = s.generatedLessonPlan;
  if (!plan) return;
  const slides = plan.slides;
  const idx = s.currentSlide;
  const slide = slides[idx];

  document.getElementById('slideContent').innerHTML = slide.html;
  document.getElementById('slideLabel').textContent = `${slide.icon} ${slide.label}`;
  document.getElementById('slideCounter').textContent = `${idx + 1} / ${slides.length}`;
  document.getElementById('slidePrev').disabled = idx === 0;
  document.getElementById('slideNext').disabled = idx === slides.length - 1;

  document.getElementById('slideDots').innerHTML = slides.map((sl, i) =>
    `<button onclick="goToSlide(${i})" class="slide-dot ${i === idx ? 'active' : ''}" title="${escapeHtml(sl.label)}"></button>`).join('');

  if (window._presentActive) renderPresentation();
}

function nextSlide() {
  const s = getState();
  if (s.currentSlide < s.generatedLessonPlan.slides.length - 1) { s.currentSlide++; renderSlideViewer(); }
}
function prevSlide() {
  const s = getState();
  if (s.currentSlide > 0) { s.currentSlide--; renderSlideViewer(); }
}
function goToSlide(i) { getState().currentSlide = i; renderSlideViewer(); }

/* ─── Timer ─── */

function startTimer() {
  window._timerSeconds = getState().sessionDuration * 60;
  updateTimerDisplay();
  if (window._timerInterval) clearInterval(window._timerInterval);
  window._timerInterval = setInterval(() => {
    window._timerSeconds--;
    if (window._timerSeconds <= 0) { clearInterval(window._timerInterval); window._timerSeconds = 0; }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(window._timerSeconds / 60);
  const sec = window._timerSeconds % 60;
  const text = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  const color = window._timerSeconds < 60 ? '#EF4444' : 'var(--navy)';
  const el = document.getElementById('timer');
  if (el) { el.textContent = text; el.style.color = color; }
  // Mirror onto the presentation-mode corner timer.
  const pel = document.getElementById('presentTimer');
  if (pel) { pel.textContent = text; pel.style.color = color; }
}

/* ─── Tutor notes (replaces chat) ─── */

function onNotesInput() {
  const el = document.getElementById('notesSaveState');
  if (el) el.textContent = 'Draft — saved when you end the session';
}

/* ─── End Session & Compile → save to Supabase ─── */

function endSession() {
  if (activeContext().readOnly) { showToast('Read-only view — cannot save sessions.', 'warn'); return; }
  if (window._timerInterval) clearInterval(window._timerInterval);
  const overlay = document.getElementById('compileOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('compileDone').classList.add('hidden');

  ['cs1', 'cs2', 'cs3', 'cs4'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('text-green-600'); el.classList.add('text-gray-400');
    el.querySelector('span').textContent = '';
  });
  ['cs1', 'cs2', 'cs3', 'cs4'].forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      el.classList.remove('text-gray-400'); el.classList.add('text-green-600');
      el.querySelector('span').textContent = '✓';
    }, 500 + i * 600);
  });

  setTimeout(async () => {
    const s = getState();
    const plan = s.generatedLessonPlan;
    const student = (window.tutorState && tutorState.selectedStudent) || null;
    const notes = (document.getElementById('tutorNotes') || {}).value || '';

    try {
      // Ensure the deferred post-session practice has finished before archiving.
      await ensurePracticeBank();
      const planClone = JSON.parse(JSON.stringify({ ...plan, _practicePromise: undefined }));
      const row = buildSessionRow(planClone, student, 'completed', notes);

      // startSession() already created the 'live' row — complete that one so we
      // don't leave a stray live session behind or duplicate the history.
      if (tutorState.currentSessionId) await dataUpdateSession(tutorState.currentSessionId, row);
      else await dataCreateSession(row);
      tutorState.currentSessionId = null;
      tutorState.currentMeetLink = null;

      document.getElementById('compileDone').classList.remove('hidden');
      setTimeout(async () => {
        overlay.classList.add('hidden');
        showToast('Session saved to ' + ((student && student.full_name) || 'the student') + "'s dashboard.", 'success');
        await initTutorDashboard();   // back to the tutor home, refreshed
      }, 1200);
    } catch (e) {
      overlay.classList.add('hidden');
      showToast('Could not save the session: ' + e.message, 'error');
    }
  }, 3000);
}

/* ─── Presentation Mode ───
   A full-screen, large-type view of ONLY the slide content, so a tutor can
   screen-share a readable slide (incl. to students on mobile). Reuses the
   same slide HTML, currentSlide state and timer — nothing is duplicated. */

function renderPresentation() {
  const s = getState();
  const plan = s.generatedLessonPlan;
  if (!plan || !plan.slides) return;
  const slides = plan.slides;
  const idx = s.currentSlide;
  const slide = slides[idx];

  document.getElementById('presentSlide').innerHTML = slide.html;
  document.getElementById('presentLabel').textContent = slide.label || '';
  document.getElementById('presentCounter').textContent = `${idx + 1} / ${slides.length}`;
  document.getElementById('presentPrev').disabled = idx === 0;
  document.getElementById('presentNext').disabled = idx === slides.length - 1;
  document.getElementById('presentDots').innerHTML = slides.map((sl, i) =>
    `<button onclick="goToSlide(${i})" class="slide-dot ${i === idx ? 'active' : ''}" title="${escapeHtml(sl.label)}"></button>`).join('');

  fitPresent();                      // synchronous (offsetWidth forces layout)
  requestAnimationFrame(fitPresent); // refine after paint / web-font settle
  setTimeout(fitPresent, 60);        // settle fallback if rAF is throttled
}

/* Fit a slide into a FIXED frame (identical size on every slide, filling the
   stage). The content is zoom-scaled to fit inside that frame, within a readable
   band [MIN, MAX]:
     - fits at a readable size  → scale up to fit and CENTER it, no scroll
     - too long to fit at MIN   → hold MIN and SCROLL inside the frame
   So short slides never scroll and only genuinely lengthy slides do. `zoom`
   scales layout (unlike transform), so the frame scrolls naturally. */
const PRESENT_MIN_ZOOM = 1.2;   // (unused with fill-width fit; kept for reference)
const PRESENT_MAX_ZOOM = 2.4;   // cap so text stays sane on very wide screens
function fitPresent() {
  const stage = document.getElementById('presentStage');
  const frame = document.getElementById('presentScaler');
  const content = document.getElementById('presentSlide');
  if (!stage || !frame || !content) return;
  // Measure the content at natural size (zoom 1). Its width is fixed at 760px.
  content.style.zoom = '1';
  const w = content.offsetWidth, h = content.offsetHeight;
  if (!w || !h) return;
  const availW = stage.clientWidth - 56;   // stage padding + slack
  const availH = stage.clientHeight - 56;
  const PADX = 48, PADY = 40;              // must match .present-scaler padding
  const innerW = availW - 2 * PADX;
  const innerH = availH - 2 * PADY;
  // Fill the frame's WIDTH so the content optimizes the whole card (single
  // surface, no inner-box look). Taller-than-frame content scrolls inside.
  let k = Math.min(innerW / w, PRESENT_MAX_ZOOM);
  content.style.zoom = k;
  // Fixed frame — same on every slide.
  frame.style.width = availW + 'px';
  frame.style.height = availH + 'px';
  // Center vertically when it fits; top-align + scroll when it overflows.
  frame.style.justifyContent = (h * k <= innerH) ? 'center' : 'flex-start';
  stage.style.alignItems = 'center';
  updatePresentFade();
}

/* Show the bottom "more below" fade only while the frame can still scroll down. */
function updatePresentFade() {
  const stage = document.getElementById('presentStage');
  const frame = document.getElementById('presentScaler');
  if (!stage || !frame) return;
  const more = (frame.scrollHeight - frame.clientHeight - frame.scrollTop) > 4;
  stage.classList.toggle('can-scroll-down', more);
}

function enterPresentation() {
  const plan = getState().generatedLessonPlan;
  if (!plan || !plan.slides || !plan.slides.length) { showToast('Generate a session first.', 'warn'); return; }
  const el = document.getElementById('presentMode');
  // Reparent to <body> so it can never be hidden by an ancestor's display:none
  // or trapped in a transformed stacking context.
  if (el.parentElement !== document.body) document.body.appendChild(el);
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window._presentActive = true;
  window.addEventListener('keydown', presentKeydown);
  document.getElementById('presentScaler').addEventListener('scroll', updatePresentFade);
  document.addEventListener('fullscreenchange', onPresentFsChange);
  // Refit whenever the stage changes size (initial layout settle, window resize,
  // fullscreen enter/exit) — more reliable than a one-off resize listener.
  if (window.ResizeObserver) {
    window._presentRO = new ResizeObserver(() => fitPresent());
    window._presentRO.observe(document.getElementById('presentStage'));
  } else {
    window.addEventListener('resize', fitPresent);
  }
  renderPresentation();
  updateTimerDisplay();
  presentRequestFullscreen(el);
}

function exitPresentation() {
  const el = document.getElementById('presentMode');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  window._presentActive = false;
  window.removeEventListener('keydown', presentKeydown);
  window.removeEventListener('resize', fitPresent);
  const pf = document.getElementById('presentScaler');
  if (pf) pf.removeEventListener('scroll', updatePresentFade);
  document.removeEventListener('fullscreenchange', onPresentFsChange);
  if (window._presentRO) { window._presentRO.disconnect(); window._presentRO = null; }
  presentExitFullscreen();
}

function presentKeydown(e) {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextSlide(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevSlide(); }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); togglePresentFullscreen(); }
  else if (e.key === 'Escape') { if (!document.fullscreenElement) exitPresentation(); } // in fullscreen, let the browser exit that first
}

function onPresentFsChange() { requestAnimationFrame(fitPresent); }

function presentRequestFullscreen(el) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
}
function presentExitFullscreen() {
  if (document.fullscreenElement) {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) {} }
  }
}
function togglePresentFullscreen() {
  if (document.fullscreenElement) presentExitFullscreen();
  else presentRequestFullscreen(document.getElementById('presentMode'));
}
