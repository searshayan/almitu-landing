/* ═══════════════════════════════════════════════════════
   Almitu Pro — Step 3: Student Dashboard
   5 post-session activities generated from the session's
   practice_bank. Every right/wrong answer gets an
   explanation: L1 for Foundation tier, English for
   Development & Proficiency. Imperfect scores offer
   "Try Again"; "Challenge Practice" loads a harder variant.
   ═══════════════════════════════════════════════════════ */

/* Practice is bound to the SELECTED session (Feedback 2), not the latest globally.
   Falls back to the most recent session only when nothing is selected yet. */
function getActiveNotebook() {
  const s = getState();
  return s.savedNotebooks.find(n => n.id === s.selectedNotebookId) || s.savedNotebooks[0] || null;
}

function getBank(nb) {
  const pb = nb?.plan?.content?.practice_bank;
  return {
    items: (pb?.items || []).filter(i => i.term),
    sentences: (pb?.sentences || []).filter(Boolean)
  };
}

function showPracticeContent(html) {
  document.getElementById('practiceEmpty').classList.add('hidden');
  const content = document.getElementById('practiceContent');
  content.innerHTML = html;
  content.classList.remove('hidden');
  scrollActivityIntoView();   // mobile: bring the activity content into view after a tile tap
}

/* ── Mobile: per-session detail (master → detail) ──
   Below the lg breakpoint the dashboard stacks, so we split it into a list of
   sessions and a per-session detail page — objective on top, the activity tiles
   below it, and the activity area under those — driven by data-mview on #step3
   and styled in main.css. Tapping a tile renders its activity below the tiles
   and scrolls to it, so the content is never left below the fold. Desktop keeps
   its side-by-side layout untouched. */
let _svScrollY = 0;
function _svIsMobile() { return window.matchMedia('(max-width: 1023px)').matches; }
function _svReduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

function svEnterDetail() {
  const step3 = document.getElementById('step3');
  if (!step3) return;
  if (_svIsMobile() && step3.getAttribute('data-mview') !== 'detail') _svScrollY = window.scrollY;   // remember list position
  step3.setAttribute('data-mview', 'detail');
  if (_svIsMobile()) window.scrollTo({ top: 0, behavior: _svReduceMotion() ? 'auto' : 'smooth' });   // land on the objective
}

function svExitDetail() {
  const step3 = document.getElementById('step3');
  // Leaving the objective panel: hide it so desktop "Close" still works too.
  const exp = document.getElementById('notebookExpanded');
  if (exp) exp.classList.add('hidden');
  if (step3) step3.setAttribute('data-mview', 'list');
  if (_svIsMobile()) window.scrollTo({ top: _svScrollY || 0, behavior: 'auto' });   // restore list position
}

/* Reset the activity area to its empty "pick an activity" prompt. */
function resetActivityArea() {
  const pc = document.getElementById('practiceContent');
  if (pc) { pc.innerHTML = ''; pc.classList.add('hidden'); }
  const pe = document.getElementById('practiceEmpty');
  if (pe) pe.classList.remove('hidden');
}

/* Mobile: after a tile renders its activity, scroll the activity card into view
   (it sits below the objective + tiles, so it would otherwise be below the fold). */
