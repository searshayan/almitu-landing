/* ═══════════════════════════════════════════════════════
   Almitu Pro — Amie, the SESSION-AWARE student study buddy (Phase 1)

   Amie is bound to the ONE session the student has selected for practice.
   She only helps with that session's goal, level, vocabulary, expressions,
   grammar and its practice activities. The AI call is made by the
   `amie-chat` Supabase Edge Function (so the API key never reaches the
   browser); this file is the UI + session binding + local guardrails.

   Cost model: selecting a session, turning green, opening the drawer, the
   welcome message, quick prompts, the counter and the limit screen are ALL
   local — no model call. Only a submitted student message calls the model.
   ═══════════════════════════════════════════════════════ */

const AMIE_SESSION_LIMIT = 24;   // replies per session (mirrors the server cap)

const amieState = {
  myId: null,
  studentName: '',
  history: [],          // [{ role:'user'|'assistant', content }] — visible thread only
  built: false,
  open: false,
  sending: false,

  // ── session binding ──
  sessionId: null,      // the selected session Amie is scoped to (null = neutral)
  sessionTitle: '',
  sessionLevel: '',
  context: null,        // client-derived compact context (quick prompts + welcome)

  // ── per-session usage (learned from the server on each reply) ──
  used: null,           // null until the first reply comes back
  limit: AMIE_SESSION_LIMIT,
  remaining: null,
  lowWarned: false      // showed the "few messages left" nudge?
};

/* Called from routeApp. Amie is for students only (real, not View-as). */
function initAmie(ctx) {
  const allowed = ctx && !ctx.readOnly && ctx.role === 'student';
  if (!allowed) { hideAmieButton(); return; }
  // Different student on the same browser: wipe everything first.
  if (amieState.myId && amieState.myId !== ctx.userId) resetAmie();
  amieState.myId = ctx.userId;
  amieState.studentName = (ctx.name || '').split(' ')[0] || '';
  buildAmieUi();
  showAmieButton();
  // Reflect whatever session is already selected (dashboard may have loaded).
  amieSyncSession();
}

/* Clear all in-memory conversation + session state and the rendered thread. */
function resetAmie() {
  amieState.history = [];
  amieState.sending = false;
  amieState.myId = null;
  amieState.sessionId = null;
  amieState.sessionTitle = '';
  amieState.sessionLevel = '';
  amieState.context = null;
  amieState.used = null;
  amieState.remaining = null;
  amieState.lowWarned = false;
  if (amieState.open) closeAmie();
  const host = document.getElementById('amieThread');
  if (host) host.innerHTML = '';
}

function showAmieButton() { const b = document.getElementById('amieFab'); if (b) b.classList.remove('hidden'); }
function hideAmieButton() { const b = document.getElementById('amieFab'); if (b) b.classList.add('hidden'); resetAmie(); }

/* ─────────────── session binding ───────────────
   The single hook the dashboard calls whenever the active session changes
   (renderNotebooks runs on load, on select, and on delete). No model call. */
function amieSyncSession() {
  if (!amieState.built) return;
  const nb = (typeof getActiveNotebook === 'function') ? getActiveNotebook() : null;
  amieSetSession(nb);
}

function amieSetSession(nb) {
  const newId = nb ? nb.id : null;
  if (newId === amieState.sessionId) { applyAmieOwlState(); return; }  // no change

  // Switching sessions must never blend threads or counts across sessions.
  amieState.sessionId = newId;
  amieState.sessionTitle = nb ? (nb.plan?.meta?.title || nb.title || 'this session') : '';
  amieState.sessionLevel = nb ? (nb.plan?.meta?.level || nb.student?.level || '') : '';
  amieState.context = nb ? buildClientAmieContext(nb) : null;
  amieState.history = [];
  amieState.used = null;
  amieState.remaining = null;
  amieState.lowWarned = false;

  applyAmieOwlState();
  if (amieState.open) renderAmie();   // refresh the open drawer to the new session
}

/* Deterministic, compact context derived from the session's stored plan —
   the original tutor input form + final targets. Used LOCALLY for quick
   prompts and the welcome line; the server re-derives the authoritative
   context from the DB, so this is presentation-only. */
