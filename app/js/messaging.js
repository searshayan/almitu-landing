/* ═══════════════════════════════════════════════════════
   Almitu Pro — Messaging (tutor ↔ assigned student chat)

   A self-contained slide-over drawer. Talks to the `messages` table
   through the dataX helpers in data.js. Delivery/seen are three
   timestamps per row:
        created_at   → ✓   sent
        delivered_at → ✓✓  delivered
        seen_at      → ✓✓  seen (coloured)

   Live updates come from Supabase Realtime; a slow poll is kept as a
   safety net so ticks and incoming messages still resolve even if
   Realtime is disabled on the project.
   ═══════════════════════════════════════════════════════ */

const MSG_POLL_MS = 15000;

const msgState = {
  role: null,
  myId: null,
  partners: [],        // [{ id, full_name, email }]
  partnerId: null,     // currently-open conversation
  thread: [],          // messages in the open conversation
  unread: {},          // { total, byUser }
  channel: null,       // realtime channel
  poll: null,          // safety-net interval
  built: false,        // drawer DOM injected?
  open: false
};

/* ─────────────── lifecycle ─────────────── */

/* Called from routeApp on every (re)render. Idempotent. Messaging is for
   real tutors and students only — not admins, and not admin "View as"
   (RLS runs as the admin, so an impersonated chat would come back empty). */
async function initMessaging(ctx) {
  const allowed = ctx && !ctx.readOnly && (ctx.role === 'tutor' || ctx.role === 'student');
  if (!allowed) { teardownMessaging(); hideMessagesButton(); return; }

  // Same user re-routing (e.g. tab switch) — just refresh, don't rebuild.
  if (msgState.myId === ctx.userId && msgState.channel) { refreshUnread(); return; }

  teardownMessaging();
  msgState.role = ctx.role;
  msgState.myId = ctx.userId;
  buildMessagesUi();
  showMessagesButton();

  try {
    if (ctx.role === 'tutor') {
      msgState.partners = await dataListMyStudents(ctx.userId);
    } else {
      const tutor = await dataGetMyTutor(ctx.userId);
      msgState.partners = tutor ? [tutor] : [];
    }
  } catch (e) {
    console.warn('messaging: could not load partners', e);
    msgState.partners = [];
  }

  msgState.channel = dataSubscribeMessages(ctx.userId, onRealtimeInsert, onRealtimeUpdate);
  msgState.poll = setInterval(pollTick, MSG_POLL_MS);
  refreshUnread();
}

function teardownMessaging() {
  if (msgState.channel) { dataUnsubscribe(msgState.channel); msgState.channel = null; }
  if (msgState.poll) { clearInterval(msgState.poll); msgState.poll = null; }
  msgState.myId = null; msgState.partnerId = null; msgState.thread = []; msgState.partners = []; msgState.unread = {};
  // Wipe the rendered drawer too, so a previous user's messages can never be
  // seen after a sign-out or account switch (not just the in-memory state).
  if (msgState.open) closeMessages();
  const thread = document.getElementById('msgThread'); if (thread) thread.innerHTML = '';
  const list = document.getElementById('msgList'); if (list) list.innerHTML = '';
  renderBadge();
}

/* ─────────────── realtime + poll ─────────────── */

async function onRealtimeInsert(row) {
  // A message addressed to me arrived. Mark it delivered right away.
  try { await dataMarkDelivered(msgState.myId, row.sender_id); } catch (e) {}
  if (msgState.open && msgState.partnerId === row.sender_id) {
    // The conversation is on screen → it's seen the moment it lands.
    upsertThreadRow({ ...row, delivered_at: row.delivered_at || new Date().toISOString() });
    renderThread();
    try { await dataMarkSeen(msgState.myId, row.sender_id); } catch (e) {}
  }
  refreshUnread();
}

function onRealtimeUpdate(row) {
  // A tick (delivered/seen) changed on a message I sent.
  if (msgState.open && msgState.partnerId === row.recipient_id) {
    upsertThreadRow(row);
    renderThread();
  }
}

async function pollTick() {
  await refreshUnread();
  // Keep an open conversation fresh even without Realtime.
  if (msgState.open && msgState.partnerId) {
    try {
      msgState.thread = await dataListThread(msgState.myId, msgState.partnerId);
      renderThread();
      await dataMarkSeen(msgState.myId, msgState.partnerId);
    } catch (e) {}
  }
}

async function refreshUnread() {
  try {
    msgState.unread = await dataUnreadCounts(msgState.myId);
  } catch (e) { return; }
  renderBadge();
  if (msgState.open && msgState.role === 'tutor' && !msgState.partnerId) renderPartnerList();
}

/* ─────────────── thread helpers ─────────────── */