function scrollActivityIntoView() {
  if (!_svIsMobile()) return;
  const el = document.querySelector('#step3 .sv-activity-detail') || document.getElementById('practiceContent');
  if (el) el.scrollIntoView({ behavior: _svReduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function activityHeader(emoji, title, sub, challenge) {
  return `
    <div class="mb-4">
      <h3 class="text-lg font-bold font-display flex items-center gap-2" style="color:var(--navy);">
        <span class="text-xl">${emoji}</span> ${escapeHtml(title)}
        ${challenge ? '<span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide" style="background:rgba(124,58,246,.1); color:#7C3AED; border:1px solid rgba(124,58,246,.25);">⚡ Challenge</span>' : ''}
      </h3>
      <p class="text-xs mt-1" style="color:var(--muted);">${escapeHtml(sub)}</p>
    </div>`;
}

function requireNotebook() {
  const nb = getActiveNotebook();
  if (!nb) { showToast('Complete a session first — activities are generated from session data.', 'warn'); return null; }
  return nb;
}

/* ── Answer explanations: L1 for Foundation *with L1 support*, English otherwise ── */

function explainAnswer(nb, item) {
  if (!item) return '';
  const tier = nb.plan.meta.tier;
  // L1 explanations only make sense when the session was generated WITH L1
  // support — otherwise there is no first language to explain in, and the old
  // fallback rendered a broken `": word — meaning"`. Pre-generated curriculum
  // sessions are always L1-off (tutors deliver L1 live), so they land here.
  const l1On = !!(nb.student && nb.student.l1Support);
  let text, icon;
  if (tier === 'foundation' && l1On) {
    text = item.l1_explanation || `${nb.student.language}: "${item.term}" — ${item.meaning}`;
    icon = '🌐';
  } else {
    text = item.explanation || `"${item.term}" means ${item.meaning}.${item.example ? ' Example: "' + item.example + '"' : ''}`;
    icon = '💡';
  }
  return `<div class="expl">${icon} ${bidiText(text)}</div>`;
}

/* ── Try Again / Challenge Practice buttons ── */

function completionButtons(fnName, perfect) {
  return `
    <div class="flex justify-center flex-wrap gap-2 mt-3">
      ${perfect ? '' : `<button onclick="${fnName}(false)" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:var(--primary);">🔄 Try Again</button>`}
      <button onclick="${fnName}(true)" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:#7C3AED;">⚡ Challenge Practice</button>
    </div>`;
}

/* ─── Notebook list & raw data ─── */

/* Which student is currently being practiced (derived from the selected session). */
function currentPracticeStudentId() {
  const s = getState();
  const sel = s.savedNotebooks.find(n => n.id === s.selectedNotebookId);
  if (sel) return sel.studentId;
  return s.savedNotebooks[0] ? s.savedNotebooks[0].studentId : null;
}

function renderNotebooks() {
  const s = getState();
  const nbs = s.savedNotebooks;
  const container = document.getElementById('notebookList');
  if (!nbs.length) {
    container.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--muted);">No notebooks yet. Complete a session to see data here.</div>';
    if (typeof amieSyncSession === 'function') amieSyncSession();   // no session → Amie neutral
    return;
  }

  // Group sessions by student identity (Feedback 4: no cross-student mixing).
  const order = [];
  const byId = {};
  nbs.forEach(n => {
    if (!byId[n.studentId]) { byId[n.studentId] = { id: n.studentId, name: n.studentName, sessions: [] }; order.push(byId[n.studentId]); }
    byId[n.studentId].sessions.push(n);
  });

  const activeStudent = byId[currentPracticeStudentId()] || order[0];
  // If the selected session doesn't belong to the shown student, default to their newest.
  if (!activeStudent.sessions.some(n => n.id === s.selectedNotebookId)) {
    s.selectedNotebookId = activeStudent.sessions[0].id;
  }

  let html = '';
  if (order.length > 1) {
    html += `<div class="mb-3">
      <label class="text-[10px] uppercase tracking-wide font-semibold" style="color:var(--muted);">Student</label>
      <select onchange="setPracticeStudent(this.value)" class="w-full mt-1 rounded-lg px-3 py-2 text-sm field-input">
        ${order.map(st => `<option value="${st.id}" ${st.id === activeStudent.id ? 'selected' : ''}>${escapeHtml(st.name)} · ${st.sessions.length} session${st.sessions.length > 1 ? 's' : ''}</option>`).join('')}
      </select></div>`;
  }
  html += `<p class="text-[10px] uppercase tracking-wide font-semibold mb-2" style="color:var(--muted);">${escapeHtml(activeStudent.name)}'s sessions</p>`;

  html += activeStudent.sessions.map((nb, i) => {
    const isSel = nb.id === s.selectedNotebookId;
    const isNewest = i === 0;
    const typeLabel = getSessionType(nb.sessionType).label;
    return `
      <div class="px-4 py-3 rounded-xl border mb-2 transition-all" style="background:${isSel ? 'rgba(255,107,53,.06)' : 'white'}; border-color:${isSel ? 'rgba(255,107,53,.35)' : 'var(--line)'};">
        <button onclick="selectSession('${nb.id}')" class="w-full text-left">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold truncate mr-2" style="color:var(--navy);">${escapeHtml(nb.plan.meta.title)}</span>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-[9px] px-1.5 py-0.5 rounded font-medium" style="background:rgba(0,78,137,.06); color:var(--secondary);">${typeLabel}</span>
              ${isSel ? '<span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(255,107,53,.15); color:var(--primary);">▶ PRACTICING</span>' : (isNewest ? '<span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(6,214,160,.12); color:#059669;">NEW</span>' : '')}
            </div>
          </div>
          <div class="flex items-center gap-2 text-[11px]" style="color:var(--muted);">
            <span>${nb.date}</span><span>·</span><span>${nb.plan.meta.level}</span><span>·</span>
            <span>${nb.plan.meta.renderId} · ${nb.duration}m</span>
          </div>
        </button>
        <div class="flex gap-2 mt-2">
          ${isSel ? '' : `<button onclick="selectSession('${nb.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:var(--primary);">Practice this</button>`}
          <button onclick="showSessionObjective('${nb.id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg ml-auto" style="background:white; border:1px solid var(--line); color:var(--muted);">Session Objective</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html;
  updatePracticeHeader();
  // Keep Amie bound to whatever session is now selected (load / select / delete
  // all funnel through here). Local only — never triggers a model call.
  if (typeof amieSyncSession === 'function') amieSyncSession();
}

/* Select a specific session for practice. The Overview is shown by default so
   the student lands on the session summary before choosing an activity. */
/* Literacy sessions are pre-reading: the sentence-based activities (Reorder,
   Gap Fill) are hidden, and Quiz runs as a picture MCQ when the session has
   enough pictures (≥3). Overview, Flashcards and Matching are always offered. */
function applyActivityGating() {
  const nb = getActiveNotebook();
  const isLit = !!(nb && nb.plan && nb.plan.meta && nb.plan.meta.tier === 'literacy');
  const bank = nb && nb.plan && nb.plan.content ? nb.plan.content.practice_bank : null;
  const imgItems = bank && Array.isArray(bank.items) ? bank.items.filter(i => i.image).length : 0;
  document.querySelectorAll('.sv-activity-tiles [data-reading]').forEach(b => {
    let hide = false;
    if (isLit) hide = (b.getAttribute('data-reading') === 'quiz') ? (imgItems < 3) : true;
    b.style.display = hide ? 'none' : '';
  });
  // A tile with data-skill is restricted to its comma-separated session
  // types (Flashcards: Vocabulary & Communication; Listening: Vocabulary &
  // Communication, i.e. never Grammar). Literacy is exempt — its always-on
  // picture flashcards are untouched, and literacy tiles are governed by
  // data-reading above regardless.
  const skillAllows = b => {
    const gate = b.getAttribute('data-skill');
    return !gate || isLit || gate.split(',').includes(nb && nb.sessionType);
  };
  document.querySelectorAll('.sv-activity-tiles [data-skill]:not([data-newcard])').forEach(b => {
    b.style.display = skillAllows(b) ? '' : 'none';
  });
  // Expansion cards (Reading / Listening / Explore More): show a tile only when
  // the selected session actually carries that card AND, if the tile is also
  // skill-gated (Listening), matches the allowed session types. Older sessions
  // generated before this feature simply won't have the key, so their tiles
  // stay hidden — and the pre-reading literacy tier never shows them.
  const NEWCARD_KEY = { reading: 'reading', listening: 'listening', explore: 'externalResources' };
  document.querySelectorAll('.sv-activity-tiles [data-newcard]').forEach(b => {
    const present = !!(bank && bank[NEWCARD_KEY[b.getAttribute('data-newcard')]]);
    b.style.display = (present && !isLit && skillAllows(b)) ? '' : 'none';
  });
}

function selectSession(id) {
  const s = getState();
  if (!s.savedNotebooks.some(n => n.id === id)) return;
  s.selectedNotebookId = id;
  persistNotebooks();
  renderNotebooks();
  applyActivityGating();
  if (typeof renderStudentXpBadge === 'function') renderStudentXpBadge();
  if (_svIsMobile()) {
    // Mobile: open the session's detail page — objective on top, activity tiles
    // below, activity area empty until the student picks a tile.
    resetActivityArea();
    showSessionObjective(id);   // renders the objective and enters detail mode
  } else {
    document.getElementById('notebookExpanded').classList.add('hidden');
    actOverview();              // Desktop: unchanged — Overview auto-shows on select
  }
}

/* Manual deletion — sessions are stored until removed here (or via a future admin panel). */
function deleteNotebook(id) {
  const s = getState();
  const idx = s.savedNotebooks.findIndex(n => n.id === id);
  if (idx === -1) return;
  s.savedNotebooks.splice(idx, 1);
  if (s.selectedNotebookId === id) s.selectedNotebookId = s.savedNotebooks[0] ? s.savedNotebooks[0].id : null;
  persistNotebooks();
  document.getElementById('notebookExpanded').classList.add('hidden');
  const content = document.getElementById('practiceContent');
  content.classList.add('hidden');
  content.innerHTML = '';
  document.getElementById('practiceEmpty').classList.remove('hidden');
  renderNotebooks();
  if (getActiveNotebook()) actOverview();
  showToast('Session deleted.', 'info');
}

/* Switch which student's sessions are shown; defaults to their newest session. */
function setPracticeStudent(studentId) {
  const first = getState().savedNotebooks.find(n => n.studentId === studentId);
  if (first) selectSession(first.id);
}

function updatePracticeHeader() {
  const nb = getActiveNotebook();
  const g = document.getElementById('studentGreeting');
  if (nb && g) {
    g.textContent = `Now practicing: ${nb.studentName} — “${nb.plan.meta.title}” (${nb.plan.meta.level} · ${nb.duration}min). Switch sessions on the left.`;
  }
}

/* ─── Session overview model ───
   Distills a stored session into its objective, can-do statement, and the key
   takeaways (target items practised). Sourced from the generated Objective/Launch
   slide, falling back to the tutor's form inputs and the practice bank. */
function getSessionOverview(nb) {
  const hero = (nb.plan.slides || []).find(sl => sl.layout === 'hero');
  const heroData = (hero && hero.data) || {};
  const details = (nb.plan.formData && nb.plan.formData.details) || {};
  const bank = getBank(nb);
  const objective = heroData.goal || details.objective || details.vocabTheme || nb.plan.meta.title || '';
  const canDo = heroData.can_do || '';
  const takeaways = bank.items.slice(0, 6).map(it => ({ term: it.term, meaning: it.meaning }));
  return { objective, canDo, takeaways, bank };
}

/* Point 3: concise "Session Objective" panel (replaces the old raw-data dump). */
function showSessionObjective(id) {
  const nb = getState().savedNotebooks.find(n => n.id === id) || getActiveNotebook();
  if (!nb) return;
  const ov = getSessionOverview(nb);
  const titleEl = document.getElementById('notebookExpandedTitle');
  if (titleEl) titleEl.textContent = 'Session Objective';
  document.getElementById('notebookRawData').innerHTML = `
    <div class="mb-2">
      <span class="text-sm font-semibold font-display" style="color:var(--navy);">${escapeHtml(nb.plan.meta.title)}</span>
      <div class="flex flex-wrap gap-1.5 mt-1.5">
        <span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(0,78,137,.06); color:var(--secondary);">${nb.plan.meta.level} · ${escapeHtml(nb.plan.meta.tier)}</span>
        <span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(255,107,53,.08); color:var(--primary);">${getSessionType(nb.sessionType).label} · ${nb.duration}min</span>
      </div>
    </div>
    <div class="rounded-lg p-3" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.15);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1" style="color:var(--primary);">Objective</p>
      <p class="text-sm leading-snug" style="color:var(--ink);">${escapeHtml(ov.objective) || '<span style="color:var(--muted);">No objective recorded.</span>'}</p>
    </div>
    ${ov.canDo ? `<div class="rounded-lg p-3 mt-2" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1" style="color:var(--secondary);">Can-do</p>
      <p class="text-sm italic leading-snug" style="color:var(--ink);">"${escapeHtml(ov.canDo)}"</p>
    </div>` : ''}`;
  document.getElementById('notebookExpanded').classList.remove('hidden');
  svEnterDetail();
}

/* ═══════════ 0. OVERVIEW (default view for a selected session) ═══════════
   Point 4: session summary shown before any activity — objective, key
   takeaways, and the can-do statement. */
function actOverview(nb) {
  nb = nb || requireNotebook(); if (!nb) return;
  const ov = getSessionOverview(nb);
  const meta = nb.plan.meta;

  let html = activityHeader('📋', 'Overview', `Session summary for "${meta.title}" — ${meta.level} · ${getSessionType(nb.sessionType).label} · ${nb.duration}min.`, false);

  if (nb.tutorNotes && nb.tutorNotes.trim()) {
    html += `
    <div class="rounded-2xl p-5 mb-4" style="background:rgba(255,210,63,.10); border:1px solid rgba(255,210,63,.35);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:#B45309;">📝 Notes &amp; Assignments from your tutor</p>
      <p class="text-sm whitespace-pre-wrap leading-relaxed" style="color:var(--ink);">${escapeHtml(nb.tutorNotes)}</p>
    </div>`;
  }

  html += `
    <div class="rounded-2xl p-5 mb-4" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.15);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--primary);">🎯 Objective</p>
      <p class="text-sm leading-relaxed" style="color:var(--ink);">${escapeHtml(ov.objective) || '<span style="color:var(--muted);">No objective recorded for this session.</span>'}</p>
    </div>`;

  html += `
    <div class="rounded-2xl p-5 mb-4" style="background:#F8F9FD; border:1px solid var(--line);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-2" style="color:var(--navy);">🔑 Key Takeaways</p>
      ${ov.takeaways.length
        ? `<div class="space-y-2">${ov.takeaways.map(t => `
            <div class="flex items-start gap-2">
              <span style="color:var(--primary);">▸</span>
              <p class="text-sm" style="color:var(--ink);"><span class="font-semibold" style="color:var(--navy);">${escapeHtml(t.term)}</span>${t.meaning ? ` — ${escapeHtml(t.meaning)}` : ''}</p>
            </div>`).join('')}</div>`
        : '<p class="text-sm" style="color:var(--muted);">Key items appear here once the practice bank is generated.</p>'}
    </div>`;

  html += `
    <div class="rounded-2xl p-5" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--secondary);">✅ Can-do — what ${escapeHtml(nb.studentName)} can do now</p>
      <p class="text-sm italic leading-relaxed" style="color:var(--ink);">${ov.canDo ? '"' + escapeHtml(ov.canDo) + '"' : '<span style="color:var(--muted); font-style:normal;">After practising this session, ' + escapeHtml(nb.studentName) + ' can use the target language from the takeaways above in context.</span>'}</p>
    </div>
    <p class="text-xs text-center mt-4" style="color:var(--muted);">Pick an activity above to start practising this session.</p>`;

  showPracticeContent(html);
}

/* ═══════════ 1. FLASHCARDS (challenge = reversed) ═══════════ */

function actFlashcards(challenge) {
  const nb = requireNotebook(); if (!nb) return;
  const bank = getBank(nb);
  const l1On = nb.student.l1Support;
  const T = t => `<span class="text-lg font-semibold" style="color:var(--navy);">${bidiText(t)}</span>`;
  const B = t => `<span class="text-sm font-semibold" style="color:var(--ink);">${bidiText(t)}</span>`;
  const cards = bank.items.map(it => {
    // Literacy items carry a picture: flip picture ⇄ word (a pre-reader recalls
    // the word from the image, or the image from the word in challenge mode).
    if (it.image && typeof litImg === 'function') {
      const pic = `<div class="fc-pic">${litImg(it.term, it.image.type)}</div>`;
      const word = `<span class="fc-word">${escapeHtml(it.term)}${typeof speakBtn === 'function' ? speakBtn(it.term) : ''}</span>`;
      return challenge ? { front: word, back: pic } : { front: pic, back: word };
    }
    const term = it.term;
    const def = `${it.meaning}${l1On && it.l1 ? ' · ' + it.l1 : ''}`;
    return challenge
      ? { front: T(def), back: B(term), example: it.example || '', term }   // recall the term from its meaning — harder
      : { front: T(term), back: B(def), example: it.example || '', term };
  });
  if (!cards.length) { showToast('No practice items in this notebook.', 'warn'); return; }

  let html = activityHeader('🃏', 'Flashcards', challenge
    ? `Reversed mode: read the meaning, recall the word. ${cards.length} cards.`
    : `Click any card to flip. ${cards.length} cards from your session.`, challenge);
  // Track which cards have been flipped so a full pass can earn XP.
  window._flashState = { total: cards.length, flipped: new Set(), challenge: !!challenge, recorded: false };

  // Vocabulary sessions speak the term aloud on every flip (Communication's
  // items are fuller phrases, and Literacy already has its own speak button).
  const speakOnFlip = nb.sessionType === 'vocabulary';
  html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
  cards.forEach((card, i) => {
    const speakAttr = (speakOnFlip && card.term) ? ` data-speak-term="${escapeHtml(card.term)}"` : '';
    html += `
      <div class="flashcard cursor-pointer" onclick="flipCard(this, ${i})"${speakAttr} style="height:160px">
        <div class="flashcard-inner w-full h-full">
          <div class="flashcard-front rounded-2xl p-5 flex flex-col items-center justify-center text-center" style="background:white; border:1px solid var(--line);">
            <span class="text-[10px] uppercase tracking-wider mb-2 font-semibold" style="color:var(--muted);">Card ${i + 1} — tap to flip</span>
            ${card.front}
          </div>
          <div class="flashcard-back rounded-2xl p-5 flex flex-col items-center justify-center text-center" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.15);">
            ${card.back}
            ${card.example ? `<span class="text-[11px] italic mt-1" style="color:var(--muted);">"${bidiText(card.example)}"</span>` : ''}
          </div>
        </div>
      </div>`;
  });
  html += `</div>
    <div id="flashDone" class="hidden mt-4 p-3 rounded-xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"></div>
    <p class="text-[11px] text-center mt-3" style="color:var(--muted);">Flip every card to earn XP for this pass.</p>
    <div class="flex justify-center mt-2">
      <button onclick="actFlashcards(${!challenge})" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:#7C3AED;">
        ${challenge ? '↩️ Normal Mode' : '⚡ Challenge Practice'}
      </button>
    </div>`;
  showPracticeContent(html);
  ActivityTimer.start('flashcards');
}

/* Flip a card, and award XP once every card has been seen at least once.
   (Flashcards have no score, so a full pass is the only meaningful signal.) */
function flipCard(el, i) {
  el.classList.toggle('flipped');
  if (el.dataset.speakTerm && typeof speak === 'function') speak(el.dataset.speakTerm);
  const st = window._flashState;
  if (!st || st.recorded) return;
  st.flipped.add(i);
  if (st.flipped.size === st.total) {
    st.recorded = true;   // only once per pass
    recordActivityCompletion('flashcards', null, null, st.challenge);
    const done = document.getElementById('flashDone');
    if (done) {
      done.classList.remove('hidden');
      done.innerHTML = `<p class="font-semibold" style="color:#059669;">🎉 You've been through all ${st.total} cards!</p>`;
    }
  }
}