function buildClientAmieContext(nb) {
  const plan = nb.plan || {};
  const meta = plan.meta || {};
  const details = (plan.formData && plan.formData.details) || {};
  const bank = (plan.content && plan.content.practice_bank) || {};
  const items = (bank.items || []).filter(i => i && i.term);

  let vocab = items.slice(0, 12).map(i => i.term);
  if (!vocab.length) {
    const raw = String(details.targetVocab || details.targetWords || details.sightWords || details.targetLetters || '');
    vocab = raw.split(/[,\n]/).map(w => w.trim()).filter(Boolean).slice(0, 12);
  }
  const hasGrammar = !!(details.grammarTitle || details.grammarStructure);
  const hasExpr = !!(details.targetExpressions || (bank.sentences && bank.sentences.length));
  const hero = (plan.slides || []).find(s => s && s.layout === 'hero');
  const goal = (hero && hero.data && hero.data.goal) || details.objective || meta.title || '';

  return { title: meta.title || nb.title || '', level: meta.level || '', vocab, hasGrammar, hasExpr, goal: String(goal) };
}

/* ─────────────── owl visual + a11y state ─────────────── */

function applyAmieOwlState() {
  const fab = document.getElementById('amieFab');
  const dot = document.getElementById('amieFabDot');
  if (!fab) return;
  const active = !!amieState.sessionId;

  // Green ring + status dot when a session is active; neutral otherwise.
  fab.style.boxShadow = active
    ? '0 0 0 3px rgba(6,214,160,.55), 0 8px 24px rgba(0,0,0,.18)'
    : '0 4px 14px rgba(0,0,0,.18)';
  if (dot) dot.classList.toggle('hidden', !active);

  // Never rely on colour alone — the label carries the state for screen readers.
  fab.setAttribute('aria-label', active
    ? `Amie is active for the current session: ${amieState.sessionTitle}.`
    : 'Amie is available. Select a session to chat about it.');

  // Header + input reflect the same state when the drawer is built.
  const sub = document.getElementById('amieHeaderSub');
  if (sub) {
    sub.textContent = active
      ? `Session connected: ${amieState.sessionTitle}${amieState.sessionLevel ? ' · ' + amieState.sessionLevel : ''}`
      : 'Choose a session to begin.';
    sub.setAttribute('dir', active ? textDir(amieState.sessionTitle) : 'ltr');
  }
  amieUpdateInputEnabled();
}

function amieUpdateInputEnabled() {
  const input = document.getElementById('amieInput');
  const send = document.getElementById('amieSendBtn');
  if (!input) return;
  const active = !!amieState.sessionId;
  const atLimit = active && amieState.remaining === 0;
  const disabled = !active || atLimit || amieState.sending;
  input.disabled = disabled;
  input.placeholder = !active ? 'Choose a session first'
    : atLimit ? 'Session limit reached'
    : 'Ask about this session…';
  input.style.opacity = disabled ? '.6' : '1';
  if (send) { send.disabled = disabled; send.style.opacity = disabled ? '.5' : '1'; }
}

/* ─────────────── open / close ─────────────── */

function openAmie() {
  if (!amieState.built) buildAmieUi();
  amieState.open = true;
  document.getElementById('amieDrawer').classList.remove('translate-x-full');
  document.getElementById('amieOverlay').classList.remove('hidden');
  renderAmie();
  const input = document.getElementById('amieInput');
  if (input && amieState.sessionId && amieState.remaining !== 0) input.focus();
}

function closeAmie() {
  amieState.open = false;
  document.getElementById('amieDrawer').classList.add('translate-x-full');
  document.getElementById('amieOverlay').classList.add('hidden');
}

/* Local action for the no-session state: just close so the student can pick a
   session from the dashboard list behind the drawer. No model call. */
function amieChooseSession() { closeAmie(); }

/* ─────────────── send ─────────────── */