function upsertThreadRow(row) {
  const i = msgState.thread.findIndex(m => m.id === row.id);
  if (i === -1) msgState.thread.push(row);
  else msgState.thread[i] = { ...msgState.thread[i], ...row };
  msgState.thread.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function openThread(partnerId) {
  msgState.partnerId = partnerId;
  const pane = document.getElementById('msgConversation');
  const listWrap = document.getElementById('msgListWrap');
  if (listWrap) listWrap.classList.add('hidden');
  if (pane) pane.classList.remove('hidden');
  renderConversationHeader();
  const body = document.getElementById('msgThread');
  if (body) body.innerHTML = '<div class="text-center py-10 text-xs" style="color:var(--muted);">Loading…</div>';
  try {
    msgState.thread = await dataListThread(msgState.myId, partnerId);
    renderThread();
    await dataMarkSeen(msgState.myId, partnerId);
    refreshUnread();
  } catch (e) {
    if (body) body.innerHTML = `<div class="text-center py-10 text-xs" style="color:#B91C1C;">Could not load messages: ${escapeHtml(e.message)}</div>`;
  }
  const input = document.getElementById('msgInput');
  if (input) input.focus();
}

function backToPartnerList() {
  msgState.partnerId = null;
  document.getElementById('msgConversation').classList.add('hidden');
  document.getElementById('msgListWrap').classList.remove('hidden');
  renderPartnerList();
}

async function sendCurrentMessage() {
  const input = document.getElementById('msgInput');
  if (!input) return;
  const body = input.value.trim();
  if (!body || !msgState.partnerId) return;
  input.value = '';
  autoGrow(input);

  // Optimistic bubble — replaced by the real row once it saves.
  const temp = { id: 'temp-' + Date.now(), sender_id: msgState.myId, recipient_id: msgState.partnerId,
                 body, created_at: new Date().toISOString(), delivered_at: null, seen_at: null, _pending: true };
  msgState.thread.push(temp);
  renderThread();

  try {
    const saved = await dataSendMessage(msgState.partnerId, body);
    const i = msgState.thread.findIndex(m => m.id === temp.id);
    if (i !== -1) msgState.thread[i] = saved; else upsertThreadRow(saved);
    renderThread();
  } catch (e) {
    const i = msgState.thread.findIndex(m => m.id === temp.id);
    if (i !== -1) { msgState.thread[i]._failed = true; msgState.thread[i]._pending = false; }
    renderThread();
    showToast('Message failed to send: ' + e.message, 'error');
  }
}

/* ─────────────── rendering ─────────────── */

function partnerName(p) { return (p && (p.full_name || p.email)) || 'User'; }
function findPartner(id) { return msgState.partners.find(p => p.id === id); }

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
}

/* ✓ sent · ✓✓ delivered · ✓✓ (coloured) seen — only on my own messages. */
function tickHtml(m) {
  if (m._pending) return '<span style="opacity:.5;">🕓</span>';
  if (m._failed)  return '<span style="color:#EF4444;" title="Failed to send">⚠︎</span>';
  const dbl = `<svg viewBox="0 0 20 12" width="18" height="11" style="vertical-align:-1px;"><path d="M1 6.5 L4.5 10 L11 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10 L14.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const sgl = `<svg viewBox="0 0 14 12" width="12" height="11" style="vertical-align:-1px;"><path d="M1 6.5 L4.5 10 L12 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (m.seen_at)      return `<span title="Seen" style="color:#38BDF8;">${dbl}</span>`;
  if (m.delivered_at) return `<span title="Delivered" style="opacity:.75;">${dbl}</span>`;
  return `<span title="Sent" style="opacity:.6;">${sgl}</span>`;
}

function renderThread() {
  const host = document.getElementById('msgThread');
  if (!host) return;
  if (!msgState.thread.length) {
    host.innerHTML = '<div class="text-center py-10 text-xs" style="color:var(--muted);">No messages yet — say hello 👋</div>';
    return;
  }
  const rows = msgState.thread.map(m => {
    const mine = m.sender_id === msgState.myId;
    const bubble = mine
      ? 'margin-left:auto; background:var(--primary); color:#fff; border-radius:14px 14px 4px 14px;'
      : 'margin-right:auto; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:14px 14px 14px 4px;';
    return `
      <div class="max-w-[78%] px-3 py-2 mb-2" style="${bubble} width:fit-content;">
        <div class="text-sm whitespace-pre-wrap break-words" dir="${textDir(m.body)}">${escapeHtml(m.body)}</div>
        <div class="flex items-center gap-1 justify-end mt-0.5 text-[10px]" style="${mine ? 'color:rgba(255,255,255,.85);' : 'color:var(--muted);'}">
          <span>${fmtTime(m.created_at)}</span>
          ${mine ? tickHtml(m) : ''}
        </div>
      </div>`;
  }).join('');
  host.innerHTML = rows;
  host.scrollTop = host.scrollHeight;
}

function renderConversationHeader() {
  const el = document.getElementById('msgConvName');
  if (el) el.textContent = partnerName(findPartner(msgState.partnerId));
  const back = document.getElementById('msgBackBtn');
  if (back) back.classList.toggle('hidden', msgState.role !== 'tutor');
}

