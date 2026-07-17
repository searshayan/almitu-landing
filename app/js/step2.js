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
  const el = document.getElementById('timer');
  el.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  el.style.color = window._timerSeconds < 60 ? '#EF4444' : 'var(--navy)';
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

      if (tutorState.editingSessionId) await dataUpdateSession(tutorState.editingSessionId, row);
      else await dataCreateSession(row);
      tutorState.editingSessionId = null;

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
