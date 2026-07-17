/* ═══════════════════════════════════════════════════════
   Almitu Pro — Shared UI Utilities
   ═══════════════════════════════════════════════════════ */

function updateProgress() {
  const s = getState();
  const pct = s.currentStep === 1 ? 33 : s.currentStep === 2 ? 66 : 100;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = pct + '%';
}

function showStep(n) {
  document.getElementById('step1').classList.toggle('hidden', n !== 1);
  document.getElementById('step2').classList.toggle('hidden', n !== 2);
  document.getElementById('step3').classList.toggle('hidden', n !== 3);
  getState().currentStep = n;
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/* Reset the tutor prep surface for a brand-new session (does not touch
   any stored data — sessions live in Supabase). */
function resetPrepForm() {
  if (window._timerInterval) clearInterval(window._timerInterval);
  const s = getState();
  s.generatedLessonPlan = null;
  s.generation = { fingerprint: null, stale: false };
  s.currentSlide = 0;
  s.previewSlide = 0;
  s.sessionDuration = 25;
  s.studentProfile = { name: '', language: 'Ukrainian', countryOfResident: '', level: 'A1', l1Support: true };

  const nameEl = document.getElementById('inputName'); if (nameEl) nameEl.value = '';
  const langEl = document.getElementById('inputLang'); if (langEl) langEl.value = 'Ukrainian';
  const countryEl = document.getElementById('inputCountry'); if (countryEl) countryEl.value = '';
  const levelEl = document.getElementById('inputLevel'); if (levelEl) levelEl.value = 'A1';
  if (typeof _autofillRecord !== 'undefined') _autofillRecord = null;

  setDuration(25);
  setL1Support(true);
  updateTierBadge();
  selectSessionType('vocabulary');

  document.getElementById('outputPlaceholder').classList.remove('hidden');
  document.getElementById('outputLoading').classList.add('hidden');
  document.getElementById('outputPlan').classList.add('hidden');
  setGenStatus('ready');
}
