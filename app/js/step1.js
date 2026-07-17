/* ═══════════════════════════════════════════════════════
   Almitu Pro — Step 1: Tutor Prep Engine
   Form flow: student → language → L1 support → level
   (auto-tier) → 25 min → session type → dynamic fields →
   generate → REVIEW & EDIT slides → launch
   ═══════════════════════════════════════════════════════ */

/* ─── L1 Support toggle (tier-gated) ─── */

function setL1Visual(yes) {
  const yBtn = document.getElementById('l1Yes');
  const nBtn = document.getElementById('l1No');
  [ [yBtn, yes], [nBtn, !yes] ].forEach(([btn, active]) => {
    if (!btn) return;
    btn.style.background = active ? 'var(--secondary)' : 'white';
    btn.style.color = active ? 'white' : 'var(--muted)';
    btn.style.borderColor = active ? 'var(--secondary)' : 'var(--line)';
  });
}

function setL1Support(yes) {
  const tier = tierForLevel(document.getElementById('inputLevel').value);
  if (!l1Allowed(tier)) {
    showToast('L1 support is unavailable for Proficiency sessions.', 'info');
    return;
  }
  getState().studentProfile.l1Support = yes;
  setL1Visual(yes);
  markContentDirty();
}

/* Proficiency → force L1 off, disable the control, show microcopy. */
function applyL1Gating() {
  const tier = tierForLevel(document.getElementById('inputLevel').value);
  const allowed = l1Allowed(tier);
  const yBtn = document.getElementById('l1Yes');
  const nBtn = document.getElementById('l1No');
  const micro = document.getElementById('l1Microcopy');
  [yBtn, nBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = !allowed;
    btn.style.opacity = allowed ? '1' : '0.4';
    btn.style.cursor = allowed ? 'pointer' : 'not-allowed';
  });
  if (!allowed) {
    getState().studentProfile.l1Support = false;
    setL1Visual(false);
    if (micro) { micro.textContent = 'L1 support is unavailable for Proficiency sessions.'; micro.classList.remove('hidden'); }
  } else {
    if (micro) micro.classList.add('hidden');
    setL1Visual(getState().studentProfile.l1Support);
  }
}

/* ─── Duration (first-class generation driver) ─── */

function setDuration(mins) {
  getState().sessionDuration = Number(mins);
  ['15', '25'].forEach(m => {
    const btn = document.getElementById('dur' + m);
    if (!btn) return;
    const active = String(mins) === m;
    btn.style.background = active ? 'var(--secondary)' : 'white';
    btn.style.color = active ? 'white' : 'var(--muted)';
    btn.style.borderColor = active ? 'var(--secondary)' : 'var(--line)';
  });
  markContentDirty();
}

/* ─── Level → Tier ─── */

function populateLevels() {
  const sel = document.getElementById('inputLevel');
  sel.innerHTML = LEVELS.map(l => `<option value="${l.value}" ${l.value === 'A1' ? 'selected' : ''}>${l.label}</option>`).join('');
}

