/* ═══════════════════════════════════════════════════════
   Almitu Pro — Shared UI Utilities
   ═══════════════════════════════════════════════════════ */

/* Flip between light/dark and remember the choice. The pre-paint script in
   <head> applies the saved value on load; this just toggles + persists. */
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('almitu-theme', next); } catch (e) {}
}

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

/* ── Bidirectional (RTL) text support ──
   First-language content — Farsi, Pashto, Urdu, Arabic, Hebrew, Dari, … — is
   right-to-left. When such a sentence embeds an English word or phrase, the
   browser needs the correct BASE direction or the whole line reorders and
   becomes unreadable (this is what broke L1 support). textDir() reads the base
   direction from the content; bidiText() escapes a string and wraps it in a
   <bdi> with that direction, so mixed RTL/LTR renders correctly and stays
   isolated from whatever surrounds it. Use bidiText() as a drop-in for
   escapeHtml() anywhere first-language or free model text is shown. */
const RTL_CHAR_RE = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
function textDir(text) {
  return RTL_CHAR_RE.test(text == null ? '' : String(text)) ? 'rtl' : 'auto';
}
function bidiText(text) {
  const s = text == null ? '' : String(text);
  return `<bdi dir="${textDir(s)}">${escapeHtml(s)}</bdi>`;
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
  const errEl = document.getElementById('outputError');
  if (errEl) errEl.classList.add('hidden');
  setGenStatus('ready');
}
