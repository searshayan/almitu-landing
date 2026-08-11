/* ═══════════════════════════════════════════════════════
   Almitu Pro — Amie, the student AI study buddy (Phase 1: text)

   A friendly chat drawer for students. The actual AI call is made by the
   `amie-chat` Supabase Edge Function (so the API key never reaches the
   browser); this file is only the UI + history. Phase 2 will add voice on
   top of the same drawer.
   ═══════════════════════════════════════════════════════ */

const amieState = {
  myId: null,
  studentName: '',
  history: [],      // [{ role:'user'|'assistant', content }]
  built: false,
  open: false,
  loaded: false,    // history fetched at least once?
  sending: false
};

/* Called from routeApp. Amie is for students only (real, not View-as). */
function initAmie(ctx) {
  const allowed = ctx && !ctx.readOnly && ctx.role === 'student';
  if (!allowed) { hideAmieButton(); return; }
  amieState.myId = ctx.userId;
  amieState.studentName = (ctx.name || '').split(' ')[0] || '';
  buildAmieUi();
  showAmieButton();
}

function showAmieButton() { const b = document.getElementById('amieFab'); if (b) b.classList.remove('hidden'); }
function hideAmieButton() { const b = document.getElementById('amieFab'); if (b) b.classList.add('hidden'); }

/* ─────────────── open / close ─────────────── */

async function openAmie() {
  if (!amieState.built) buildAmieUi();
  amieState.open = true;
  document.getElementById('amieDrawer').classList.remove('translate-x-full');
  document.getElementById('amieOverlay').classList.remove('hidden');
  const input = document.getElementById('amieInput');
  if (input) input.focus();

  if (!amieState.loaded) {
    const host = document.getElementById('amieThread');
    if (host) host.innerHTML = '<div class="text-center py-10 text-xs" style="color:var(--muted);">Loading…</div>';
    try {
      amieState.history = await dataListAmieHistory(amieState.myId);
      amieState.loaded = true;
    } catch (e) {
      amieState.history = [];
    }
    renderAmie();
  }
}

function closeAmie() {
  amieState.open = false;
  document.getElementById('amieDrawer').classList.add('translate-x-full');
  document.getElementById('amieOverlay').classList.add('hidden');
}

/* ─────────────── send ─────────────── */

async function sendAmie() {
  const input = document.getElementById('amieInput');
  if (!input || amieState.sending) return;
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  amieAutoGrow(input);

  amieState.history.push({ role: 'user', content: message });
  amieState.sending = true;
  renderAmie(true);   // show the typing indicator

  try {
    const res = await dataAskAmie(message);
    amieState.history.push({ role: 'assistant', content: res.reply });
    amieState.sending = false;
    renderAmie();
    if (typeof res.remaining === 'number' && res.remaining <= 5) {
      showToast(`${res.remaining} message${res.remaining === 1 ? '' : 's'} left with Amie today.`, 'warn');
    }
  } catch (e) {
    amieState.sending = false;
    let note = "Amie couldn't reply just now. Please try again.";
    if (e.code === 'daily_limit') note = "You've reached today's practice limit with Amie. Come back tomorrow! 🌙";
    else if (e.code === 'forbidden') note = 'Amie is only available to approved students.';
    amieState.history.push({ role: 'assistant', content: note, _error: true });
    renderAmie();
  }
}

/* ─────────────── rendering ─────────────── */

function renderAmie(typing) {
  const host = document.getElementById('amieThread');
  if (!host) return;

  if (!amieState.history.length && !typing) {
    host.innerHTML = amieWelcomeHtml();
    return;
  }

  const bubbles = amieState.history.map(m => {
    const mine = m.role === 'user';
    const style = mine
      ? 'margin-left:auto; background:var(--secondary); color:#fff; border-radius:14px 14px 4px 14px;'
      : `margin-right:auto; background:var(--card); color:var(--ink); border:1px solid ${m._error ? 'rgba(239,68,68,.4)' : 'var(--line)'}; border-radius:14px 14px 14px 4px;`;
    return `
      <div class="max-w-[85%] px-3 py-2 mb-2" style="${style} width:fit-content;">
        <div class="text-sm whitespace-pre-wrap break-words">${escapeHtml(m.content)}</div>
      </div>`;
  }).join('');

  const typingHtml = typing ? `
    <div class="max-w-[85%] px-3 py-2.5 mb-2" style="margin-right:auto; background:var(--card); border:1px solid var(--line); border-radius:14px 14px 14px 4px; width:fit-content;">
      <div class="amie-typing"><span></span><span></span><span></span></div>
    </div>` : '';

  host.innerHTML = bubbles + typingHtml;
  host.scrollTop = host.scrollHeight;
}