async function sendAmie() {
  const input = document.getElementById('amieInput');
  if (!input || amieState.sending) return;
  if (!amieState.sessionId) return;                 // neutral: nothing to chat about
  if (amieState.remaining === 0) { renderAmie(); return; }   // hard stop at limit

  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  amieAutoGrow(input);

  amieState.history.push({ role: 'user', content: message });
  amieState.sending = true;
  amieUpdateInputEnabled();
  renderAmie(true);   // typing indicator

  try {
    const res = await dataAskAmie(message, amieState.sessionId);
    amieState.history.push({ role: 'assistant', content: res.reply });
    amieState.sending = false;
    if (typeof res.used === 'number') amieState.used = res.used;
    if (typeof res.limit === 'number') amieState.limit = res.limit;
    if (typeof res.remaining === 'number') amieState.remaining = res.remaining;
    // 80% nudge (once): show "a few messages left" from this render onward.
    if (!amieState.lowWarned && typeof amieState.remaining === 'number'
        && amieState.remaining > 0 && amieState.remaining <= 5) {
      amieState.lowWarned = true;
    }
    amieUpdateInputEnabled();
    renderAmie();
  } catch (e) {
    amieState.sending = false;
    if (e.code === 'session_limit') {
      // Already used up before this send — reflect the limit and stop.
      amieState.remaining = 0;
      amieState.used = (e.payload && e.payload.used) || amieState.limit;
      amieState.history.pop();   // drop the just-added user turn; it wasn't answered
      amieUpdateInputEnabled();
      renderAmie();
      return;
    }
    let note = "Amie couldn't reply just now. Please try again.";
    if (e.code === 'forbidden') note = 'Amie is only available to approved students.';
    else if (e.code === 'session_forbidden') note = "That session isn't available. Please pick a session from your dashboard.";
    else if (e.code === 'no_session') note = 'Please choose a session first, then ask Amie about it.';
    amieState.history.push({ role: 'assistant', content: note, _error: true });
    amieUpdateInputEnabled();
    renderAmie();
  }
}

/* ─────────────── rendering ─────────────── */

function renderAmie(typing) {
  const host = document.getElementById('amieThread');
  if (!host) return;

  // Neutral: no session selected.
  if (!amieState.sessionId) { host.innerHTML = amieNoSessionHtml(); return; }

  // Reached the per-session limit.
  if (amieState.remaining === 0) {
    host.innerHTML = (amieState.history.length ? amieBubblesHtml() : '') + amieLimitHtml();
    host.scrollTop = host.scrollHeight;
    return;
  }

  // Fresh thread for this session → welcome + quick prompts.
  if (!amieState.history.length && !typing) { host.innerHTML = amieWelcomeHtml(); return; }

  const typingHtml = typing ? `
    <div class="max-w-[85%] px-3 py-2.5 mb-2" style="margin-right:auto; background:var(--card); border:1px solid var(--line); border-radius:14px 14px 14px 4px; width:fit-content;">
      <div class="amie-typing"><span></span><span></span><span></span></div>
    </div>` : '';

  const lowHtml = (amieState.lowWarned && amieState.remaining > 0 && amieState.remaining <= 5 && !typing)
    ? `<div class="text-[11px] text-center my-2 px-3 py-1.5 rounded-lg" style="color:var(--muted); background:var(--card); border:1px solid var(--line);">You have a few Amie messages left for this session. Try the practice cards, or save a question for your tutor.</div>`
    : '';

  host.innerHTML = amieBubblesHtml() + lowHtml + typingHtml + amieCounterHtml();
  host.scrollTop = host.scrollHeight;
}

function amieBubblesHtml() {
  return amieState.history.map(m => {
    const mine = m.role === 'user';
    const style = mine
      ? 'margin-left:auto; background:var(--secondary); color:#fff; border-radius:14px 14px 4px 14px;'
      : `margin-right:auto; background:var(--card); color:var(--ink); border:1px solid ${m._error ? 'rgba(239,68,68,.4)' : 'var(--line)'}; border-radius:14px 14px 14px 4px;`;
    return `
      <div class="max-w-[85%] px-3 py-2 mb-2" style="${style} width:fit-content;">
        <div class="text-sm whitespace-pre-wrap break-words" dir="${textDir(m.content)}">${amieRich(m.content)}</div>
      </div>`;
  }).join('');
}