function renderPartnerList() {
  const host = document.getElementById('msgList');
  if (!host) return;
  if (!msgState.partners.length) {
    host.innerHTML = `<div class="px-4 py-8 text-center text-xs" style="color:var(--muted);">${
      msgState.role === 'tutor'
        ? 'No students assigned to you yet.'
        : 'No tutor assigned to you yet — an admin will pair you soon.'}</div>`;
    return;
  }
  const by = msgState.unread.byUser || {};
  host.innerHTML = msgState.partners.map(p => {
    const n = by[p.id] || 0;
    return `
      <button onclick="openThread('${p.id}')" class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors" style="border-bottom:1px solid var(--line);" onmouseover="this.style.background='var(--card)';" onmouseout="this.style.background='transparent';">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0" style="background:rgba(0,78,137,.1); color:var(--secondary);">${escapeHtml((partnerName(p)[0] || '?').toUpperCase())}</div>
          <span class="text-sm font-semibold truncate" style="color:var(--navy);">${escapeHtml(partnerName(p))}</span>
        </div>
        ${n ? `<span class="flex-shrink-0 text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style="background:var(--primary);">${n}</span>` : ''}
      </button>`;
  }).join('');
}

function renderBadge() {
  const badge = document.getElementById('messagesBadge');
  if (!badge) return;
  const total = (msgState.unread && msgState.unread.total) || 0;
  badge.textContent = total > 99 ? '99+' : String(total);
  badge.classList.toggle('hidden', total === 0);
}

/* ─────────────── drawer open/close + DOM ─────────────── */

function openMessages() {
  if (!msgState.built) buildMessagesUi();
  msgState.open = true;
  document.getElementById('msgDrawer').classList.remove('translate-x-full');
  document.getElementById('msgOverlay').classList.remove('hidden');
  // Student has exactly one partner → jump straight into it.
  if (msgState.role === 'student' && msgState.partners[0]) {
    openThread(msgState.partners[0].id);
  } else if (msgState.partnerId) {
    openThread(msgState.partnerId);
  } else {
    document.getElementById('msgConversation').classList.add('hidden');
    document.getElementById('msgListWrap').classList.remove('hidden');
    renderPartnerList();
  }
}

function closeMessages() {
  msgState.open = false;
  document.getElementById('msgDrawer').classList.add('translate-x-full');
  document.getElementById('msgOverlay').classList.add('hidden');
}

function showMessagesButton() { const b = document.getElementById('messagesBtn'); if (b) b.classList.remove('hidden'); }
function hideMessagesButton() { const b = document.getElementById('messagesBtn'); if (b) b.classList.add('hidden'); }

function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

function msgInputKey(ev) {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendCurrentMessage(); }
}

/* Injects the overlay + right-hand drawer once. */
function buildMessagesUi() {
  if (msgState.built) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="msgOverlay" onclick="closeMessages()" class="hidden fixed inset-0 z-[60]" style="background:rgba(0,0,0,.35);"></div>
    <aside id="msgDrawer" class="fixed top-0 right-0 h-full z-[61] w-full sm:w-[400px] max-w-full flex flex-col translate-x-full transition-transform duration-300 ease-out" style="background:var(--bg); border-left:1px solid var(--line); box-shadow:-8px 0 30px rgba(0,0,0,.12);">
      <div class="flex items-center justify-between px-4 h-14 flex-shrink-0" style="border-bottom:1px solid var(--line);">
        <div class="flex items-center gap-2 min-w-0">
          <button id="msgBackBtn" onclick="backToPartnerList()" class="hidden p-1.5 rounded-lg" style="color:var(--muted);" aria-label="Back">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="text-sm font-display font-bold truncate" style="color:var(--navy);"><span id="msgConvName">Messages</span></span>
        </div>
        <button onclick="closeMessages()" class="p-1.5 rounded-lg" style="color:var(--muted);" aria-label="Close">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Partner list (tutor: many students; student: skipped) -->
      <div id="msgListWrap" class="flex-1 overflow-y-auto">
        <div id="msgList"></div>
      </div>

      <!-- One conversation -->
      <div id="msgConversation" class="hidden flex-1 flex flex-col min-h-0">
        <div id="msgThread" class="flex-1 overflow-y-auto px-4 py-3"></div>
        <div class="flex items-end gap-2 px-3 py-3 flex-shrink-0" style="border-top:1px solid var(--line);">
          <textarea id="msgInput" rows="1" oninput="autoGrow(this)" onkeydown="msgInputKey(event)" placeholder="Write a message…"
            class="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none" style="background:var(--card); border:1px solid var(--line); color:var(--ink); max-height:120px;"></textarea>
          <button onclick="sendCurrentMessage()" class="flex items-center justify-center w-10 h-10 rounded-xl text-white flex-shrink-0" style="background:var(--primary);" aria-label="Send">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5m0 0l-7 7m7-7l7 7"/></svg>
          </button>
        </div>
      </div>
    </aside>`;
  document.body.appendChild(wrap);
  msgState.built = true;
}