/* ═══════════ 2. QUIZ MCQ (challenge = meaning → term) ═══════════ */

function actQuiz(challenge) {
  const nb = requireNotebook(); if (!nb) return;
  const bank = getBank(nb);
  // Literacy: picture MCQ. Normal = show the word, pick its picture. Challenge =
  // show a picture, pick the word. (CEFR uses the word↔meaning text MCQ.)
  const litItems = bank.items.filter(i => i.image);
  const isLit = litItems.length >= 3 && typeof litImg === 'function';
  const pool = isLit ? litItems : bank.items;
  if (pool.length < 3) { showToast('Need at least 3 practice items for a quiz.', 'warn'); return; }

  const count = challenge ? Math.min(7, pool.length) : Math.min(5, pool.length);
  const picks = shuffled(pool).slice(0, count);
  const questions = picks.map(item => {
    if (isLit && challenge) {                       // picture → choose the word
      const distractors = shuffled(litItems.filter(i => i.term !== item.term)).slice(0, 2).map(i => i.term);
      const options = shuffled([item.term, ...distractors]);
      return { qHtml: `Which word?<div class="quiz-qpic">${litImg(item.term, item.image.type)}</div>`,
        options, optHtml: false, correct: options.indexOf(item.term), item };
    }
    if (isLit) {                                    // word → choose the picture
      const distractors = shuffled(litItems.filter(i => i.term !== item.term)).slice(0, 2);
      const opts = shuffled([item, ...distractors]);
      return { qHtml: `Which picture is &ldquo;${escapeHtml(item.term)}&rdquo;? ${speakBtn(item.term)}`,
        options: opts.map(o => `<div class="quiz-pic">${litImg(o.term, o.image.type)}</div>`),
        optHtml: true, correct: opts.indexOf(item), item };
    }
    if (challenge) {                                // CEFR reversed: meaning → term
      const distractors = shuffled(bank.items.filter(i => i.term !== item.term)).slice(0, 2).map(i => i.term);
      const options = shuffled([item.term, ...distractors]);
      return { qHtml: escapeHtml(`Which word means: "${item.meaning}"?`), options, optHtml: false, correct: options.indexOf(item.term), item };
    }
    const distractors = shuffled(bank.items.filter(i => i.term !== item.term)).slice(0, 2).map(i => i.meaning);
    const options = shuffled([item.meaning, ...distractors]);
    return { qHtml: escapeHtml(`What does "${item.term}" mean?`), options, optHtml: false, correct: options.indexOf(item.meaning), item };
  });

  window._quizQuestions = questions;
  window._quizChallenge = !!challenge;

  let html = activityHeader('❓', 'Quiz', `${questions.length} questions · from "${escapeHtml(nb.plan.meta.title)}"`, challenge);
  html += '<div class="space-y-4">';
  questions.forEach((q, qi) => {
    html += `
      <div class="rounded-xl p-4" id="qq${qi}" style="background:#F8F9FD; border:1px solid var(--line);">
        <p class="text-sm font-medium mb-3" style="color:var(--navy);">${qi + 1}. ${q.qHtml}</p>
        <div class="${q.optHtml ? 'grid grid-cols-3 gap-2' : 'space-y-2'}">
          ${q.options.map((opt, oi) => `
            <button onclick="quizAnswer(${qi},${oi},${q.correct})" id="qo${qi}_${oi}"
              class="quiz-option ${q.optHtml ? 'quiz-option-pic' : 'w-full text-left'} px-3 py-2.5 rounded-xl border text-sm" style="border-color:var(--line); background:white; color:var(--ink);">
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold mr-2 align-middle" style="background:#F1F2F6; color:var(--muted);">${String.fromCharCode(65 + oi)}</span>
              ${q.optHtml ? opt : escapeHtml(opt)}
            </button>`).join('')}
        </div>
        <div id="qf${qi}" class="hidden mt-2 text-xs px-2 py-1.5 rounded-lg"></div>
      </div>`;
  });
  html += `</div><div id="quizScore" class="hidden mt-4 p-4 rounded-xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"><span class="font-bold text-lg" id="scoreText" style="color:#059669;"></span><div id="quizActions"></div></div>`;
  showPracticeContent(html);
  window._quizState = { total: questions.length, correct: 0, answered: 0 };
  ActivityTimer.start('quiz');
}