function amieCounterHtml() {
  if (typeof amieState.remaining !== 'number') return '';
  return `<div class="text-[10px] text-center mt-1 mb-1" style="color:var(--muted);">Amie help: ${amieState.remaining} of ${amieState.limit} messages left for this session</div>`;
}

function amieNoSessionHtml() {
  return `
    <div class="flex flex-col items-center text-center px-4 py-10">
      <div class="text-4xl mb-2" style="filter:grayscale(.35); opacity:.85;">🦉</div>
      <p class="text-sm font-semibold mb-1" style="color:var(--navy);">Hi, I'm Amie.</p>
      <p class="text-xs mb-5" style="color:var(--muted);">Open a session and I can help you practise what you learned.</p>
      <button onclick="amieChooseSession()" class="text-sm font-semibold px-4 py-2 rounded-xl text-white" style="background:var(--secondary);">Choose a session</button>
    </div>`;
}

function amieWelcomeHtml() {
  const hi = amieState.studentName ? `Hi ${escapeHtml(amieState.studentName)}! ` : 'Hi! ';
  const title = escapeHtml(amieState.sessionTitle || 'this session');
  const chips = amieQuickPrompts().map(t =>
    `<button onclick="amieQuick('${t.replace(/'/g, "\\'")}')" class="text-xs px-3 py-1.5 rounded-full text-left" style="background:var(--card); border:1px solid var(--line); color:var(--secondary);">${escapeHtml(t)}</button>`
  ).join('');
  return `
    <div class="flex flex-col items-center text-center px-4 py-8">
      <div class="text-4xl mb-2">🦉</div>
      <p class="text-sm font-semibold mb-1" style="color:var(--navy);">${hi}I'm ready to help with <span dir="${textDir(amieState.sessionTitle)}">“${title}”</span>.</p>
      <p class="text-xs mb-5" style="color:var(--muted);">Ask me about the words, phrases, grammar, Reading, Listening, or practice activities.</p>
      <div class="flex flex-wrap gap-2 justify-center">${chips}</div>
    </div>`;
}

/* Local quick prompts built from the session's own targets — no model call. */
function amieQuickPrompts() {
  const c = amieState.context || {};
  const out = [];
  if (c.vocab && c.vocab.length) out.push(`What does "${c.vocab[0]}" mean?`);
  if (c.hasGrammar) out.push('Help me with the grammar.');
  out.push('Give me a hint.');
  out.push("Let's practise together.");
  return out.slice(0, 4);
}

function amieLimitHtml() {
  const btn = (label, onclick, primary) =>
    `<button onclick="${onclick}" class="text-xs font-semibold px-3 py-2 rounded-xl ${primary ? 'text-white' : ''}" style="${primary ? 'background:var(--secondary);' : 'background:var(--card); border:1px solid var(--line); color:var(--secondary);'}">${label}</button>`;
  return `
    <div class="flex flex-col items-center text-center px-4 py-8">
      <div class="text-3xl mb-2">🌙</div>
      <p class="text-sm font-semibold mb-1" style="color:var(--navy);">You've completed Amie practice for this session.</p>
      <p class="text-xs mb-5" style="color:var(--muted);">You can continue with the Reading, Listening, Flashcards, or Quiz for this session, or return after your next session.</p>
      <div class="flex flex-wrap gap-2 justify-center">
        ${btn('Open Reading Practice', "amieOpenActivity('reading')", true)}
        ${btn('Open Listening Practice', "amieOpenActivity('listening')")}
        ${btn('Message my tutor', 'amieMessageTutor()')}
      </div>
    </div>`;
}

/* Local navigation from the limit screen — closes Amie and opens the activity
   for the SAME session. Never calls the model. */
function amieOpenActivity(kind) {
  closeAmie();
  try {
    if (kind === 'reading' && typeof actReading === 'function') actReading();
    else if (kind === 'listening' && typeof actListening === 'function') actListening();
    else if (typeof actOverview === 'function') actOverview();
  } catch (e) { /* activity area not ready — the drawer is closed regardless */ }
}