function updateTierBadge() {
  const level = document.getElementById('inputLevel').value;
  const tier = getTier(tierForLevel(level));
  const badge = document.getElementById('tierBadge');
  badge.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="text-xs font-bold font-display" style="color:${tier.color};">${tier.label} Tier</span>
      <span class="text-[10px]" style="color:var(--muted);">${tier.levels}</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background:white; border:1px solid ${tier.border}; color:${tier.color};">${renderIdFor(getState().sessionType, tier.key)}</span>
    </div>
    <p class="text-[11px] leading-snug" style="color:var(--muted);">${tier.desc}</p>`;
  badge.style.background = tier.bg;
  badge.style.borderColor = tier.border;
  applyL1Gating();          // tier may forbid L1
  markContentDirty();       // level/tier is a content-driving change
}

/* ─── Generation fingerprint & staleness ─── */

function collectDetailsLite() {
  const type = getSessionType(getState().sessionType);
  const details = {};
  type.fields.forEach(f => {
    const el = document.getElementById('fld_' + f.id);
    details[f.id] = el ? el.value.trim() : '';
  });
  return details;
}

function liveFormData() {
  const level = document.getElementById('inputLevel').value;
  return {
    studentName: (document.getElementById('inputName').value || '').trim(),
    language: document.getElementById('inputLang').value,
    countryOfResident: (document.getElementById('inputCountry')?.value || '').trim(),
    l1Support: getState().studentProfile.l1Support,
    level,
    tier: tierForLevel(level),
    sessionType: getState().sessionType,
    duration: getState().sessionDuration,
    details: collectDetailsLite()
  };
}

function setGenStatus(kind) {
  const el = document.getElementById('genStatus');
  if (!el) return;
  const map = {
    ready:   { text: 'Ready for autofill', bg: 'rgba(0,78,137,.06)', color: 'var(--secondary)', border: 'rgba(0,78,137,.15)', btn: false },
    current: { text: '● Generated content is current', bg: 'rgba(6,214,160,.1)', color: '#059669', border: 'rgba(6,214,160,.25)', btn: false },
    stale:   { text: '▲ Generated content is stale — core inputs changed', bg: 'rgba(255,107,53,.1)', color: 'var(--primary)', border: 'rgba(255,107,53,.3)', btn: true }
  };
  const s = map[kind] || map.ready;
  el.innerHTML = `<span class="text-[11px] font-semibold" style="color:${s.color};">${s.text}</span>` +
    (s.btn ? `<button onclick="regeneratePlan()" class="ml-2 text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style="background:var(--primary);">Regenerate</button>` : '');
  el.style.background = s.bg;
  el.style.borderColor = s.border;
  el.classList.remove('hidden');
}

function refreshGenerationStatus() {
  const s = getState();
  if (!s.generatedLessonPlan) { setGenStatus('ready'); return; }
  const current = computeFingerprint(liveFormData());
  s.generation.stale = (current !== s.generation.fingerprint);
  setGenStatus(s.generation.stale ? 'stale' : 'current');
  // reflect staleness in the preview header badge if visible
  if (document.getElementById('outputPlan') && !document.getElementById('outputPlan').classList.contains('hidden')) {
    renderPlanPreview();
  }
}

function markContentDirty() { refreshGenerationStatus(); }

function regeneratePlan() { generatePlan(); }

/* ─── Session Type selector + dynamic fields ─── */

function renderSessionTypeSelector() {
  const container = document.getElementById('sessionTypeGrid');
  container.innerHTML = getAllSessionTypes().map(t => `
    <button onclick="selectSessionType('${t.key}')" id="st_${t.key}"
      class="session-type-btn flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center"
      style="border-color:var(--line); color:var(--muted);">
      <span class="st-icon">${t.icon}</span>
      <span class="text-[11px] font-semibold leading-tight">${t.label}</span>
    </button>`).join('');
}

