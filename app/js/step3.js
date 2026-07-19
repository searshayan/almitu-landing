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
  return `<div class="expl">${icon} ${escapeHtml(text)}</div>`;
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
}

/* Select a specific session for practice. The Overview is shown by default so
   the student lands on the session summary before choosing an activity. */
function selectSession(id) {
  const s = getState();
  if (!s.savedNotebooks.some(n => n.id === id)) return;
  s.selectedNotebookId = id;
  persistNotebooks();
  document.getElementById('notebookExpanded').classList.add('hidden');
  renderNotebooks();
  if (typeof renderStudentXpBadge === 'function') renderStudentXpBadge();
  actOverview();               // Overview is the default display for a selected session
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
  const cards = bank.items.map(it => {
    const term = it.term;
    const def = `${it.meaning}${l1On && it.l1 ? ' · ' + it.l1 : ''}`;
    return challenge
      ? { front: def, back: term, example: it.example || '' }   // recall the term from its meaning — harder
      : { front: term, back: def, example: it.example || '' };
  });
  if (!cards.length) { showToast('No practice items in this notebook.', 'warn'); return; }

  let html = activityHeader('🃏', 'Flashcards', challenge
    ? `Reversed mode: read the meaning, recall the word. ${cards.length} cards.`
    : `Click any card to flip. ${cards.length} cards from your session.`, challenge);
  // Track which cards have been flipped so a full pass can earn XP.
  window._flashState = { total: cards.length, flipped: new Set(), challenge: !!challenge, recorded: false };

  html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
  cards.forEach((card, i) => {
    html += `
      <div class="flashcard cursor-pointer" onclick="flipCard(this, ${i})" style="height:160px">
        <div class="flashcard-inner w-full h-full">
          <div class="flashcard-front rounded-2xl p-5 flex flex-col items-center justify-center text-center" style="background:white; border:1px solid var(--line);">
            <span class="text-[10px] uppercase tracking-wider mb-2 font-semibold" style="color:var(--muted);">Card ${i + 1} — tap to flip</span>
            <span class="text-lg font-semibold" style="color:var(--navy);">${escapeHtml(card.front)}</span>
          </div>
          <div class="flashcard-back rounded-2xl p-5 flex flex-col items-center justify-center text-center" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.15);">
            <span class="text-sm font-semibold mb-1" style="color:var(--ink);">${escapeHtml(card.back)}</span>
            ${card.example ? `<span class="text-[11px] italic" style="color:var(--muted);">"${escapeHtml(card.example)}"</span>` : ''}
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
  if (bank.items.length < 3) { showToast('Need at least 3 practice items for a quiz.', 'warn'); return; }

  const count = challenge ? Math.min(7, bank.items.length) : Math.min(5, bank.items.length);
  const picks = shuffled(bank.items).slice(0, count);
  const questions = picks.map(item => {
    if (challenge) {
      // reversed: meaning → choose the term
      const distractors = shuffled(bank.items.filter(i => i.term !== item.term)).slice(0, 2).map(i => i.term);
      const options = shuffled([item.term, ...distractors]);
      return { q: `Which word means: "${item.meaning}"?`, options, correct: options.indexOf(item.term), item };
    }
    const distractors = shuffled(bank.items.filter(i => i.term !== item.term)).slice(0, 2).map(i => i.meaning);
    const options = shuffled([item.meaning, ...distractors]);
    return { q: `What does "${item.term}" mean?`, options, correct: options.indexOf(item.meaning), item };
  });

  window._quizQuestions = questions;
  window._quizChallenge = !!challenge;

  let html = activityHeader('❓', 'Quiz', `${questions.length} questions · 3 options each · from "${nb.plan.meta.title}"`, challenge);
  html += '<div class="space-y-4">';
  questions.forEach((q, qi) => {
    html += `
      <div class="rounded-xl p-4" id="qq${qi}" style="background:#F8F9FD; border:1px solid var(--line);">
        <p class="text-sm font-medium mb-3" style="color:var(--navy);">${qi + 1}. ${escapeHtml(q.q)}</p>
        <div class="space-y-2">
          ${q.options.map((opt, oi) => `
            <button onclick="quizAnswer(${qi},${oi},${q.correct})" id="qo${qi}_${oi}"
              class="quiz-option w-full text-left px-4 py-2.5 rounded-xl border text-sm" style="border-color:var(--line); background:white; color:var(--ink);">
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold mr-2" style="background:#F1F2F6; color:var(--muted);">${String.fromCharCode(65 + oi)}</span>
              ${escapeHtml(opt)}
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
    feedback.innerHTML = '<span style="color:#059669;">✓ Correct!</span>' + explainAnswer(nb, item);
    window._quizState.correct++;
  } else {
    selected.classList.add('incorrect');
    correctEl.classList.add('correct');
    feedback.innerHTML = `<span class="text-red-500">✗ Not quite</span> — the answer is <strong style="color:#059669;">${String.fromCharCode(65 + correctIdx)}</strong>.` + explainAnswer(nb, item);
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

let _reorder = null;

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

  _reorder = { sentences, index: 0, score: 0, challenge: !!challenge, nb };
  let html = activityHeader('🔀', 'Reorder', challenge
    ? 'Challenge: the longest sentences from your session. Click the words in order.'
    : 'Click the words in the correct order to rebuild each sentence.', challenge);
  html += `<div id="reorderArea"></div>`;
  showPracticeContent(html);
  renderReorderRound();
  ActivityTimer.start('reorder');
}

function renderReorderRound() {
  const r = _reorder;
  const sentence = r.sentences[r.index];
  const words = sentence.replace(/[.!?]$/, '').split(/\s+/);
  r.target = words.join(' ');
  r.placed = [];
  r.pool = shuffled(words.map((w, i) => ({ w, id: i })));

  document.getElementById('reorderArea').innerHTML = `
    <p class="text-xs mb-2" style="color:var(--muted);">Sentence ${r.index + 1} of ${r.sentences.length} · Score: ${r.score}</p>
    <div id="reorderAnswer" class="reorder-zone mb-3"></div>
    <div id="reorderPool" class="flex flex-wrap gap-2 mb-4"></div>
    <div class="flex gap-2">
      <button onclick="checkReorder()" class="px-4 py-2 rounded-xl text-white text-sm font-semibold" style="background:var(--primary);">Check</button>
      <button onclick="renderReorderRound()" class="px-4 py-2 rounded-xl text-sm font-semibold" style="background:white; border:1px solid var(--line); color:var(--muted);">Reset</button>
    </div>
    <div id="reorderFeedback" class="hidden mt-3 p-3 rounded-xl text-sm"></div>`;
  renderReorderTokens();
}

function renderReorderTokens() {
  const r = _reorder;
  document.getElementById('reorderAnswer').innerHTML = r.placed.length
    ? r.placed.map((t, i) => `<button onclick="unplaceWord(${i})" class="reorder-token placed">${escapeHtml(t.w)}</button>`).join('')
    : '<span class="text-xs self-center px-2" style="color:#B0B5C2;">Click words below to build the sentence…</span>';
  document.getElementById('reorderPool').innerHTML =
    r.pool.map((t, i) => `<button onclick="placeWord(${i})" class="reorder-token">${escapeHtml(t.w)}</button>`).join('');
}

function placeWord(i) { const r = _reorder; r.placed.push(r.pool.splice(i, 1)[0]); renderReorderTokens(); }
function unplaceWord(i) { const r = _reorder; r.pool.push(r.placed.splice(i, 1)[0]); renderReorderTokens(); }

function reorderItemFor(sentence) {
  const bank = getBank(_reorder.nb);
  return bank.items.find(it => sentence.toLowerCase().includes(it.term.toLowerCase()));
}

function checkReorder() {
  const r = _reorder;
  const fb = document.getElementById('reorderFeedback');
  fb.classList.remove('hidden');
  const attempt = r.placed.map(t => t.w).join(' ');
  const item = reorderItemFor(r.target);
  if (attempt === r.target) {
    r.score++;
    fb.style.background = 'rgba(6,214,160,.08)'; fb.style.border = '1px solid rgba(6,214,160,.2)';
    fb.innerHTML = `<span style="color:#059669;" class="font-semibold">✓ Correct!</span> <span style="color:var(--ink);">"${escapeHtml(r.target)}."</span>` + explainAnswer(r.nb, item);
    setTimeout(() => {
      r.index++;
      if (r.index < r.sentences.length) renderReorderRound();
      else {
        const perfect = r.score === r.sentences.length;
        recordActivityCompletion('reorder', r.score, r.sentences.length, r.challenge);
        document.getElementById('reorderArea').innerHTML = `
          <div class="p-6 rounded-2xl text-center" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.2);">
            <p class="text-2xl mb-2">🎉</p>
            <p class="font-bold text-lg" style="color:#059669;">All done! Score: ${r.score}/${r.sentences.length}</p>
            ${completionButtons('actReorder', perfect && r.challenge)}
          </div>`;
      }
    }, 1600);
  } else {
    fb.style.background = 'rgba(239,68,68,.06)'; fb.style.border = '1px solid rgba(239,68,68,.15)';
    fb.innerHTML = `<span class="text-red-500 font-semibold">✗ Not quite.</span> <span style="color:var(--ink);">Try a different order.</span>` + explainAnswer(r.nb, item);
  }
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
    fb.innerHTML = '<span style="color:#059669;">✓ Correct!</span>' + explainAnswer(nb, item);
    window._gapState.correct++;
  } else {
    selected.classList.add('incorrect');
    correctEl.classList.add('correct');
    fb.innerHTML = `<span class="text-red-500">✗ The answer was "${escapeHtml(correctEl.textContent.trim())}"</span>` + explainAnswer(nb, item);
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
  let candidates = bank.items.filter(i => challenge ? (i.example && i.example.toLowerCase().includes(i.term.toLowerCase())) : i.meaning);
  const maxPairs = challenge ? 8 : 5;
  const pairs = shuffled(candidates).slice(0, Math.min(maxPairs, candidates.length));
  if (pairs.length < 3) { showToast('Need at least 3 items for matching.', 'warn'); return; }

  const rightText = it => challenge
    ? it.example.replace(new RegExp(it.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____')
    : it.meaning;

  _match = {
    nb, pairs, challenge: !!challenge,
    left: shuffled(pairs.map((p, i) => ({ text: p.term, pair: i }))),
    right: shuffled(pairs.map((p, i) => ({ text: rightText(p), pair: i }))),
    selectedLeft: null, matched: new Set(), attempts: 0
  };

  let html = activityHeader('🔗', 'Matching', challenge
    ? `Challenge: match each word to the sentence it completes. ${pairs.length} pairs.`
    : 'Click a word, then click its meaning. Match all pairs.', challenge);
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
    return `<button onclick="pickRight(${i})" class="match-token w-full ${done ? 'done' : ''}" ${done ? 'disabled' : ''}>${escapeHtml(it.text)}</button>`;
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
    : '<span class="text-red-500 font-semibold">✗ Not a match.</span>') + explainAnswer(_match.nb, item);
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