function quizAnswer(qi, oi, correctIdx) {
  const nb = getActiveNotebook();
  const question = document.getElementById(`qq${qi}`);
  if (question.dataset.answered) return;
  question.dataset.answered = 'true';
  const selected = document.getElementById(`qo${qi}_${oi}`);
  const correctEl = document.getElementById(`qo${qi}_${correctIdx}`);
  const feedback = document.getElementById(`qf${qi}`);
  const item = window._quizQuestions?.[qi]?.item;

  if (oi === correctIdx) {
    selected.classList.add('correct');
    feedback.innerHTML = '<span style="color:#059669;">✓ Correct!</span>' + (item && item.image ? '' : explainAnswer(nb, item));
    window._quizState.correct++;
  } else {
    selected.classList.add('incorrect');
    correctEl.classList.add('correct');
    feedback.innerHTML = `<span class="text-red-500">✗ Not quite</span> — the answer is <strong style="color:#059669;">${String.fromCharCode(65 + correctIdx)}</strong>.` + (item && item.image ? '' : explainAnswer(nb, item));
  }
  feedback.classList.remove('hidden');
  window._quizState.answered++;
  question.querySelectorAll('.quiz-option').forEach(btn => btn.classList.add('pointer-events-none', 'opacity-70'));
  selected.classList.remove('opacity-70'); correctEl.classList.remove('opacity-70');

  if (window._quizState.answered === window._quizState.total) {
    const { correct: c, total: t } = window._quizState;
    const perfect = c === t;
    recordActivityCompletion('quiz', c, t, window._quizChallenge);
    document.getElementById('quizScore').classList.remove('hidden');
    document.getElementById('scoreText').textContent = `Score: ${c}/${t} — ${perfect ? 'Perfect! 🎯' : c >= Math.ceil(t * 0.6) ? 'Great job!' : 'Keep practicing!'}`;
    document.getElementById('quizActions').innerHTML = completionButtons('actQuiz', perfect && window._quizChallenge) ;
    if (perfect && !window._quizChallenge) {
      document.getElementById('quizActions').innerHTML = `
        <div class="flex justify-center gap-2 mt-3">
          <button onclick="actQuiz(true)" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:#7C3AED;">⚡ Challenge Practice</button>
        </div>`;
    }
  }
}

/* ═══════════ 3. REORDER (challenge = longest sentences) ═══════════ */

function actReorder(challenge) {
  const nb = requireNotebook(); if (!nb) return;
  const bank = getBank(nb);
  let sentences = bank.sentences.filter(s => s.split(/\s+/).length >= 3 && s.split(/\s+/).length <= 14);
  if (!sentences.length) { showToast('No suitable sentences in this notebook.', 'warn'); return; }

  if (challenge) {
    // hardest first: longest sentences only
    sentences = [...sentences].sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length).slice(0, Math.min(5, sentences.length));
  } else {
    sentences = shuffled(sentences).slice(0, Math.min(5, sentences.length));
  }

  // All sentences shown together on one page (like Quiz/Gap Fill), each with
  // its own independent build area, instead of one sentence at a time.
  window._reorderRounds = sentences.map(sentence => {
    const words = sentence.replace(/[.!?]$/, '').split(/\s+/);
    return { target: words.join(' '), placed: [], pool: shuffled(words.map((w, i) => ({ w, id: i }))) };
  });
  window._reorderState = { total: sentences.length, correct: 0, answered: 0, challenge: !!challenge, nb };

  let html = activityHeader('🔀', 'Reorder', challenge
    ? 'Challenge: the longest sentences from your session. Click the words in order.'
    : 'Click the words in the correct order to rebuild each sentence.', challenge);
  html += '<div class="space-y-4">';
  sentences.forEach((s, ri) => {
    html += `
      <div class="rounded-xl p-4" id="rq${ri}" style="background:#F8F9FD; border:1px solid var(--line);">
        <p class="text-[11px] font-bold mb-2" style="color:var(--muted);">Sentence ${ri + 1}</p>
        <div id="reorderAnswer${ri}" class="reorder-zone mb-3"></div>
        <div id="reorderPool${ri}" class="flex flex-wrap gap-2 mb-3"></div>
        <div class="flex gap-2">
          <button onclick="checkReorder(${ri})" class="px-4 py-2 rounded-xl text-white text-sm font-semibold" style="background:var(--primary);">Check</button>
          <button onclick="resetReorderRound(${ri})" class="px-4 py-2 rounded-xl text-sm font-semibold" style="background:white; border:1px solid var(--line); color:var(--muted);">Reset</button>
        </div>
        <div id="rf${ri}" class="hidden mt-3 p-3 rounded-xl text-sm"></div>
      </div>`;
  });
  html += `</div><div id="reorderScore" class="hidden mt-4 p-4 rounded-xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"><span class="font-bold text-lg" id="reorderScoreText" style="color:#059669;"></span><div id="reorderActions"></div></div>`;
  showPracticeContent(html);
  sentences.forEach((_, ri) => renderReorderTokens(ri));
  ActivityTimer.start('reorder');
}

function renderReorderTokens(ri) {
  const r = window._reorderRounds[ri];
  document.getElementById(`reorderAnswer${ri}`).innerHTML = r.placed.length
    ? r.placed.map((t, i) => `<button onclick="unplaceWord(${ri},${i})" class="reorder-token placed">${escapeHtml(t.w)}</button>`).join('')
    : '<span class="text-xs self-center px-2" style="color:#B0B5C2;">Click words below to build the sentence…</span>';
  document.getElementById(`reorderPool${ri}`).innerHTML =
    r.pool.map((t, i) => `<button onclick="placeWord(${ri},${i})" class="reorder-token">${escapeHtml(t.w)}</button>`).join('');
}

function placeWord(ri, i) { const r = window._reorderRounds[ri]; r.placed.push(r.pool.splice(i, 1)[0]); renderReorderTokens(ri); }
function unplaceWord(ri, i) { const r = window._reorderRounds[ri]; r.pool.push(r.placed.splice(i, 1)[0]); renderReorderTokens(ri); }

/* A solved round locks; an unsolved one can always be reset and retried. */
function resetReorderRound(ri) {
  if (document.getElementById(`rq${ri}`).dataset.answered) return;
  const r = window._reorderRounds[ri];
  r.placed = [];
  r.pool = shuffled(r.target.split(' ').map((w, i) => ({ w, id: i })));
  renderReorderTokens(ri);
}

function reorderItemFor(nb, sentence) {
  const bank = getBank(nb);
  return bank.items.find(it => sentence.toLowerCase().includes(it.term.toLowerCase()));
}