function amieMessageTutor() {
  closeAmie();
  if (typeof openMessages === 'function') openMessages();
}

/* Render Amie's light markdown (**bold** / *italic* / `code`). Escapes first. */
function amieRich(str) {
  let h = escapeHtml(str == null ? '' : String(str));
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  h = h.replace(/`([^`\n]+?)`/g, '<code style="background:rgba(0,0,0,.06); padding:0 3px; border-radius:3px;">$1</code>');
  return h;
}

function amieQuick(text) {
  const input = document.getElementById('amieInput');
  if (input && !input.disabled) { input.value = text; input.focus(); amieAutoGrow(input); }
}

function amieAutoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
function amieInputKey(ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendAmie(); } }

/* ─────────────── DOM (injected once) ─────────────── */

function buildAmieUi() {
  if (amieState.built) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="amieFab" onclick="openAmie()" class="hidden fixed bottom-5 right-5 z-[55] flex items-center gap-2 pl-3 pr-4 h-12 rounded-full text-white font-semibold text-sm transition-transform hover:scale-105"
      style="background:linear-gradient(135deg, #004E89, #FF6B35); box-shadow:0 4px 14px rgba(0,0,0,.18);" aria-label="Amie is available. Select a session to chat about it.">
      <span class="relative text-xl leading-none">🦉<span id="amieFabDot" class="hidden absolute -top-1 -right-1 w-3 h-3 rounded-full" style="background:#06D6A0; border:2px solid #fff;"></span></span>
      <span class="hidden sm:inline">Ask Amie</span>
    </button>

    <div id="amieOverlay" onclick="closeAmie()" class="hidden fixed inset-0 z-[60]" style="background:rgba(0,0,0,.35);"></div>
    <aside id="amieDrawer" class="fixed top-0 right-0 h-full z-[61] w-full sm:w-[400px] max-w-full flex flex-col translate-x-full transition-transform duration-300 ease-out"
      style="background:var(--bg); border-left:1px solid var(--line); box-shadow:-8px 0 30px rgba(0,0,0,.12);" role="dialog" aria-label="Chat with Amie">
      <div class="flex items-center justify-between px-4 h-14 flex-shrink-0" style="border-bottom:1px solid var(--line);">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl leading-none">🦉</span>
          <div class="leading-tight min-w-0">
            <p class="text-sm font-display font-bold" style="color:var(--navy);">Chat with Amie</p>
            <p id="amieHeaderSub" class="text-[10px] truncate" style="color:var(--muted);">Choose a session to begin.</p>
          </div>
        </div>
        <button onclick="closeAmie()" class="p-1.5 rounded-lg" style="color:var(--muted);" aria-label="Close">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div id="amieThread" class="flex-1 overflow-y-auto px-4 py-3"></div>

      <div class="flex items-end gap-2 px-3 py-3 flex-shrink-0" style="border-top:1px solid var(--line);">
        <textarea id="amieInput" rows="1" disabled oninput="amieAutoGrow(this)" onkeydown="amieInputKey(event)" placeholder="Choose a session first"
          class="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none" style="background:var(--card); border:1px solid var(--line); color:var(--ink); max-height:120px;"></textarea>
        <button id="amieSendBtn" onclick="sendAmie()" disabled class="flex items-center justify-center w-10 h-10 rounded-xl text-white flex-shrink-0" style="background:var(--secondary);" aria-label="Send">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5m0 0l-7 7m7-7l7 7"/></svg>
        </button>
      </div>
    </aside>

    <style>
      .amie-typing { display:flex; gap:4px; align-items:center; height:14px; }
      .amie-typing span { width:6px; height:6px; border-radius:50%; background:var(--muted); opacity:.5; animation:amieBounce 1.2s infinite ease-in-out; }
      .amie-typing span:nth-child(2) { animation-delay:.15s; }
      .amie-typing span:nth-child(3) { animation-delay:.3s; }
      @keyframes amieBounce { 0%,80%,100% { transform:translateY(0); opacity:.4; } 40% { transform:translateY(-4px); opacity:.9; } }
    </style>`;
  document.body.appendChild(wrap);
  amieState.built = true;
  applyAmieOwlState();
}
