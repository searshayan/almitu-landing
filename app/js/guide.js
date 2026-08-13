/* ═══════════════════════════════════════════════════════
   Almitu — "How it works" guide
   A role-aware onboarding guide opened on demand from the header button.
   Big picture first, then A→Z steps;
   each step can spotlight the REAL element live on the dashboard ("Show me"),
   so there are no static screenshots to keep up to date.
   ═══════════════════════════════════════════════════════ */

const GUIDE_CONTENT = {
  tutor: {
    label: 'Tutor',
    heading: 'How Almitu works — for tutors',
    big: 'Build a lesson once → teach it live over any video call → Almitu turns it into practice on your student’s dashboard. Every plan is reusable with any student.',
    flow: ['Generate a session', 'Teach live', 'Auto-practice for the student', 'Reuse the plan'],
    steps: [
      { icon: '📚', title: 'Your session library', target: '[data-guide="tutor-plans"]',
        body: 'Every session you generate is saved here. Reuse any plan with any student, as many times as you like — reusing costs nothing to generate.' },
      { icon: '🧑‍🎓', title: 'Your students', target: '[data-guide="tutor-students"]',
        body: 'Students assigned to you show up here. You pick one when you start a session, so their practice lands on the right dashboard.' },
      { icon: '✨', title: 'Generate a new session', target: '[data-guide="tutor-generate"]',
        body: 'Choose the student, language, level and session type, then use <b>Autofill</b> to fill the rest from your topic. Hit <b>Generate</b> and Almitu builds a ready-to-teach slide deck calibrated to the level.' },
      { icon: '📝', title: 'Review &amp; edit the deck',
        body: 'Flip through the generated slides and edit any text in place. When it looks right, <b>Save to My Plans</b> for reuse, or <b>Start the Session</b> to teach now.' },
      { icon: '▶️', title: 'Start &amp; teach live',
        body: 'Starting opens a full-screen <b>Present</b> mode for screen-sharing. Start a call in your video tool (Google Meet, Zoom, WhatsApp…), paste the link so your student can join, then teach using the slides, the timer, and the notes panel.' },
      { icon: '💾', title: 'End &amp; compile',
        body: 'Tap <b>End Session</b> when you’re done. Almitu saves your notes and automatically builds the practice activities (flashcards, quiz, and more) onto your student’s dashboard.' }
    ]
  },
  student: {
    label: 'Student',
    heading: 'How Almitu works — for students',
    big: 'After each live lesson with your tutor, Almitu builds personalized practice from that exact session — review it and practice any time.',
    flow: ['Join the live session', 'Learn with your tutor', 'Practice afterwards', 'Track progress'],
    steps: [
      { icon: '🟢', title: 'Join your live session', target: '#studentLiveBanner',
        body: 'When your tutor starts a session, a green “Your tutor is live” banner appears at the top — tap <b>Join</b> to open the call your tutor shared.' },
      { icon: '📒', title: 'Your sessions', target: '.sv-notebook-list',
        body: 'Every lesson your tutor teaches is saved here as a session. Tap one to open it.' },
      { icon: '🎯', title: 'Open a session',
        body: 'Opening a session shows its <b>objective</b> — what you practiced — followed by all the activities built from that lesson.' },
      { icon: '🃏', title: 'Practice activities', target: '.sv-activity-tiles',
        body: 'Overview, Flashcards, Quiz, Reorder, Gap Fill and Matching — each one is generated from your own session, so you practice exactly what you learned.' },
      { icon: '🌐', title: 'First-language help',
        body: 'If your tutor turned on first-language support, activities show hints and explanations in your language to make new words easier to grasp.' },
      { icon: '⚡', title: 'Track your progress', target: '#studentXpBadge',
        body: 'Your XP and weekly practice time show how much you’ve practiced — a little every day adds up fast.' }
    ]
  }
};

let _guideRole = 'tutor';

function _guideActiveRole() {
  const r = (typeof activeContext === 'function' && activeContext().role) || 'tutor';
  return r === 'student' ? 'student' : 'tutor';   // admins default to the tutor guide
}

function openGuide(role) {
  _guideRole = role || _guideActiveRole();
  let panel = document.getElementById('guidePanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'guidePanel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = _guidePanelHtml(_guideRole);
  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('guide-open'));
  document.body.style.overflow = 'hidden';
}

function switchGuideRole(role) { openGuide(role); }

function closeGuide() {
  const panel = document.getElementById('guidePanel');
  if (panel) { panel.classList.remove('guide-open'); setTimeout(() => panel.classList.add('hidden'), 200); }
  guideSpotClose();
  document.body.style.overflow = '';
}