function selectSessionType(key) {
  getState().sessionType = key;
  document.querySelectorAll('.session-type-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('st_' + key);
  if (activeBtn) activeBtn.classList.add('active');
  renderDynamicFields(key);
  updateTierBadge();
}

function renderDynamicFields(typeKey) {
  const type = getSessionType(typeKey);
  const container = document.getElementById('dynamicFields');

  const fieldBlocks = type.fields.map(f => {
    const req = f.required ? '<span style="color:var(--primary);">*</span>' : '<span class="text-[10px] font-normal" style="color:var(--muted);"> (optional)</span>';
    let input;
    if (f.type === 'textarea') {
      input = `<textarea id="fld_${f.id}" rows="${f.rows || 2}" placeholder="${escapeHtml(f.placeholder || '')}"
        class="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-all field-input" oninput="${f.counter ? 'updateVocabCounter(this); ' : ''}markContentDirty()"></textarea>`;
    } else if (f.type === 'select') {
      input = `<select id="fld_${f.id}" onchange="markContentDirty()" class="w-full rounded-xl px-4 py-3 text-sm appearance-none cursor-pointer focus:outline-none field-input">
        ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
    } else {
      input = `<input id="fld_${f.id}" type="text" placeholder="${escapeHtml(f.placeholder || '')}" oninput="markContentDirty()"
        class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all field-input">`;
    }
    return `
      <div>
        <div class="flex items-center justify-between">
          <label class="block text-xs font-medium mb-1.5" style="color:var(--muted);">${f.label} ${req}</label>
          ${f.counter ? '<span class="text-[10px] font-semibold mb-1.5" id="vocabCounter" style="color:var(--muted);">0 items</span>' : ''}
        </div>
        ${input}
        ${f.hint ? `<p class="text-[10px] mt-1" style="color:#B0B5C2;">${f.hint}</p>` : ''}
        <p class="text-[10px] mt-0.5 hidden field-error" id="err_${f.id}" style="color:#EF4444;"></p>
      </div>`;
  });

  // Auto-fill button sits right after the first (title/theme) field
  const autofillBtn = `
    <button onclick="autofillForm()" id="autofillBtn"
      class="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
      style="border:1.5px dashed rgba(255,107,53,.4); color:var(--primary); background:rgba(255,107,53,.04);"
      onmouseover="this.style.background='rgba(255,107,53,.09)'" onmouseout="this.style.background='rgba(255,107,53,.04)'">
      ✨ Auto-fill remaining fields <span class="text-[10px] font-normal" style="color:var(--muted);">— calibrated to level &amp; tier</span>
    </button>`;

  container.innerHTML = fieldBlocks[0] + autofillBtn + fieldBlocks.slice(1).join('');
}

/* ─── Auto-fill ─── */

async function autofillForm() {
  const s = getState();
  const type = getSessionType(s.sessionType);
  const firstField = type.fields[0];
  const firstEl = document.getElementById('fld_' + firstField.id);
  const title = firstEl.value.trim();

  if (!title) {
    showToast(`Write the ${firstField.label} first — auto-fill builds everything from it.`, 'warn');
    firstEl.focus();
    firstEl.style.borderColor = 'var(--primary)';
    return;
  }

  const level = document.getElementById('inputLevel').value;
  const meta = {
    studentName: document.getElementById('inputName').value.trim() || 'the student',
    language: document.getElementById('inputLang').value,
    countryOfResident: (document.getElementById('inputCountry')?.value || '').trim(),
    l1Support: s.studentProfile.l1Support,
    level,
    tier: tierForLevel(level),
    sessionType: s.sessionType,
    duration: s.sessionDuration,
    title,
    firstFieldLabel: firstField.label
  };

  const fieldsToFill = type.fields.slice(1);
  const btn = document.getElementById('autofillBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="animate-pulse">✨ Calibrating suggestions to ' + meta.level + ' · ' + meta.duration + 'min…</span>';

  // A field is safe to (re)fill if it's empty OR still holds the value we auto-filled
  // last time (i.e. the tutor hasn't manually edited it). This lets a level/duration
  // change refresh suggestions while preserving manual edits.
  const rec = (_autofillRecord && _autofillRecord.values) || {};

  try {
    const fills = await autofillFields(meta, fieldsToFill);
    let filled = 0, preserved = 0;
    const newValues = {};
    fieldsToFill.forEach(f => {
      const el = document.getElementById('fld_' + f.id);
      if (!el || !fills[f.id]) return;
      const cur = el.value.trim();
      const untouchedAutofill = cur && rec[f.id] && cur === rec[f.id];
      if (!cur || untouchedAutofill) {
        el.value = String(fills[f.id]);
        newValues[f.id] = String(fills[f.id]);
        if (f.counter) updateVocabCounter(el);
        filled++;
      } else if (cur) {
        preserved++;
      }
    });
    _autofillRecord = { fingerprint: computeFingerprint(liveFormData()), values: { ...rec, ...newValues } };
    showToast(filled
      ? `${filled} field${filled === 1 ? '' : 's'} auto-filled for ${meta.level} (${meta.duration}min)${preserved ? ` · ${preserved} manual edit${preserved === 1 ? '' : 's'} kept` : ''}.`
      : 'All fields already had manual content — nothing was overwritten.', filled ? 'success' : 'info');
    markContentDirty();
  } catch (e) {
    showToast('Auto-fill failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

let _autofillRecord = null;   // { fingerprint, values:{fieldId:value} } — tracks auto-suggested (untouched) fields

function updateVocabCounter(el) {
  const n = el.value.split(',').map(s => s.trim()).filter(Boolean).length;
  const counter = document.getElementById('vocabCounter');
  if (!counter) return;
  counter.textContent = `${n} item${n === 1 ? '' : 's'}`;
  counter.style.color = (n >= 6 && n <= 12) ? '#059669' : (n > 0 ? '#EF4444' : 'var(--muted)');
}

/* ─── Collect + validate ─── */

function collectFormData() {
  const s = getState();
  const type = getSessionType(s.sessionType);
  let valid = true;
  const details = {};

  type.fields.forEach(f => {
    const el = document.getElementById('fld_' + f.id);
    const errEl = document.getElementById('err_' + f.id);
    const val = el ? el.value.trim() : '';
    details[f.id] = val;
    errEl.classList.add('hidden');
    el.style.borderColor = 'var(--line)';

    if (f.required && !val) {
      errEl.textContent = 'This field is required.';
      errEl.classList.remove('hidden');
      el.style.borderColor = '#EF4444';
      valid = false;
    }
    if (f.counter && val) {
      const n = val.split(',').map(x => x.trim()).filter(Boolean).length;
      if (n < 6 || n > 12) {
        errEl.textContent = `Provide between 6 and 12 items (currently ${n}).`;
        errEl.classList.remove('hidden');
        el.style.borderColor = '#EF4444';
        valid = false;
      }
    }
  });

  if (!valid) { showToast('Please complete the highlighted fields.', 'error'); return null; }

  const level = document.getElementById('inputLevel').value;
  s.studentProfile.name = document.getElementById('inputName').value.trim() || 'Student';
  s.studentProfile.language = document.getElementById('inputLang').value;
  s.studentProfile.countryOfResident = (document.getElementById('inputCountry')?.value || '').trim();
  s.studentProfile.level = level;

  const tier = tierForLevel(level);
  // Enforce the L1 rule at the data layer too (Proficiency never carries L1).
  const l1Support = l1Allowed(tier) ? s.studentProfile.l1Support : false;

  return {
    studentName: s.studentProfile.name,
    language: s.studentProfile.language,
    countryOfResident: s.studentProfile.countryOfResident,
    l1Support,
    level,
    tier,
    sessionType: s.sessionType,
    duration: s.sessionDuration,
    details
  };
}

/* ─── Generation flow ─── */

let _loadingTimer = null;

function startLoadingAnim(engineLabel) {
  document.getElementById('outputPlaceholder').classList.add('hidden');
  document.getElementById('outputPlan').classList.add('hidden');
  document.getElementById('outputLoading').classList.remove('hidden');
  document.getElementById('btnGenerate').disabled = true;
  document.getElementById('btnGenerate').classList.add('opacity-50', 'cursor-not-allowed');
  document.getElementById('loadingEngine').textContent = engineLabel;

  const steps = ['ls1', 'ls2', 'ls3', 'ls4'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('text-green-600'); el.classList.add('text-gray-400');
    el.querySelector('.loading-check').classList.add('hidden');
  });
  let i = 0;
  _loadingTimer = setInterval(() => {
    if (i < steps.length - 1) { // hold last step until generation resolves
      const el = document.getElementById(steps[i]);
      el.classList.remove('text-gray-400'); el.classList.add('text-green-600');
      el.querySelector('.loading-check').classList.remove('hidden');
      i++;
    }
  }, 900);
}

function stopLoadingAnim() {
  clearInterval(_loadingTimer);
  ['ls1', 'ls2', 'ls3', 'ls4'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('text-gray-400'); el.classList.add('text-green-600');
    el.querySelector('.loading-check').classList.remove('hidden');
  });
  setTimeout(() => {
    document.getElementById('outputLoading').classList.add('hidden');
    document.getElementById('btnGenerate').disabled = false;
    document.getElementById('btnGenerate').classList.remove('opacity-50', 'cursor-not-allowed');
  }, 350);
}

async function generatePlan() {
  const formData = collectFormData();
  if (!formData) return;

  const st0 = getState();
  const fp = computeFingerprint(formData);
  // Feedback 3: identical content fingerprint → REUSE, don't regenerate. Only the
  // instance (student name) may differ, and that is not content-driving.
  if (st0.generatedLessonPlan && st0.generatedLessonPlan.fingerprint === fp) {
    st0.generatedLessonPlan.meta.student = formData.studentName;
    st0.generatedLessonPlan.formData.studentName = formData.studentName;
    st0.generation.stale = false;
    renderPlanPreview();
    document.getElementById('outputPlan').classList.remove('hidden');
    setGenStatus('current');
    showToast('Content reused — inputs match the last generation (student name is instance-only, no re-run needed).', 'info');
    return;
  }

  const cfg = getConfig();
  const engineLabels = { demo: 'Demo Engine (rule-based)', claude: 'Claude API — ' + (cfg.claudeModel || ''), custom: 'Custom API' };
  startLoadingAnim(engineLabels[cfg.engine] || 'Demo Engine');

  try {
    // PHASE 1: slides only — fast, so the tutor can review/edit without waiting.
    const result = await generateSlides(formData);
    const ctx = { tier: formData.tier, l1Support: formData.l1Support, language: formData.language };
    const slides = renderAllSlides(result.content, ctx);

    const fingerprint = computeFingerprint(formData);
    const plan = {
      meta: {
        title: formData.details.vocabTheme || formData.details.grammarTitle || formData.details.scenarioTitle || 'Session',
        student: formData.studentName, language: formData.language,
        countryOfResident: formData.countryOfResident, level: formData.level,
        tier: formData.tier, duration: formData.duration, sessionType: formData.sessionType,
        renderId: renderIdFor(formData.sessionType, formData.tier)
      },
      formData,
      fingerprint,
      content: result.content,        // { slides } — practice_bank added later (Phase 2)
      slides,
      engineUsed: result.engineUsed,
      practiceReady: false,           // post-session not generated yet
      practiceGenerating: false
    };
    const st = getState();
    st.generatedLessonPlan = plan;
    st.previewSlide = 0;
    st.generation.fingerprint = fingerprint;
    st.generation.stale = false;

    // This is brand-new content — unlink it from any library plan that was
    // loaded before, so saving/starting creates a NEW library entry.
    if (window.tutorState) { tutorState.currentPlanId = null; tutorState.currentSessionId = null; }

    stopLoadingAnim();
    if (result.warning) showToast(result.warning, 'warn');
    setTimeout(() => {
      renderPlanPreview();
      document.getElementById('outputPlan').classList.remove('hidden');
      setGenStatus('current');
    }, 380);
  } catch (e) {
    stopLoadingAnim();
    showToast('Generation failed: ' + e.message, 'error');
    setTimeout(() => document.getElementById('outputPlaceholder').classList.remove('hidden'), 380);
  }
}

/* ─── Review & Edit carousel ─── */

let _editMode = false;

function renderPlanPreview() {
  const s = getState();
  const plan = s.generatedLessonPlan;
  if (!plan) return;
  const idx = s.previewSlide;
  const slide = plan.slides[idx];
  const tier = getTier(plan.meta.tier);

  const stale = getState().generation.stale;
  const statusBadge = stale
    ? '<span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(255,107,53,.12); color:var(--primary);">Stale</span>'
    : '<span class="text-[9px] px-2 py-0.5 rounded-full font-semibold" style="background:rgba(6,214,160,.1); color:#059669;">Current</span>';
  document.getElementById('pvHeader').innerHTML = `
    <div>
      <h3 class="text-base font-bold font-display" style="color:var(--navy);">${plan.meta.duration}-Min Session Deck</h3>
      <p class="text-[11px]" style="color:var(--muted);">${escapeHtml(plan.meta.title)} · ${plan.meta.level} · ${escapeHtml(plan.engineUsed)}</p>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="text-[9px] px-2 py-0.5 rounded-full font-bold font-mono" style="background:${tier.bg}; color:${tier.color}; border:1px solid ${tier.border};">${plan.meta.renderId} · ${plan.meta.duration}m</span>
      ${statusBadge}
    </div>`;

  document.getElementById('pvLabel').textContent = `${slide.icon} ${slide.label}`;
  document.getElementById('pvCounter').textContent = `${idx + 1} / ${plan.slides.length}`;
  document.getElementById('pvPrev').disabled = idx === 0;
  document.getElementById('pvNext').disabled = idx === plan.slides.length - 1;

  const content = document.getElementById('pvContent');
  content.innerHTML = slide.html;
  content.contentEditable = 'false';
  content.classList.remove('editing');
  _editMode = false;
  updateEditButton();

  document.getElementById('pvDots').innerHTML = plan.slides.map((sl, i) =>
    `<button onclick="pvGoTo(${i})" class="slide-dot ${i === idx ? 'active' : ''}" title="${escapeHtml(sl.label)}"></button>`).join('');
}

function pvGoTo(i) {
  if (_editMode) savePvEdit();
  getState().previewSlide = i;
  renderPlanPreview();
}
function pvNextSlide() { const s = getState(); if (s.previewSlide < s.generatedLessonPlan.slides.length - 1) pvGoTo(s.previewSlide + 1); }
function pvPrevSlide() { const s = getState(); if (s.previewSlide > 0) pvGoTo(s.previewSlide - 1); }

function toggleEdit() {
  const content = document.getElementById('pvContent');
  if (_editMode) {
    savePvEdit();
    renderPlanPreview();
    showToast('Slide saved.', 'success');
  } else {
    _editMode = true;
    content.contentEditable = 'true';
    content.classList.add('editing');
    content.focus();
    updateEditButton();
  }
}

function savePvEdit() {
  const s = getState();
  const content = document.getElementById('pvContent');
  s.generatedLessonPlan.slides[s.previewSlide].html = content.innerHTML;
  content.contentEditable = 'false';
  content.classList.remove('editing');
  _editMode = false;
}

function updateEditButton() {
  const btn = document.getElementById('pvEditBtn');
  btn.innerHTML = _editMode
    ? '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Save'
    : '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> Edit';
  btn.style.background = _editMode ? 'var(--success)' : 'white';
  btn.style.color = _editMode ? 'white' : 'var(--ink)';
  btn.style.borderColor = _editMode ? 'var(--success)' : 'var(--line)';
}

/* Once a session is launched, wipe the prep surface so the tutor returns to a
   clean slate for the next student: clears auto-filled fields and empties the
   generated-session preview. The generated plan stays in state — the live
   session and the post-session archive still consume it. */
function clearPrepArea() {
  const s = getState();
  renderDynamicFields(s.sessionType);   // fresh, empty auto-fill fields (incl. title)
  _autofillRecord = null;
  document.getElementById('outputPlan').classList.add('hidden');
  document.getElementById('outputLoading').classList.add('hidden');
  document.getElementById('outputPlaceholder').classList.remove('hidden');
  setGenStatus('ready');
}
