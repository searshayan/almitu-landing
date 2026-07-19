/* ═══════════════════════════════════════════════════════
   Almitu Pro — Curriculum pre-generation (admin only)

   Generates the CEFR micro-curriculum once, into shared
   `session_plans` rows (is_curriculum = true), so tutors load a
   ready session instead of paying to generate one every time.

   It drives the SAME pipeline the live prep engine uses
   (generateSlides → renderAllSlides → generatePracticeBank, see
   generatePlan() in step1.js), so a curriculum session is
   structurally identical to one a tutor generates. Nothing about
   the render templates is duplicated here.
   ═══════════════════════════════════════════════════════ */

window.curriculumState = {
  level: 'Pre-A1',
  sessions: [],          // curriculum records from the JSON
  status: {},            // curriculum_id → 'pending' | 'running' | 'done' | 'failed'
  errors: {},            // curriculum_id → message
  running: false,
  cancel: false,
  loaded: false
};

/* Curriculum sessions are student-agnostic templates: no student, no
   country, and NO L1 support (tutors deliver L1 live, and pre-generated
   content can't know a student's first language). */
function curriculumFormData(rec) {
  const details = {};

  if (rec.skill === 'vocabulary') {
    details.vocabTheme       = rec.title;
    details.targetVocab      = (rec.words || []).join(', ');
    details.objective        = rec.objective || '';
    details.realWorldContext = rec.context || '';
    details.personalization  = '';
    details.notes            = rec.notes || '';
  } else if (rec.skill === 'grammar') {
    details.grammarTitle     = rec.title;
    details.grammarStructure = rec.structure || '';
    details.objective        = rec.objective || '';
    details.exampleSentences = '';
    details.commonErrors     = '';
    details.notes            = [rec.context, rec.notes].filter(Boolean).join(' — ');
  } else {
    details.scenarioTitle    = rec.title;
    details.objective        = rec.objective || '';
    details.targetExpressions = (rec.expressions || []).join('\n');
    // The curriculum's own "Speaking Activity Type" is free text with 60+
    // variants; the app's field is a fixed list. Role-play covers the
    // guided-dialogue shape used across Pre-A1.
    details.speakingActivity = 'Role-play';
    details.roles            = '';
    details.culturalNotes    = '';
    details.notes            = [rec.functions, rec.notes].filter(Boolean).join(' — ');
  }

  return {
    studentName: 'the student',
    language: '',
    countryOfResident: '',
    l1Support: false,
    level: rec.level,
    tier: tierForLevel(rec.level),
    sessionType: rec.skill,
    duration: 25,
    details
  };
}

/* ─────────── Loading ─────────── */

async function loadCurriculumLevel(level) {
  const cs = window.curriculumState;
  cs.level = level;
  const slug = level.toLowerCase();               // 'Pre-A1' → 'pre-a1'
  const res = await fetch(`curriculum/${slug}.json`);
  if (!res.ok) throw new Error(`Could not load curriculum/${slug}.json (${res.status})`);
  const data = await res.json();
  cs.sessions = data.sessions || [];

  // Resumability: anything already generated is marked done and skipped.
  const existing = await dataListCurriculumIds();
  cs.status = {};
  cs.errors = {};
  cs.sessions.forEach(r => { cs.status[r.curriculum_id] = existing.has(r.curriculum_id) ? 'done' : 'pending'; });
  cs.loaded = true;
  return cs.sessions;
}

/* ─────────── Generation ─────────── */

/* Generate ONE curriculum session and store it. Mirrors generatePlan(). */
async function generateCurriculumSession(rec) {
  const formData = curriculumFormData(rec);

  const result = await generateSlides(formData);
  const ctx = { tier: formData.tier, l1Support: formData.l1Support, language: formData.language };
  const slides = renderAllSlides(result.content, ctx);

  const plan = {
    meta: {
      title: rec.title,
      student: formData.studentName,
      language: formData.language,
      countryOfResident: formData.countryOfResident,
      level: formData.level,
      tier: formData.tier,
      duration: formData.duration,
      sessionType: formData.sessionType,
      renderId: renderIdFor(formData.sessionType, formData.tier),
      curriculumId: rec.curriculum_id
    },
    formData,
    fingerprint: computeFingerprint(formData),
    content: result.content,
    slides,
    engineUsed: result.engineUsed,
    practiceReady: false,
    practiceGenerating: false
  };

  // Post-session practice is part of the deliverable — a curriculum plan is
  // only useful if its activities are ready too.
  plan.content.practice_bank = await generatePracticeBank(formData, slides);
  plan.practiceReady = true;

  await dataCreateCurriculumPlan({
    tutor_id: null,
    is_curriculum: true,
    curriculum_id: rec.curriculum_id,
    title: rec.title,
    session_type: formData.sessionType,
    level: formData.level,
    duration: formData.duration,
    plan
  });

  return plan;
}