function checkReorder(ri) {
  const st = window._reorderState;
  const box = document.getElementById(`rq${ri}`);
  if (box.dataset.answered) return;
  const r = window._reorderRounds[ri];
  const fb = document.getElementById(`rf${ri}`);
  fb.classList.remove('hidden');
  const attempt = r.placed.map(t => t.w).join(' ');
  const item = reorderItemFor(st.nb, r.target);
  if (attempt === r.target) {
    box.dataset.answered = 'true';
    st.correct++; st.answered++;
    fb.style.background = 'rgba(6,214,160,.08)'; fb.style.border = '1px solid rgba(6,214,160,.2)';
    fb.innerHTML = `<span style="color:#059669;" class="font-semibold">✓ Correct!</span> <span style="color:var(--ink);">"${escapeHtml(r.target)}."</span>` + explainAnswer(st.nb, item);
    box.querySelectorAll('.reorder-token').forEach(b => { b.disabled = true; b.classList.add('opacity-60'); });
    box.querySelectorAll('button').forEach(b => { if (!b.classList.contains('reorder-token')) b.disabled = true; });
    finishReorderIfDone();
  } else {
    fb.style.background = 'rgba(239,68,68,.06)'; fb.style.border = '1px solid rgba(239,68,68,.15)';
    fb.innerHTML = `<span class="text-red-500 font-semibold">✗ Not quite.</span> <span style="color:var(--ink);">Try a different order.</span>` + explainAnswer(st.nb, item);
  }
}

function finishReorderIfDone() {
  const st = window._reorderState;
  if (st.answered < st.total) return;
  const perfect = st.correct === st.total;
  recordActivityCompletion('reorder', st.correct, st.total, st.challenge);
  const scoreBox = document.getElementById('reorderScore');
  scoreBox.classList.remove('hidden');
  document.getElementById('reorderScoreText').textContent = `Score: ${st.correct}/${st.total}${perfect ? ' — Perfect! 🎯' : ''}`;
  document.getElementById('reorderActions').innerHTML = completionButtons('actReorder', perfect && st.challenge);
}

/* ═══════════ 4. GAP FILL (challenge = typed input, no options) ═══════════ */