function _guidePanelHtml(role) {
  const g = GUIDE_CONTENT[role];
  const onDash = (role === _guideActiveRole());   // "Show me" only works on your own live dashboard
  const tab = (key) => `<button onclick="switchGuideRole('${key}')" class="guide-tab ${key === role ? 'active' : ''}">${GUIDE_CONTENT[key].label}</button>`;
  const flow = g.flow.map((f, i) =>
    `<div class="guide-flow-step"><span class="guide-flow-dot">${i + 1}</span><span>${f}</span></div>`
  ).join('<span class="guide-flow-arrow">→</span>');
  const steps = g.steps.map((s, i) => `
    <div class="guide-step">
      <div class="guide-step-num">${s.icon || (i + 1)}</div>
      <div class="guide-step-body">
        <h4>${s.title}</h4>
        <p>${s.body}</p>
        ${s.target && onDash ? `<button class="guide-showme" onclick="guideShowStep(${i})">Show me on my dashboard →</button>` : ''}
      </div>
    </div>`).join('');
  return `
    <div class="guide-backdrop" onclick="closeGuide()"></div>
    <div class="guide-card" role="dialog" aria-label="How Almitu works">
      <div class="guide-head">
        <div class="guide-tabs">${tab('tutor')}${tab('student')}</div>
        <button class="guide-x" aria-label="Close" onclick="closeGuide()">✕</button>
      </div>
      <div class="guide-scroll">
        <h3 class="guide-title">${g.heading}</h3>
        <div class="guide-big"><span class="guide-big-icon">💡</span><p>${g.big}</p></div>
        <div class="guide-flow">${flow}</div>
        <p class="guide-section-label">Step by step</p>
        ${steps}
      </div>
      <div class="guide-foot">
        <span style="color:var(--muted); font-size:12px;">You can reopen this any time from <b>How it works</b> in the top bar.</span>
        <button class="guide-done" onclick="closeGuide()">Got it</button>
      </div>
    </div>`;
}

/* ── Spotlight a real element ── */
/* Called from the panel with the step index (avoids quoting a selector inside
   an HTML onclick attribute). */
function guideShowStep(i) {
  const s = (GUIDE_CONTENT[_guideRole].steps || [])[i];
  if (s && s.target) guideShowMe(s.target, s.title);
}

let _guideSpotTarget = null;
let _guideSpotReposition = null;

function guideShowMe(sel, title) {
  const el = document.querySelector(sel);
  if (!el || el.offsetParent === null) {
    if (typeof showToast === 'function') showToast('That part appears on your dashboard when it’s available.', 'info');
    return;
  }
  // Hide the panel so the highlighted element is visible.
  const panel = document.getElementById('guidePanel');
  if (panel) panel.classList.remove('guide-open');

  let spot = document.getElementById('guideSpot');
  if (!spot) {
    spot = document.createElement('div');
    spot.id = 'guideSpot';
    spot.innerHTML = '<div class="guide-spot-hole"></div><div class="guide-spot-callout"></div>';
    document.body.appendChild(spot);
  }
  spot.classList.remove('hidden');
  _guideSpotTarget = el;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const callout = spot.querySelector('.guide-spot-callout');
  callout.innerHTML = `
    <p class="guide-spot-title">${title || ''}</p>
    <p class="guide-spot-hint">This is the part on your dashboard.</p>
    <div class="guide-spot-actions">
      <button class="guide-spot-back" onclick="guideSpotClose(); openGuide('${_guideRole}')">← Back to guide</button>
      <button class="guide-spot-done" onclick="guideSpotClose()">Done</button>
    </div>`;

  const place = () => _guidePlaceSpot(spot, _guideSpotTarget);
  _guideSpotReposition = place;
  requestAnimationFrame(place);   // measure after a layout flush (not mid-open)
  setTimeout(place, 350);         // re-place after the smooth scroll settles
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
}

function _guidePlaceSpot(spot, el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const pad = 8;
  const hole = spot.querySelector('.guide-spot-hole');
  hole.style.top = (r.top - pad) + 'px';
  hole.style.left = (r.left - pad) + 'px';
  hole.style.width = (r.width + pad * 2) + 'px';
  hole.style.height = (r.height + pad * 2) + 'px';
  // Callout below the element if there's room, else above.
  const callout = spot.querySelector('.guide-spot-callout');
  const below = r.bottom + 12;
  const spaceBelow = window.innerHeight - r.bottom;
  callout.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 340)) + 'px';
  if (spaceBelow > 180) { callout.style.top = below + 'px'; callout.style.bottom = 'auto'; }
  else { callout.style.bottom = (window.innerHeight - r.top + 12) + 'px'; callout.style.top = 'auto'; }
}

function guideSpotClose() {
  const spot = document.getElementById('guideSpot');
  if (spot) spot.classList.add('hidden');
  if (_guideSpotReposition) {
    window.removeEventListener('resize', _guideSpotReposition);
    window.removeEventListener('scroll', _guideSpotReposition, true);
    _guideSpotReposition = null;
  }
  _guideSpotTarget = null;
}