/* Run the whole level, sequentially, skipping anything already done. */
async function runCurriculumGeneration() {
  const cs = window.curriculumState;
  if (cs.running) return;

  // The Demo engine emits rule-based placeholder text. Generating the whole
  // curriculum with it would silently fill the shared library with junk.
  if (getConfig().engine === 'demo') {
    showToast('Switch to the Claude API in AI Settings first — the Demo engine only produces placeholder content.', 'error');
    return;
  }

  cs.running = true;
  cs.cancel = false;
  renderCurriculumTab();

  const pending = cs.sessions.filter(r => cs.status[r.curriculum_id] !== 'done');
  let ok = 0, failed = 0;

  for (const rec of pending) {
    if (cs.cancel) break;
    cs.status[rec.curriculum_id] = 'running';
    delete cs.errors[rec.curriculum_id];
    renderCurriculumTab();
    try {
      await generateCurriculumSession(rec);
      cs.status[rec.curriculum_id] = 'done';
      ok++;
    } catch (e) {
      // One failure must not abort the run — record it and keep going.
      console.error('curriculum generation failed for', rec.curriculum_id, e);
      cs.status[rec.curriculum_id] = 'failed';
      cs.errors[rec.curriculum_id] = e.message || String(e);
      failed++;
    }
    renderCurriculumTab();
  }

  cs.running = false;
  renderCurriculumTab();
  showToast(
    cs.cancel ? `Stopped — ${ok} generated, ${failed} failed.`
              : `Done — ${ok} generated${failed ? `, ${failed} failed` : ''}.`,
    failed ? 'warn' : 'success'
  );
}

function cancelCurriculumGeneration() {
  window.curriculumState.cancel = true;
  showToast('Stopping after the current session…', 'info');
}

/* Retry a single failed session. */
async function retryCurriculumSession(id) {
  const cs = window.curriculumState;
  const rec = cs.sessions.find(r => r.curriculum_id === id);
  if (!rec || cs.running) return;
  cs.status[id] = 'running';
  renderCurriculumTab();
  try {
    await generateCurriculumSession(rec);
    cs.status[id] = 'done';
    delete cs.errors[id];
    showToast(`${id} generated.`, 'success');
  } catch (e) {
    cs.status[id] = 'failed';
    cs.errors[id] = e.message || String(e);
    showToast(`${id} failed: ${e.message}`, 'error');
  }
  renderCurriculumTab();
}

/* ─────────── Admin tab UI ─────────── */

/* Re-render only if the admin is still on the Curriculum tab (the generator
   loop calls this repeatedly; the admin may have navigated away). */
function renderCurriculumTab() {
  if (typeof adminActiveTab !== 'undefined' && adminActiveTab === 'curriculum') renderAdmin();
}

const CURRICULUM_STATUS = {
  pending: ['rgba(29,33,41,.05)', 'var(--muted)', 'Pending'],
  running: ['rgba(255,210,63,.18)', '#B45309', 'Generating…'],
  done:    ['rgba(6,214,160,.12)', '#059669', '✓ Done'],
  failed:  ['rgba(239,68,68,.1)', '#B91C1C', 'Failed']
};