function actGapFill(challenge) {
  const nb = requireNotebook(); if (!nb) return;
  const bank = getBank(nb);
  const rounds = [];
  bank.sentences.forEach(s => {
    const found = bank.items.find(it => s.toLowerCase().includes(it.term.toLowerCase()));
    if (found && rounds.length < 5) {
      const re = new RegExp(found.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const gapped = s.replace(re, '_____');
      if (gapped !== s) {
        const distractors = shuffled(bank.items.filter(i => i.term !== found.term)).slice(0, 2).map(i => i.term);
        const options = shuffled([found.term, ...distractors]);
        rounds.push({ gapped, answer: found.term, options, correct: options.indexOf(found.term), item: found });
      }
    }
  });
  if (!rounds.length) { showToast('Could not build gap-fill items from this notebook.', 'warn'); return; }

  window._gapRounds = rounds;
  window._gapChallenge = !!challenge;

  let html = activityHeader('✏️', 'Gap Fill', challenge
    ? `Challenge: TYPE the missing word — no options given. ${rounds.length} sentences.`
    : `Choose the word that completes each sentence. ${rounds.length} sentences.`, challenge);
  html += '<div class="space-y-4">';
  rounds.forEach((r, ri) => {
    html += `
      <div class="rounded-xl p-4" id="gq${ri}" style="background:#F8F9FD; border:1px solid var(--line);">
        <p class="text-sm font-medium mb-3" style="color:var(--navy);">${ri + 1}. ${escapeHtml(r.gapped)}</p>
        ${challenge
          ? `<div class="flex gap-2">
              <input id="gi${ri}" type="text" placeholder="Type the missing word…" class="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none field-input" onkeydown="if(event.key==='Enter')gapAnswerTyped(${ri})">
              <button onclick="gapAnswerTyped(${ri})" class="px-4 py-2 rounded-xl text-white text-sm font-semibold" style="background:var(--primary);">Check</button>
            </div>`
          : `<div class="flex flex-wrap gap-2">
              ${r.options.map((opt, oi) => `
                <button onclick="gapAnswer(${ri},${oi},${r.correct})" id="go${ri}_${oi}"
                  class="quiz-option px-4 py-2 rounded-xl border text-sm" style="border-color:var(--line); background:white; color:var(--ink);">${escapeHtml(opt)}</button>`).join('')}
            </div>`}
        <div id="gf${ri}" class="hidden mt-2 text-xs px-2 py-1.5 rounded-lg"></div>
      </div>`;
  });
  html += `</div><div id="gapScore" class="hidden mt-4 p-4 rounded-xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"><span class="font-bold text-lg" id="gapScoreText" style="color:#059669;"></span><div id="gapActions"></div></div>`;
  showPracticeContent(html);
  window._gapState = { total: rounds.length, correct: 0, answered: 0 };
  ActivityTimer.start('gapfill');
}

function finishGapIfDone() {
  if (window._gapState.answered === window._gapState.total) {
    const { correct: c, total: t } = window._gapState;
    const perfect = c === t;
    recordActivityCompletion('gapfill', c, t, window._gapChallenge);
    document.getElementById('gapScore').classList.remove('hidden');
    document.getElementById('gapScoreText').textContent = `Score: ${c}/${t}${perfect ? ' — Perfect! 🎯' : ''}`;
    document.getElementById('gapActions').innerHTML = (perfect && window._gapChallenge)
      ? '<p class="text-xs mt-2" style="color:var(--muted);">You beat the challenge — outstanding!</p>'
      : (perfect
        ? `<div class="flex justify-center gap-2 mt-3"><button onclick="actGapFill(true)" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:#7C3AED;">⚡ Challenge Practice</button></div>`
        : completionButtons('actGapFill', false));
  }
}

function gapAnswer(ri, oi, correctIdx) {
  const nb = getActiveNotebook();
  const q = document.getElementById(`gq${ri}`);
  if (q.dataset.answered) return;
  q.dataset.answered = 'true';
  const selected = document.getElementById(`go${ri}_${oi}`);
  const correctEl = document.getElementById(`go${ri}_${correctIdx}`);
  const fb = document.getElementById(`gf${ri}`);
  const item = window._gapRounds?.[ri]?.item;
  if (oi === correctIdx) {
    selected.classList.add('correct');
    fb.innerHTML = '<span style="color:#059669;">✓ Correct!</span>' + (item && item.image ? '' : explainAnswer(nb, item));
    window._gapState.correct++;
  } else {
    selected.classList.add('incorrect');
    correctEl.classList.add('correct');
    fb.innerHTML = `<span class="text-red-500">✗ The answer was "${escapeHtml(correctEl.textContent.trim())}"</span>` + (item && item.image ? '' : explainAnswer(nb, item));
  }
  fb.classList.remove('hidden');
  window._gapState.answered++;
  q.querySelectorAll('.quiz-option').forEach(b => b.classList.add('pointer-events-none', 'opacity-70'));
  selected.classList.remove('opacity-70'); correctEl.classList.remove('opacity-70');
  finishGapIfDone();
}

function gapAnswerTyped(ri) {
  const nb = getActiveNotebook();
  const q = document.getElementById(`gq${ri}`);
  if (q.dataset.answered) return;
  const input = document.getElementById(`gi${ri}`);
  const attempt = input.value.trim().toLowerCase();
  if (!attempt) return;
  q.dataset.answered = 'true';
  input.disabled = true;
  const round = window._gapRounds[ri];
  const fb = document.getElementById(`gf${ri}`);
  if (attempt === round.answer.toLowerCase()) {
    input.style.borderColor = 'var(--success)';
    fb.innerHTML = '<span style="color:#059669;">✓ Correct!</span>' + explainAnswer(nb, round.item);
    window._gapState.correct++;
  } else {
    input.style.borderColor = '#EF4444';
    fb.innerHTML = `<span class="text-red-500">✗ The answer was "${escapeHtml(round.answer)}"</span>` + explainAnswer(nb, round.item);
  }
  fb.classList.remove('hidden');
  window._gapState.answered++;
  finishGapIfDone();
}

/* ═══════════ 5. MATCHING (challenge = term → example with blank, more pairs) ═══════════ */

let _match = null;

function actMatching(challenge) {
  const nb = requireNotebook(); if (!nb) return;
  const bank = getBank(nb);
  // Literacy: match the word to its picture. Otherwise word ↔ meaning (or word
  // ↔ the sentence it completes, in challenge mode).
  const litItems = bank.items.filter(i => i.image);
  const isLit = litItems.length >= 3 && typeof litImg === 'function';
  if (isLit) challenge = false;
  let candidates = isLit
    ? litItems
    : bank.items.filter(i => challenge ? (i.example && i.example.toLowerCase().includes(i.term.toLowerCase())) : i.meaning);
  const maxPairs = challenge ? 8 : 5;
  const pairs = shuffled(candidates).slice(0, Math.min(maxPairs, candidates.length));
  if (pairs.length < 3) { showToast('Need at least 3 items for matching.', 'warn'); return; }

  const rightText = it => isLit
    ? `<div class="match-pic">${litImg(it.term, it.image.type)}</div>`
    : (challenge
        ? it.example.replace(new RegExp(it.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____')
        : it.meaning);

  _match = {
    nb, pairs, challenge: !!challenge, rightHtml: isLit,
    left: shuffled(pairs.map((p, i) => ({ text: p.term, pair: i }))),
    right: shuffled(pairs.map((p, i) => ({ text: rightText(p), pair: i }))),
    selectedLeft: null, matched: new Set(), attempts: 0
  };

  let html = activityHeader('🔗', 'Matching', isLit
    ? 'Click a word, then click its picture. Match all pairs.'
    : (challenge
        ? `Challenge: match each word to the sentence it completes. ${pairs.length} pairs.`
        : 'Click a word, then click its meaning. Match all pairs.'), challenge);
  html += `
    <p class="text-xs mb-2" id="matchStatus" style="color:var(--muted);">0 / ${pairs.length} matched</p>
    <div id="matchFeedback" class="hidden mb-3 p-2.5 rounded-xl text-xs"></div>
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2" id="matchLeft"></div>
      <div class="space-y-2" id="matchRight"></div>
    </div>
    <div id="matchDone" class="hidden mt-4 p-5 rounded-2xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"></div>`;
  showPracticeContent(html);
  renderMatch();
  ActivityTimer.start('matching');
}

function renderMatch() {
  const m = _match;
  document.getElementById('matchLeft').innerHTML = m.left.map((it, i) => {
    const done = m.matched.has(it.pair);
    const sel = m.selectedLeft === i;
    return `<button onclick="pickLeft(${i})" class="match-token w-full ${done ? 'done' : ''} ${sel ? 'selected' : ''}" ${done ? 'disabled' : ''}>${escapeHtml(it.text)}</button>`;
  }).join('');
  document.getElementById('matchRight').innerHTML = m.right.map((it, i) => {
    const done = m.matched.has(it.pair);
    return `<button onclick="pickRight(${i})" class="match-token w-full ${m.rightHtml ? 'match-token-pic' : ''} ${done ? 'done' : ''}" ${done ? 'disabled' : ''}>${m.rightHtml ? it.text : escapeHtml(it.text)}</button>`;
  }).join('');
  document.getElementById('matchStatus').textContent = `${m.matched.size} / ${m.pairs.length} matched · ${m.attempts} attempts`;
}

function matchFeedback(item, correct) {
  const fb = document.getElementById('matchFeedback');
  fb.classList.remove('hidden');
  fb.style.background = correct ? 'rgba(6,214,160,.08)' : 'rgba(239,68,68,.06)';
  fb.style.border = correct ? '1px solid rgba(6,214,160,.2)' : '1px solid rgba(239,68,68,.15)';
  fb.innerHTML = (correct
    ? '<span style="color:#059669;" class="font-semibold">✓ Match!</span>'
    : '<span class="text-red-500 font-semibold">✗ Not a match.</span>') + (item.image ? '' : explainAnswer(_match.nb, item));
}

function pickLeft(i) {
  _match.selectedLeft = _match.selectedLeft === i ? null : i;
  renderMatch();
}

function pickRight(i) {
  const m = _match;
  if (m.selectedLeft === null) { showToast('Pick a word on the left first.', 'info'); return; }
  m.attempts++;
  const leftItem = m.left[m.selectedLeft];
  const rightItem = m.right[i];
  const bankItem = m.pairs[leftItem.pair];
  if (leftItem.pair === rightItem.pair) {
    m.matched.add(leftItem.pair);
    m.selectedLeft = null;
    matchFeedback(bankItem, true);
    renderMatch();
    if (m.matched.size === m.pairs.length) {
      const perfect = m.attempts === m.pairs.length;
      // correct = pairs matched, total = attempts taken (efficiency-scaled XP)
      recordActivityCompletion('matching', m.pairs.length, m.attempts, m.challenge);
      const d = document.getElementById('matchDone');
      d.classList.remove('hidden');
      d.innerHTML = `<p class="text-2xl mb-1">🎉</p><p class="font-bold" style="color:#059669;">All matched in ${m.attempts} attempts!${perfect ? ' Flawless! 🎯' : ''}</p>
        ${completionButtons('actMatching', perfect && m.challenge)}`;
    }
  } else {
    m.selectedLeft = null;
    matchFeedback(bankItem, false);
    renderMatch();
  }
}

/* ═══════════ Reading / Listening / Explore More ═══════════
   Practice Bank Expansion cards. These are SAVED content on the session's
   practice_bank (keys: reading, listening, externalResources) — no new
   generation call when a student opens them. Slice 0 renders text + questions;
   audio (ElevenLabs → Supabase Storage) and verified Explore links arrive in
   later slices, so the Play button shows a non-blocking "Preparing audio…"
   state and Explore shows the honest empty-state until then.
   The listening card NEVER renders audio.internalScript — that is server-only. */

function getCard(nb, key) {
  const pb = nb && nb.plan && nb.plan.content ? nb.plan.content.practice_bank : null;
  return (pb && pb[key]) || null;
}

function canDoBadge(text) {
  if (!text) return '';
  return `<div class="rounded-xl px-3 py-2 mb-3 text-sm" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12); color:var(--ink);">
    <span class="text-[10px] uppercase tracking-wider font-semibold mr-1" style="color:var(--secondary);">Can-do</span> ${escapeHtml(text)}</div>`;
}

/* Public CDN URL for a stored practice-audio object. Paths are relative to the
   `practice-audio` bucket (e.g. "generated/<sessionId>/reading-<hash>.mp3"). */
function practiceAudioUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const base = (typeof SUPABASE_URL === 'string') ? SUPABASE_URL : '';
  return `${base}/storage/v1/object/public/practice-audio/${path}`;
}

/* Lazy, generate-once audio. Called when a Reading/Listening card opens: if the
   clip isn't ready yet it asks the `practice-tts` Edge Function to generate it
   (ElevenLabs → Supabase Storage, key stays server-side), then updates the
   in-memory card and calls onReady so the UI can swap in the player. On demo/
   preview sessions (no backend or no real session id) it no-ops, leaving the
   "Preparing audio…" placeholder in place. Guarded so a card only triggers one
   generation at a time. */
/* Bump when the audio's voice/speed settings change. Clips are stamped with the
   version they were generated under; a stored clip whose stamp is older than this
   is refreshed the next time its card opens (see actListening), so existing
   sessions catch up to the current voice without regenerating everything at once.
   Keep this in step with the practice-tts function's settings. */
const AUDIO_SETTINGS_VERSION = 2;

const _ttsInFlight = {};
async function hydratePracticeAudio(cardId, onReady, opts) {
  opts = opts || {};
  const nb = getActiveNotebook(); if (!nb) return;
  const card = getCard(nb, cardId); if (!card || !card.audio) return;
  // Skip the call when the clip is already current — unless a refresh is forced.
  if (!opts.force && card.audio.audioStatus === 'ready' && card.audio.audioPath) { if (onReady) onReady(card); return; }
  const c = (typeof sb === 'function') ? sb() : null;
  if (!c || !nb.id) return;                 // demo/preview: no server to generate audio
  const key = nb.id + ':' + cardId;
  if (_ttsInFlight[key]) return;
  _ttsInFlight[key] = true;
  try {
    const { data, error } = await c.functions.invoke('practice-tts', { body: { sessionId: nb.id, card: cardId, settingsVersion: AUDIO_SETTINGS_VERSION } });
    if (error || !data || !data.audio) { console.warn('practice-tts:', (error && error.message) || (data && data.error) || 'no audio'); return; }
    card.audio = Object.assign({}, card.audio, data.audio);   // mutates the bank object → persists for this view
    if (onReady) onReady(card);
  } catch (e) {
    console.warn('practice-tts failed:', e);
  } finally {
    _ttsInFlight[key] = false;
  }
}

/* Eager generation: called right after a plan's practice bank is known to be
   complete (curriculum generation, or a tutor saving/starting a session) so
   audio is generated once, keyed to the reusable plan rather than a
   per-delivery session — every future delivery of that same plan then loads
   it pre-populated, with zero further ElevenLabs calls. Fire-and-forget is
   fine here: a failure just leaves hydratePracticeAudio()'s lazy path as the
   fallback the next time someone opens the card.

   Callers don't await this before refreshing the tutor's plan list, so the
   in-memory tutorState.plans cache would otherwise still show the pre-call
   "pending" audio — and tutorUsePlanConfirm() reads straight from that cache
   ("Use for a student" doesn't re-fetch from the DB), which would copy the
   stale pending state into a new delivery even though the DB row is already
   ready. Patching the cached entry here (once the call actually resolves)
   keeps same-session reuse correct without forcing a page reload. */
async function triggerEagerAudio(planId, cardIds) {
  const c = (typeof sb === 'function') ? sb() : null;
  if (!c || !planId) return;
  for (const cardId of (cardIds || ['listening'])) {
    try {
      const { data, error } = await c.functions.invoke('practice-tts', { body: { planId, card: cardId, settingsVersion: AUDIO_SETTINGS_VERSION } });
      if (!error && data && data.audio && window.tutorState && Array.isArray(tutorState.plans)) {
        const cached = tutorState.plans.find(p => p.id === planId);
        const bank = cached && cached.plan && cached.plan.content && cached.plan.content.practice_bank;
        if (bank && bank[cardId]) bank[cardId].audio = data.audio;
      }
    } catch (e) {
      console.warn('eager practice-tts failed for', cardId, e);
    }
  }
}

/* A saved audio clip renders as a real player only once the TTS pipeline has
   uploaded it (audioStatus 'ready' + a path). Until then it's a disabled,
   non-blocking placeholder. Replay uses the stored file; the student never
   triggers a fresh TTS call. */
function practiceAudioControl(audio) {
  const ready = !!(audio && audio.audioPath && audio.audioStatus === 'ready');
  if (ready && typeof practiceAudioUrl === 'function') {
    const url = practiceAudioUrl(audio.audioPath);
    return `<audio controls preload="none" class="w-full mt-1" style="max-width:420px;"><source src="${escapeHtml(url)}" type="audio/mpeg"></audio>`;
  }
  return `<button disabled aria-disabled="true" class="mt-1 px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2" style="background:#F1F2F6; color:var(--muted); border:1px solid var(--line); cursor:not-allowed;"><span>🔊</span> Preparing audio…</button>`;
}

/* ── Shared question engine for Reading & Listening ──
   Multiple-choice only, by design — never a typing box, even for a stray
   legacy question with no locatable answer (that question is simply
   dropped rather than falling back to a text input). Scored locally and
   shown on completion.
   NOTE: XP/persistence is intentionally NOT wired yet — activity_attempts has a
   CHECK constraint limited to the original five activities, so recording
   'reading'/'listening' needs the DB migration that lands with the audio slice.
   Until then these cards score in-page only. */
window._pq = window._pq || {};

function normalizePracticeQuestions(questions) {
  const norm = s => String(s || '').trim().toLowerCase().replace(/[.!?'"]/g, '');
  return (questions || [])
    .filter(q => q && q.question && Array.isArray(q.options) && q.options.filter(o => o != null && o !== '').length >= 2)
    .map((q, i) => {
      const options = q.options.filter(o => o != null && o !== '');
      let correct = options.findIndex(o => norm(o) === norm(q.answer));
      if (correct < 0) correct = 0;   // best-effort — never degrades to free text
      return {
        id: q.id || `q${i + 1}`,
        type: 'multiple_choice',
        question: q.question,
        options,
        correct,
        answer: q.answer || '',
        feedbackCorrect: q.feedbackCorrect || 'Correct!',
        feedbackIncorrect: q.feedbackIncorrect || ''
      };
    });
}

function practiceQuestionsHtml(prefix, questions, onCompleteName) {
  const qs = normalizePracticeQuestions(questions);
  const total = qs.length;   // every question is scorable
  window._pq[prefix] = { questions: qs, total, correct: 0, answered: 0, count: qs.length, onComplete: onCompleteName || '' };
  let html = '<div class="space-y-4">';
  qs.forEach((q, qi) => {
    html += `<div class="rounded-xl p-4" id="${prefix}q${qi}" style="background:#F8F9FD; border:1px solid var(--line);">
      <p class="text-sm font-medium mb-3" style="color:var(--navy);">${qi + 1}. ${escapeHtml(q.question)}</p>
      <div class="space-y-2">${q.options.map((opt, oi) => `
        <button onclick="practiceAnswer('${prefix}',${qi},${oi})" id="${prefix}o${qi}_${oi}"
          class="quiz-option w-full text-left px-3 py-2.5 rounded-xl border text-sm" style="border-color:var(--line); background:white; color:var(--ink);">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold mr-2 align-middle" style="background:#F1F2F6; color:var(--muted);">${String.fromCharCode(65 + oi)}</span>
          ${escapeHtml(opt)}
        </button>`).join('')}</div>`;
    html += `<div id="${prefix}f${qi}" class="hidden mt-2 text-xs px-2 py-1.5 rounded-lg"></div></div>`;
  });
  html += `</div><div id="${prefix}Done" class="hidden mt-4 p-4 rounded-xl" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);"></div>`;
  return html;
}

function _pqCheckDone(prefix) {
  const st = window._pq[prefix];
  if (!st || st.answered < st.count || st.recorded) return;
  st.recorded = true;   // one completion record per run
  const done = document.getElementById(prefix + 'Done');
  if (!done) return;
  let inner = '';
  if (st.total > 0) {
    const perfect = st.correct === st.total;
    inner = `<p class="font-bold text-center" style="color:#059669;">Score: ${st.correct}/${st.total} — ${perfect ? 'Perfect! 🎯' : st.correct >= Math.ceil(st.total * 0.6) ? 'Great job!' : 'Keep practising!'}</p>`;
    // Reading/Listening are recorded for XP like the other activities (the
    // activity_attempts CHECK is extended in migration_011). recordActivityCompletion
    // itself no-ops for demo/preview/read-only contexts.
    if ((prefix === 'reading' || prefix === 'listening') && typeof recordActivityCompletion === 'function') {
      recordActivityCompletion(prefix, st.correct, st.total, false);
    }
  } else {
    inner = `<p class="font-bold text-center" style="color:#059669;">Nice work — you finished this activity.</p>`;
  }
  if (st.onComplete && typeof window[st.onComplete] === 'function') inner += window[st.onComplete]();
  done.innerHTML = inner;
  done.classList.remove('hidden');
}

function practiceAnswer(prefix, qi, oi) {
  const st = window._pq[prefix]; if (!st) return;
  const box = document.getElementById(`${prefix}q${qi}`);
  if (!box || box.dataset.answered) return;
  box.dataset.answered = 'true';
  const q = st.questions[qi];
  const sel = document.getElementById(`${prefix}o${qi}_${oi}`);
  const correctEl = document.getElementById(`${prefix}o${qi}_${q.correct}`);
  const fb = document.getElementById(`${prefix}f${qi}`);
  if (oi === q.correct) {
    sel.classList.add('correct');
    fb.innerHTML = `<span style="color:#059669;">✓ Correct!</span> ${bidiText(q.feedbackCorrect)}`;
    st.correct++;
  } else {
    sel.classList.add('incorrect');
    if (correctEl) correctEl.classList.add('correct');
    fb.innerHTML = `<span class="text-red-500">✗ Not quite</span> — ${bidiText(q.feedbackIncorrect || ('the answer is ' + q.answer + '.'))}`;
  }
  fb.classList.remove('hidden');
  box.querySelectorAll('.quiz-option').forEach(b => b.classList.add('pointer-events-none', 'opacity-70'));
  sel.classList.remove('opacity-70'); if (correctEl) correctEl.classList.remove('opacity-70');
  st.answered++;
  _pqCheckDone(prefix);
}

function practiceReveal(prefix, qi) {
  const st = window._pq[prefix]; if (!st) return;
  const box = document.getElementById(`${prefix}q${qi}`);
  if (!box || box.dataset.answered) return;
  box.dataset.answered = 'true';
  const q = st.questions[qi];
  const fb = document.getElementById(`${prefix}f${qi}`);
  fb.innerHTML = `<span style="color:var(--secondary);">Model answer:</span> ${bidiText(q.answer)}${q.feedbackCorrect ? ' — ' + bidiText(q.feedbackCorrect) : ''}`;
  fb.classList.remove('hidden');
  st.answered++;
  _pqCheckDone(prefix);
}

/* ── Reading Practice ── */
function actReading() {
  const nb = requireNotebook(); if (!nb) return;
  const card = getCard(nb, 'reading');
  if (!card || !card.passage || !card.passage.text) { showToast('No reading activity for this session yet.', 'warn'); return; }

  let html = activityHeader('📖', 'Reading Practice', `Read the text and check your understanding · "${escapeHtml(nb.plan.meta.title)}"`, false);
  html += canDoBadge(card.canDo);

  if (card.warmUp && card.warmUp.prompt) {
    html += `<div class="rounded-xl p-3 mb-3" style="background:rgba(255,210,63,.10); border:1px solid rgba(255,210,63,.30);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1" style="color:#B45309;">Before you read</p>
      <p class="text-sm" style="color:var(--ink);">${bidiText(card.warmUp.prompt)}</p></div>`;
  }

  html += `<div class="rounded-2xl p-5 mb-3" style="background:white; border:1px solid var(--line);">
    ${card.passage.title ? `<p class="font-bold font-display mb-2" style="color:var(--navy);">${escapeHtml(card.passage.title)}</p>` : ''}
    <p style="color:var(--ink); font-size:1.05rem; line-height:1.9; white-space:pre-wrap;">${bidiText(card.passage.text)}</p>
  </div>`;

  if (Array.isArray(card.questions) && card.questions.length) {
    html += `<p class="text-[10px] uppercase tracking-wider font-semibold mb-2" style="color:var(--navy);">Comprehension</p>`;
    html += practiceQuestionsHtml('reading', card.questions, 'readingExtrasHtml');
  }
  window._readingCard = card;
  showPracticeContent(html);
  ActivityTimer.start('reading');
}

/* Key vocabulary + transfer task, revealed under the score when the reading
   questions are complete. */
function readingExtrasHtml() {
  const card = window._readingCard; if (!card) return '';
  let html = '';
  if (Array.isArray(card.keyVocabulary) && card.keyVocabulary.length) {
    html += `<div class="mt-3 pt-3" style="border-top:1px solid rgba(6,214,160,.25);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--navy);">Key vocabulary</p>
      <div class="space-y-1.5">${card.keyVocabulary.map(v => `
        <p class="text-sm" style="color:var(--ink);"><span class="font-semibold" style="color:var(--navy);">${escapeHtml(v.word)}</span> — ${bidiText(v.simpleMeaning || '')}${v.exampleFromText ? ` <span style="color:var(--muted);">(“${escapeHtml(v.exampleFromText)}”)</span>` : ''}</p>`).join('')}</div></div>`;
  }
  if (card.transferTask && card.transferTask.prompt) {
    html += `<div class="mt-3 pt-3" style="border-top:1px solid rgba(6,214,160,.25);">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--primary);">Try it yourself</p>
      <p class="text-sm" style="color:var(--ink);">${bidiText(card.transferTask.prompt)}</p></div>`;
  }
  return html;
}

/* ── Listening Practice ── */
function actListening() {
  const nb = requireNotebook(); if (!nb) return;
  const card = getCard(nb, 'listening');
  if (!card) { showToast('No listening activity for this session yet.', 'warn'); return; }
  const a = card.audio || {};
  const hasAudio = !!(a.audioPath && a.audioStatus === 'ready');
  // A clip generated under older voice/speed settings — still playable, but we
  // refresh it in the background so the student ends up on the current voice.
  const stale = hasAudio && a.settingsVersion !== AUDIO_SETTINGS_VERSION;

  let html = activityHeader('🎧', 'Listening Practice', `Listen carefully and answer questions about what you hear · "${escapeHtml(nb.plan.meta.title)}"`, false);
  html += canDoBadge(card.canDo);

  if (Array.isArray(card.instructions) && card.instructions.length) {
    html += `<ul class="text-sm mb-3 space-y-1" style="color:var(--ink);">${card.instructions.map(i => `<li class="flex items-start gap-2"><span style="color:var(--secondary);">•</span> ${escapeHtml(i)}</li>`).join('')}</ul>`;
  }

  html += `<div class="rounded-2xl p-5 mb-3 text-center" style="background:white; border:1px solid var(--line);">
    <span id="listeningAudioSlot">${practiceAudioControl(card.audio)}</span>
    ${a.maxPlays ? `<p class="text-[11px] mt-2" style="color:var(--muted);">You can play the audio up to ${a.maxPlays} times.</p>` : ''}
  </div>`;

  if (!hasAudio) {
    // No audio yet → the questions can't be answered by listening, so we gate
    // them rather than let students guess. They unlock when the clip is ready.
    html += `<div class="rounded-xl p-4 text-center" style="background:#F8F9FD; border:1px dashed var(--line);">
      <p class="text-sm" style="color:var(--muted);">The listening audio is being prepared. The questions unlock as soon as it's ready.</p></div>`;
  } else if (Array.isArray(card.questions) && card.questions.length) {
    html += practiceQuestionsHtml('listening', card.questions, 'listeningExtrasHtml');
  }
  window._listeningCard = card;
  showPracticeContent(html);
  ActivityTimer.start('listening');

  if (!hasAudio) {
    // First open: generate the clip, then re-render so the player + questions
    // appear. hydrate only fires while audio isn't ready, so no re-render loop.
    hydratePracticeAudio('listening', () => actListening());
  } else if (stale) {
    // Existing clip made with older settings: refresh in the background and swap
    // the player in place when the new clip arrives — without disturbing the
    // questions the student may already be answering.
    hydratePracticeAudio('listening', (c) => {
      const slot = document.getElementById('listeningAudioSlot');
      if (slot) slot.innerHTML = practiceAudioControl(c.audio);
      window._listeningCard = c;
    }, { force: true });
  }
}

/* Short "key language to review" — shown after completion. Deliberately phrases
   only, never the full script (transcriptPolicy: never_display). */
function listeningExtrasHtml() {
  const card = window._listeningCard; if (!card) return '';
  const kl = card.keyLanguageAfterCompletion;
  if (!Array.isArray(kl) || !kl.length) return '';
  return `<div class="mt-3 pt-3" style="border-top:1px solid rgba(6,214,160,.25);">
    <p class="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style="color:var(--navy);">Key language to review</p>
    <div class="space-y-1.5">${kl.map(k => `
      <p class="text-sm" style="color:var(--ink);"><span class="font-semibold" style="color:var(--navy);">“${escapeHtml(k.phrase || '')}”</span>${k.focus ? ` — ${bidiText(k.focus)}` : ''}</p>`).join('')}</div></div>`;
}

/* ── Explore More ── */
/* Explore More is optional and never scored. It shares real, always-valid links
   by building SEARCH URLs from AI-written queries (never invented video/article
   URLs, which are usually dead). Lower levels get one video link; B2+ get a
   second, TED-style link. Every session also gets one article/explanation link. */
function ytSearchUrl(q)   { return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; }
function tedSearchUrl(q)  { return `https://www.ted.com/search?q=${encodeURIComponent(q)}`; }
function webSearchUrl(q)  { return `https://www.google.com/search?q=${encodeURIComponent(q)}`; }

function actExplore() {
  const nb = requireNotebook(); if (!nb) return;
  const card = getCard(nb, 'externalResources') || {};
  const meta = (nb.plan && nb.plan.meta) || {};
  const level = card.cefrLevel || meta.level || 'A1';
  const higher = ['B2', 'C1', 'C2'].includes(level);
  const topic = meta.title || 'this topic';

  // Fall back to topic-derived queries if an older card lacks them.
  const videoQuery = card.videoQuery || `${topic} English conversation practice`;
  const tedQuery = card.tedQuery || `TED talk ${topic}`;
  const articleQuery = card.articleQuery || `${topic} explanation for English learners`;

  const links = [];
  links.push({ icon: '▶️', label: card.videoLabel || `Watch: ${topic}`, sub: 'YouTube video search', url: ytSearchUrl(videoQuery) });
  if (higher) links.push({ icon: '🎤', label: `TED-style talk: ${topic}`, sub: 'TED search', url: tedSearchUrl(tedQuery) });
  links.push({ icon: '📄', label: card.articleLabel || `Read about ${topic}`, sub: 'Article search', url: webSearchUrl(articleQuery) });

  let html = activityHeader('🌐', 'Explore More', 'Optional videos and a short read to go further — not graded.', false);
  if (card.intro) html += `<p class="text-sm mb-3" style="color:var(--ink);">${bidiText(card.intro)}</p>`;
  html += '<div class="space-y-2">';
  links.forEach(l => {
    html += `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-xl p-3" style="background:white; border:1px solid var(--line);">
      <span class="text-xl">${l.icon}</span>
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-semibold" style="color:var(--navy);">${escapeHtml(l.label)}</span>
        <span class="block text-[11px]" style="color:var(--muted);">${escapeHtml(l.sub)} · opens in a new tab</span>
      </span>
      <span style="color:var(--muted);">↗</span>
    </a>`;
  });
  html += '</div>';
  html += `<p class="text-[11px] mt-3" style="color:var(--muted);">These open a fresh search, so the results are always live and working — pick whichever looks most helpful.</p>`;
  showPracticeContent(html);
}