function amieWelcomeHtml() {
  const hi = amieState.studentName ? `Hi ${escapeHtml(amieState.studentName)}! ` : 'Hi! ';
  const chip = (t) => `<button onclick="amieQuick('${t.replace(/'/g, "\\'")}')" class="text-xs px-3 py-1.5 rounded-full text-left" style="background:var(--card); border:1px solid var(--line); color:var(--secondary);">${t}</button>`;
  return `
    <div class="flex flex-col items-center text-center px-4 py-8">
      <div class="text-4xl mb-2">🦉</div>
      <p class="text-sm font-semibold mb-1" style="color:var(--navy);">${hi}I'm Amie, your study buddy.</p>
      <p class="text-xs mb-5" style="color:var(--muted);">Ask me about a word, a grammar point, or practise a little with me.</p>
      <div class="flex flex-wrap gap-2 justify-center">
        ${chip('What does "practice" mean?')}
        ${chip('Give me 3 example sentences with "because".')}
        ${chip("Let's practise a short conversation.")}
      </div>
    </div>`;
}

function amieQuick(text) {
  const input = document.getElementById('amieInput');
  if (input) { input.value = text; input.focus(); amieAutoGrow(input); }
}

function amieAutoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
function amieInputKey(ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendAmie(); } }

/* ─────────────── DOM (injected once) ─────────────── */

function buildAmieUi() {
  if (amieState.built) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="amieFab" onclick="openAmie()" class="hidden fixed bottom-5 right-5 z-[55] flex items-center gap-2 pl-3 pr-4 h-12 rounded-full text-white font-semibold text-sm shadow-lg transition-transform hover:scale-105"
      style="background:linear-gradient(135deg, #004E89, #FF6B35);" aria-label="Chat with Amie">
      <span class="text-xl leading-none">🦉</span><span class="hidden sm:inline">Ask Amie</span>
    </button>

    <div id="amieOverlay" onclick="closeAmie()" class="hidden fixed inset-0 z-[60]" style="background:rgba(0,0,0,.35);"></div>
    <aside id="amieDrawer" class="fixed top-0 right-0 h-full z-[61] w-full sm:w-[400px] max-w-full flex flex-col translate-x-full transition-transform duration-300 ease-out"
      style="background:var(--bg); border-left:1px solid var(--line); box-shadow:-8px 0 30px rgba(0,0,0,.12);">
      <div class="flex items-center justify-between px-4 h-14 flex-shrink-0" style="border-bottom:1px solid var(--line);">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl leading-none">🦉</span>
          <div class="leading-tight min-w-0">
            <p class="text-sm font-display font-bold" style="color:var(--navy);">Amie</p>
            <p class="text-[10px]" style="color:var(--muted);">Your study buddy · practise your lessons</p>
          </div>
        </div>
        <button onclick="closeAmie()" class="p-1.5 rounded-lg" style="color:var(--muted);" aria-label="Close">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div id="amieThread" class="flex-1 overflow-y-auto px-4 py-3"></div>

      <div class="flex items-end gap-2 px-3 py-3 flex-shrink-0" style="border-top:1px solid var(--line);">
        <textarea id="amieInput" rows="1" oninput="amieAutoGrow(this)" onkeydown="amieInputKey(event)" placeholder="Ask Amie anything about your lessons…"
          class="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none" style="background:var(--card); border:1px solid var(--line); color:var(--ink); max-height:120px;"></textarea>
        <button onclick="sendAmie()" class="flex items-center justify-center w-10 h-10 rounded-xl text-white flex-shrink-0" style="background:var(--secondary);" aria-label="Send">
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
}