function renderCurriculumTabBody() {
  const cs = window.curriculumState;

  // Lazy-load the level's JSON the first time the tab is opened.
  if (!cs.loaded) {
    loadCurriculumLevel(cs.level)
      .then(renderCurriculumTab)
      .catch(e => {
        document.getElementById('viewAdmin').innerHTML =
          `<div class="card-surface rounded-2xl p-8 text-center text-sm" style="color:#B91C1C;">Could not load curriculum: ${escapeHtml(e.message)}</div>`;
      });
    return '<div class="text-center py-16 text-sm" style="color:var(--muted);">Loading curriculum…</div>';
  }

  const total = cs.sessions.length;
  const done  = cs.sessions.filter(r => cs.status[r.curriculum_id] === 'done').length;
  const failed = cs.sessions.filter(r => cs.status[r.curriculum_id] === 'failed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isDemo = getConfig().engine === 'demo';

  const engineWarning = isDemo ? `
    <div class="mb-4 px-4 py-3 rounded-xl text-sm" style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);color:#B91C1C;">
      <strong>Demo engine is active.</strong> It produces placeholder content, so generation is blocked.
      Switch to the Claude API under <strong>AI Settings</strong> first.
    </div>` : '';

  const controls = cs.running
    ? `<button onclick="cancelCurriculumGeneration()" class="px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style="background:#EF4444;">Stop after current</button>`
    : `<button onclick="runCurriculumGeneration()" ${isDemo ? 'disabled' : ''}
         class="px-4 py-2.5 rounded-xl text-white text-sm font-semibold ${isDemo ? 'opacity-50 cursor-not-allowed' : 'glow-primary'}"
         style="background:linear-gradient(135deg, #FF6B35, #E85A2A);">
         ${done ? `Generate remaining (${total - done})` : `Generate all ${total}`}
       </button>`;

  const rows = cs.sessions.map(r => {
    const st = cs.status[r.curriculum_id] || 'pending';
    const [bg, color, label] = CURRICULUM_STATUS[st];
    const err = cs.errors[r.curriculum_id];
    const actions = [];
    if (st === 'done')   actions.push(`<button onclick="viewCurriculumSession('${r.curriculum_id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style="background:white;border:1px solid var(--line);color:var(--muted);">View</button>`);
    if (st === 'failed' && !cs.running) actions.push(`<button onclick="retryCurriculumSession('${r.curriculum_id}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white" style="background:var(--primary);">Retry</button>`);
    return `
      <tr style="border-top:1px solid var(--line);">
        <td class="py-2.5 pr-3 font-mono text-[11px]" style="color:var(--muted);">${escapeHtml(r.curriculum_id)}</td>
        <td class="py-2.5 pr-3">
          <div class="text-sm font-medium" style="color:var(--navy);">${escapeHtml(r.title)}</div>
          ${err ? `<div class="text-[10px] mt-0.5" style="color:#B91C1C;">${escapeHtml(err)}</div>` : ''}
        </td>
        <td class="py-2.5 pr-3"><span class="text-[10px] px-1.5 py-0.5 rounded" style="background:rgba(0,78,137,.06);color:var(--secondary);">${escapeHtml(getSessionType(r.skill).label)}</span></td>
        <td class="py-2.5 pr-3"><span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background:${bg};color:${color};">${label}</span></td>
        <td class="py-2.5"><div class="flex gap-1.5">${actions.join('')}</div></td>
      </tr>`;
  }).join('');

  return `
    ${engineWarning}
    <div class="card-surface rounded-2xl p-5 mb-4">
      <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 class="text-sm font-semibold" style="color:var(--navy);">📚 CEFR Curriculum — ${escapeHtml(cs.level)}</h2>
          <p class="text-xs mt-0.5" style="color:var(--muted);">
            Generated once and shared with every tutor. Safe to stop and resume — finished sessions are skipped.
          </p>
        </div>
        ${controls}
      </div>
      <div class="h-2 rounded-full overflow-hidden mb-2" style="background:rgba(29,33,41,.06);">
        <div class="h-full transition-all duration-500" style="width:${pct}%; background:linear-gradient(90deg, #FF6B35, #FFD23F);"></div>
      </div>
      <p class="text-xs" style="color:var(--muted);">
        <strong style="color:var(--navy);">${done} / ${total}</strong> generated${failed ? ` · <span style="color:#B91C1C;">${failed} failed</span>` : ''}
      </p>
    </div>

    <div class="card-surface rounded-2xl p-5 overflow-x-auto">
      <table class="w-full text-left" style="min-width:640px;">
        <thead><tr class="text-[10px] uppercase tracking-wide" style="color:var(--muted);">
          <th class="pb-2 font-semibold">ID</th><th class="pb-2 font-semibold">Session</th>
          <th class="pb-2 font-semibold">Type</th><th class="pb-2 font-semibold">Status</th><th class="pb-2 font-semibold">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* Review surface: render a stored curriculum plan's slides. */
async function viewCurriculumSession(id) {
  try {
    const row = await dataGetCurriculumPlan(id);
    if (!row || !row.plan) { showToast('Not generated yet.', 'warn'); return; }
    const plan = row.plan;
    const slides = (plan.slides || []).map(sl => `
      <div class="mb-4">
        <p class="text-[10px] uppercase tracking-wider font-semibold mb-1" style="color:var(--primary);">${sl.icon || ''} ${escapeHtml(sl.label || '')}</p>
        <div class="slide-card p-4">${sl.html}</div>
      </div>`).join('');
    const bank = (plan.content && plan.content.practice_bank) || {};
    showModal(`
      <h3 class="text-lg font-display font-bold mb-1" style="color:var(--navy);">${escapeHtml(plan.meta.title)}</h3>
      <p class="text-xs mb-4" style="color:var(--muted);">
        ${escapeHtml(id)} · ${plan.meta.level} · ${escapeHtml(getSessionType(plan.meta.sessionType).label)} ·
        ${plan.meta.duration}min · ${(plan.slides || []).length} slides ·
        ${(bank.items || []).length} practice items · ${escapeHtml(plan.engineUsed || '')}
      </p>
      <div class="max-h-[60vh] overflow-y-auto">${slides}</div>`);
  } catch (e) {
    showToast('Could not load: ' + e.message, 'error');
  }
}
