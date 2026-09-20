/* ═══════════════════════════════════════════════════════
   Almitu Pro — Render Engine
   Turns slide JSON (from Claude / custom API / demo engine)
   into themed HTML. Layouts = structure; tier/level rules
   live in the content itself.

   Emoji-free: no decorative emojis in any chrome. Vocabulary
   follows the 6-slide (25-min) / 4-slide (15-min) spec via the
   wordlist / practice / integrated / applyreview layouts below.
   Grammar & Communication keep their existing layouts.
   ═══════════════════════════════════════════════════════ */

function md(text) {
  // minimal markdown: **bold** → highlighted target item, wrapped in a
  // direction-aware <bdi> so mixed RTL/LTR (a first-language sentence with an
  // English word in it) renders in the correct order rather than scrambling.
  const raw = String(text ?? '');
  const html = escapeHtml(raw).replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--primary);">$1</strong>');
  return `<bdi dir="${textDir(raw)}">${html}</bdi>`;
}

/* Literacy picture for a word, from the curated pack (photos = Pexels,
   symbols = ARASAAC). Photos fill the frame; symbols sit contained on a soft
   ground. Falls back to the printed word when no image exists. */
function litImg(word, prefer) {
  const a = (typeof literacyImage === 'function') ? literacyImage(word, prefer) : null;
  if (!a) {
    return `<div class="lit-img lit-img-none" role="img" aria-label="${escapeHtml(word)}">${escapeHtml(word)}</div>`;
  }
  const fit = a.type === 'symbol' ? 'contain' : 'cover';
  const pad = a.type === 'symbol' ? 'padding:8%;' : '';
  return `<img class="lit-img" src="${a.file}" alt="${escapeHtml(word)}" loading="lazy" style="object-fit:${fit};${pad}">`;
}

/* Say a word aloud with the browser's built-in speech synthesis — helps
   pre-readers hear each target word. Slowed a little for clarity. */
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = 'en-US'; u.rate = 0.8;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function speakBtn(word) {
  const w = String(word || '').replace(/\\/g, '').replace(/'/g, "\\'");
  return `<button type="button" class="lit-speak" aria-label="Hear the word ${escapeHtml(word)}" onclick="event.stopPropagation();speak('${w}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>`;
}

/* Small consistent activity icons (the brief's set): listen / say / read /
   write / look / check. */
const _LIT_ICONS = {
  listen: 'M11 5 6 9H2v6h4l5 4V5z|M15.5 8.5a5 5 0 0 1 0 7',
  say:    'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z',
  read:   'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  write:  'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  look:   'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check:  'M20 6 9 17l-5-5'
};
function litIco(name) {
  const p = _LIT_ICONS[name]; if (!p) return '';
  const paths = p.split('|').map(d => `<path d="${d}"/>`).join('');
  return `<svg class="lit-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
function _litShuffle(input) {
  const a = Array.isArray(input) ? input.slice() : String(input).split('');
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ── Interactive "build the word" widget runtime (Present + student view) ──
   State lives in the DOM, so it works wherever the slide HTML is injected. */
function litBuildPick(btn) {
  const w = btn.closest('.lit-build'); if (!w || btn.disabled || w.classList.contains('done')) return;
  const slot = [...w.querySelectorAll('.lit-bslot')].find(s => !s.textContent);
  if (!slot) return;
  slot.textContent = btn.dataset.l; slot.dataset.tile = btn.dataset.i;
  btn.disabled = true; btn.classList.add('used');
  const slots = [...w.querySelectorAll('.lit-bslot')];
  if (slots.every(s => s.textContent)) {
    const built = slots.map(s => s.textContent).join('');
    const msg = w.querySelector('.lit-build-msg');
    if (built === w.dataset.word) {
      w.classList.add('done');
      msg.innerHTML = `<span class="ok">${litIco('check')} ${escapeHtml(w.dataset.word)}</span>`;
      if (typeof speak === 'function') speak(w.dataset.word);
    } else {
      w.classList.add('wrong'); msg.innerHTML = `<span class="no">Try again</span>`;
      setTimeout(() => w.classList.remove('wrong'), 500);
    }
  }
}
function litBuildReset(btn) {
  const w = btn.closest('.lit-build'); if (!w) return;
  w.classList.remove('done', 'wrong');
  w.querySelectorAll('.lit-bslot').forEach(s => { s.textContent = ''; delete s.dataset.tile; });
  w.querySelectorAll('.lit-btile').forEach(t => { t.disabled = false; t.classList.remove('used'); });
  const m = w.querySelector('.lit-build-msg'); if (m) m.innerHTML = '';
}

/* Sentence builder — tap word tiles into order to make the target sentence. */
function litSentPick(btn) {
  const w = btn.closest('.lit-sentbuild'); if (!w || btn.disabled || w.classList.contains('done')) return;
  const slot = [...w.querySelectorAll('.lit-wslot')].find(s => !s.textContent);
  if (!slot) return;
  slot.textContent = btn.dataset.w; btn.disabled = true; btn.classList.add('used');
  const slots = [...w.querySelectorAll('.lit-wslot')];
  if (slots.every(s => s.textContent)) {
    const built = slots.map(s => s.textContent).join(' ');
    const msg = w.querySelector('.lit-build-msg');
    if (built === w.dataset.target) {
      w.classList.add('done');
      msg.innerHTML = `<span class="ok">${litIco('check')} ${escapeHtml(built)}${w.dataset.punct || ''}</span>`;
      if (typeof speak === 'function') speak(built);
    } else {
      w.classList.add('wrong'); msg.innerHTML = `<span class="no">Try again</span>`;
      setTimeout(() => w.classList.remove('wrong'), 500);
    }
  }
}
function litSentReset(btn) {
  const w = btn.closest('.lit-sentbuild'); if (!w) return;
  w.classList.remove('done', 'wrong');
  w.querySelectorAll('.lit-wslot').forEach(s => { s.textContent = ''; });
  w.querySelectorAll('.lit-wtile').forEach(t => { t.disabled = false; t.classList.remove('used'); });
  const m = w.querySelector('.lit-build-msg'); if (m) m.innerHTML = '';
}

/* Shared literacy slide header: the PPP stage label (eyebrow), the title, and
   an optional instruction line. */
function litHead(slide, d) {
  return `${slide.stage ? `<div class="lit-stage">${escapeHtml(slide.stage)}</div>` : ''}
      <h3 class="text-lg mb-1">${escapeHtml(slide.title || '')}</h3>
      ${d.intro ? `<p class="text-sm mb-3" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-3"></div>'}`;
}

const LAYOUT_BUILDERS = {

  /* ── Literacy: letter cards (Alphabet & Sounds) ──
     { letter, sound, word } → big Aa, the sound, an example picture, the word.
     Scaffolding flags (for the Production stage): hideSound / hideImage / hideWord. */
  letters(d, ctx, slide) {
    const items = d.items || [];
    return `${litHead(slide, d)}
      <div class="lit-grid">
        ${items.map(it => `
          <div class="lit-card">
            <div class="lit-letter">${escapeHtml((it.letter || '').toLowerCase())}<span>${escapeHtml((it.letter || '').toUpperCase())}</span></div>
            ${(!d.hideSound && it.sound) ? `<div class="lit-sound">${escapeHtml(it.sound)}</div>` : ''}
            ${!d.hideImage ? `<div class="lit-frame">${litImg(it.word, 'photo')}</div>` : ''}
            ${!d.hideWord ? `<div class="lit-word">${escapeHtml(it.word || '')}${speakBtn(it.word)}</div>` : ''}
          </div>`).join('')}
      </div>`;
  },

  /* ── Literacy: blending (Word Building) ──
     Sounds spaced out, then the whole word, with its picture.
     Flags: hideChips (no sound-by-sound help) / hideImage / hideWord. */
  blend(d, ctx, slide) {
    const items = d.items || [];
    const split = (w) => (w || '').split('').map(c => `<span class="lit-sound-chip">${escapeHtml(c)}</span>`).join('<span class="lit-plus">+</span>');
    return `${litHead(slide, d)}
      <div class="lit-grid">
        ${items.map(it => `
          <div class="lit-card">
            ${!d.hideImage ? `<div class="lit-frame">${litImg(it.word, 'photo')}</div>` : ''}
            ${!d.hideChips ? `<div class="lit-blend">${split(it.word)}</div>` : ''}
            ${!d.hideWord ? `<div class="lit-word">${escapeHtml(it.word || '')}${speakBtn(it.word)}</div>` : ''}
          </div>`).join('')}
      </div>`;
  },

  /* ── Literacy: picture–word (naming) ──  { word } → big picture + word.
     Flag: hideWord (name the picture from memory). */
  picwords(d, ctx, slide) {
    const items = d.items || [];
    return `${litHead(slide, d)}
      <div class="lit-grid">
        ${items.map(it => `
          <div class="lit-card">
            <div class="lit-frame lit-frame-lg">${litImg(it.word, it.prefer || 'photo')}</div>
            ${!d.hideWord ? `<div class="lit-word">${escapeHtml(it.word || '')}${speakBtn(it.word)}</div>` : ''}
          </div>`).join('')}
      </div>`;
  },

  /* ── Literacy: sight words (whole-word) ──
     The printed word is the star; a symbol sits beside it when the pack has one.
     Flag: hideSymbol (pure whole-word recognition). */
  sightwords(d, ctx, slide) {
    const items = d.items || [];
    return `${litHead(slide, d)}
      <div class="lit-grid lit-grid-sight">
        ${items.map(it => {
          const a = (typeof literacyImage === 'function') ? literacyImage(it.word, 'symbol') : null;
          return `
          <div class="lit-card lit-card-sight">
            ${(!d.hideSymbol && a) ? `<div class="lit-frame lit-frame-sm">${litImg(it.word, 'symbol')}</div>` : ''}
            <div class="lit-sightword">${escapeHtml(it.word || '')}</div>
            ${speakBtn(it.word)}
          </div>`;
        }).join('')}
      </div>`;
  },

  /* ── Literacy: context / oral warm-up ── one big picture + a modelled line. */
  context(d, ctx, slide) {
    return `${litHead(slide, d)}
      <div class="lit-context">
        ${d.word ? `<div class="lit-frame lit-frame-lg lit-context-pic">${litImg(d.word, d.prefer || 'photo')}</div>` : ''}
        ${d.oral ? `<div class="lit-context-oral">${litIco('say')} <span>${md(d.oral)}</span> ${speakBtn(d.oral)}</div>` : ''}
      </div>`;
  },

  /* ── Literacy: sentence frame ── the frame with a blank, then picture chips. */
  frame(d, ctx, slide) {
    const parts = String(d.frame || '').split('___');
    const sentence = parts.map((p, i) => escapeHtml(p) + (i < parts.length - 1 ? '<span class="lit-blank">&nbsp;&nbsp;&nbsp;</span>' : '')).join('');
    const words = (d.words || []).map(w => (typeof w === 'string' ? { word: w } : w));
    return `${litHead(slide, d)}
      <div class="lit-frame-sentence">${litIco('say')} <span>${sentence}</span></div>
      <div class="lit-grid">
        ${words.map(w => `
          <div class="lit-card">
            <div class="lit-frame lit-frame-lg">${litImg(w.word, w.prefer || 'photo')}</div>
            <div class="lit-word">${escapeHtml(w.word)}${speakBtn(w.word)}</div>
          </div>`).join('')}
      </div>`;
  },

  /* ── Literacy: real-life task + exit check ── */
  functional(d, ctx, slide) {
    return `${litHead(slide, d)}
      <div class="lit-task">
        <div class="lit-task-label">${litIco('write')} Your task</div>
        <p>${md(d.task || '')}</p>
      </div>
      ${d.exit ? `<div class="lit-exit">${litIco('check')} <span><b>Show you can:</b> ${md(d.exit)}</span></div>` : ''}`;
  },

  /* ── Literacy: interactive build-the-word (encoding) ── tap letters in order. */
  buildword(d, ctx, slide) {
    const word = String(d.word || '').toLowerCase();
    const tiles = _litShuffle(word).map((l, i) => `<button type="button" class="lit-btile" data-l="${escapeHtml(l)}" data-i="${i}" onclick="litBuildPick(this)">${escapeHtml(l)}</button>`).join('');
    const slots = word.split('').map(() => `<span class="lit-bslot"></span>`).join('');
    return `${litHead(slide, d)}
      <div class="lit-build" data-word="${escapeHtml(word)}">
        <div class="lit-frame lit-frame-lg lit-build-pic">${litImg(word, 'photo')}</div>
        <div class="lit-slots">${slots}</div>
        <div class="lit-tiles">${tiles}</div>
        <div class="lit-build-msg"></div>
        <button type="button" class="lit-build-reset" onclick="litBuildReset(this)">Start again</button>
      </div>`;
  },

  /* ── Literacy: sentence builder ── tap word tiles into order. */
  sentence(d, ctx, slide) {
    const target = String(d.sentence || '').trim();
    const punct = /[.?!]$/.test(target) ? target.slice(-1) : '';
    const words = target.replace(/[.?!]$/, '').split(/\s+/).filter(Boolean);
    const tiles = _litShuffle(words.slice()).map((wd, i) => `<button type="button" class="lit-wtile" data-w="${escapeHtml(wd)}" data-i="${i}" onclick="litSentPick(this)">${escapeHtml(wd)}</button>`).join('');
    const slots = words.map(() => `<span class="lit-wslot"></span>`).join('');
    return `${litHead(slide, d)}
      ${d.word ? `<div class="lit-frame lit-frame-lg lit-sent-pic">${litImg(d.word, 'photo')}</div>` : ''}
      <div class="lit-sentbuild" data-target="${escapeHtml(words.join(' '))}" data-punct="${escapeHtml(punct)}">
        <div class="lit-wslots">${slots}${punct ? `<span class="lit-wpunct">${escapeHtml(punct)}</span>` : ''}</div>
        <div class="lit-wtiles">${tiles}</div>
        <div class="lit-build-msg"></div>
        <button type="button" class="lit-build-reset" onclick="litSentReset(this)">Start again</button>
      </div>`;
  },

  /* ── Literacy: read for meaning ── short controlled sentences, each with a
     speaker and an optional picture (the key word). Bold marks a target word. */
  microtext(d, ctx, slide) {
    const sents = d.sentences || [];
    return `${litHead(slide, d)}
      <div class="lit-text">
        ${sents.map(s => {
          const text = (typeof s === 'string') ? s : (s.text || '');
          const pic = (typeof s === 'object' && s.word) ? `<div class="lit-text-pic">${litImg(s.word, s.prefer || 'photo')}</div>` : '';
          return `<div class="lit-text-line">${pic}<span class="lit-text-words">${md(text)}</span>${speakBtn(text)}</div>`;
        }).join('')}
      </div>`;
  },

  hero(d, ctx, slide) {
    const durationLabel = d.duration_label || (ctx && ctx.durationLabel) || '25-Minute Live Micro-Session';
    return `
      <div class="text-center py-6">
        <h3 class="text-2xl mb-2">${md(d.heading || slide.title)}</h3>
        <p class="text-sm mb-5" style="color:var(--muted);">${escapeHtml(durationLabel)}</p>
        <div class="inline-flex px-5 py-3 rounded-2xl mb-3" style="background:rgba(255,107,53,.07); border:1px solid rgba(255,107,53,.15);">
          <span class="text-sm font-semibold" style="color:var(--primary);">Today's Objective</span>
        </div>
        <p class="font-medium" style="color:var(--ink);">${md(d.goal)}</p>
        ${d.diagnostic ? `
          <div class="mt-4 mx-auto max-w-lg p-4 rounded-2xl text-left" style="background:rgba(6,214,160,.06); border:1px solid rgba(6,214,160,.18);">
            <p class="text-[11px] uppercase tracking-wider font-semibold mb-2" style="color:#059669;">Quick Check</p>
            <p class="text-sm mb-2" style="color:var(--ink);">${md(d.diagnostic.prompt)}</p>
            ${quizChoices(d.diagnostic.options)}
          </div>` : ''}
        ${d.warmup ? `
          <div class="mt-5 mx-auto max-w-md p-4 rounded-2xl text-left" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.14);">
            <p class="text-[11px] uppercase tracking-wider font-semibold mb-1" style="color:var(--secondary);">Warm-up</p>
            <p class="text-sm" style="color:var(--ink);">${md(d.warmup)}</p>
          </div>` : ''}
        ${d.can_do ? `<p class="text-sm mt-3 italic" style="color:var(--secondary);">"${md(d.can_do)}"</p>` : ''}
        <div class="flex justify-center flex-wrap gap-2 mt-6">
          ${(d.badges || []).map(b => `<span class="text-xs px-3 py-1 rounded-full" style="background:#F1F2F6; color:var(--muted);">${escapeHtml(b)}</span>`).join('')}
        </div>
      </div>`;
  },

  /* ── Slide 2 (Vocabulary): two-column word list ──
     Col 1: word (bold blue) + pronunciation (orange) + part of speech.
     Col 2: contextual definition + example (target word in **bold**).
     Optional L1 gloss line; collocation chips at the bottom. */
  wordlist(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="rounded-2xl overflow-hidden" style="border:1px solid var(--line);">
        ${(d.words || []).map((w, i) => `
          <div class="grid grid-cols-[minmax(0,38%)_1fr] gap-3 p-3" style="${i ? 'border-top:1px solid var(--line);' : ''}background:${i % 2 ? '#F8F9FD' : 'white'};">
            <div>
              <p class="text-base font-bold leading-tight" style="color:var(--secondary);">${md(w.word)}</p>
              ${w.pron ? `<p class="text-xs mt-0.5" style="color:var(--primary);">${escapeHtml(w.pron)}</p>` : ''}
              ${w.pos ? `<span class="inline-block text-[10px] mt-1 px-2 py-0.5 rounded-full uppercase tracking-wide" style="background:#F1F2F6; color:var(--muted);">${escapeHtml(w.pos)}</span>` : ''}
            </div>
            <div>
              <p class="text-sm" style="color:var(--ink);">${md(w.definition)}</p>
              ${w.example ? `<p class="text-sm mt-1 italic" style="color:var(--navy);">${md(w.example)}</p>` : ''}
              ${w.l1 ? `<p class="text-[11px] mt-1" style="color:var(--secondary);">${bidiText(w.l1)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${(d.collocations && d.collocations.length) ? `
        <div class="mt-4 p-3 rounded-2xl" style="background:rgba(255,210,63,.1); border:1px dashed rgba(255,210,63,.4);">
          <p class="text-[10px] font-bold uppercase tracking-wide mb-2" style="color:#B45309;">Collocations</p>
          <div class="flex flex-wrap gap-2">
            ${d.collocations.map(c => `<span class="text-sm px-3 py-1 rounded-full font-medium" style="background:white; border:1px solid rgba(255,210,63,.4); color:var(--navy);">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>` : ''}`;
  },

  rows(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-3">
        ${(d.rows || []).map(r => `
          <div class="phrase-row">
            <p class="text-sm font-semibold" style="color:var(--navy);">${md(r.main)}</p>
            ${r.sub ? `<p class="text-xs mt-0.5" style="color:var(--muted);">${md(r.sub)}</p>` : ''}
            ${r.note ? `<p class="text-[11px] mt-1" style="color:var(--primary);">${md(r.note)}</p>` : ''}
          </div>`).join('')}
      </div>`;
  },

  cards(d, ctx, slide) {
    const cols = d.cols === 2 ? 'grid-cols-2' : d.cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="grid ${cols} gap-3">
        ${(d.items || []).map(it => `
          <div class="vocab-card">
            <p class="text-sm font-semibold" style="color:var(--navy);">${md(it.top)}</p>
            ${it.mid ? `<p class="text-[11px] mt-0.5" style="color:var(--secondary);">${bidiText(it.mid)}</p>` : ''}
            ${it.bottom ? `<p class="text-[11px] mt-0.5" style="color:var(--muted);">${md(it.bottom)}</p>` : ''}
          </div>`).join('')}
      </div>`;
  },

  dialogue(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.instruction ? `<p class="text-sm mb-2 font-medium" style="color:var(--primary);">${md(d.instruction)}</p>` : ''}
      ${d.setting ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.setting)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-2.5">
        ${(d.lines || []).map(l => `
          <div class="flex ${l.side === 'right' ? 'justify-end' : ''}">
            <div class="dialogue-bubble ${l.side === 'right' ? 'right' : 'left'}">
              <span class="text-[10px] font-semibold block mb-0.5">${escapeHtml(l.speaker)}</span>${md(l.line)}
            </div>
          </div>`).join('')}
      </div>
      ${aidBar([disclosure('Notes', 'notes', d.notes ? `<p class="text-sm" style="color:var(--ink);">${md(d.notes)}</p>` : '')])}`;
  },

  table(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="rounded-2xl overflow-x-auto" style="border:1px solid var(--line);">
        <table class="w-full text-sm">
          <thead><tr style="background:#F1F2F6;">
            ${(d.headers || []).map(h => `<th class="text-left p-3 font-semibold" style="color:var(--navy);">${escapeHtml(h)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${(d.rows || []).map(row => `<tr style="border-top:1px solid var(--line);">${row.map(c => `<td class="p-3 align-top" style="color:var(--ink);">${md(c)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  },

  text(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.instruction ? `<p class="text-sm mb-2 font-medium" style="color:var(--primary);">${md(d.instruction)}</p>` : ''}
      ${d.source_label ? `<p class="text-[11px] uppercase tracking-wider mb-3 font-semibold" style="color:var(--muted);">${escapeHtml(d.source_label)}</p>` : '<div class="mb-3"></div>'}
      <div class="p-5 rounded-2xl space-y-3" style="background:#F8F9FD; border:1px solid var(--line);">
        ${(d.paragraphs || []).map(p => `<p class="text-sm leading-relaxed" style="color:var(--ink);">${md(p)}</p>`).join('')}
      </div>
      ${d.note ? `<div class="mt-3 p-3 rounded-xl text-xs" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);"><span class="font-semibold" style="color:var(--secondary);">Note:</span> <span style="color:var(--ink);">${md(d.note)}</span></div>` : ''}`;
  },

  compare(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-3">
        ${(d.pairs || []).map(p => `
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-xl" style="background:rgba(6,214,160,.07); border:1px solid rgba(6,214,160,.15);">
              <p class="text-[10px] font-semibold mb-1" style="color:#059669;">CORRECT</p>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(p.good)}</p>
            </div>
            <div class="p-3 rounded-xl" style="background:rgba(239,68,68,.05); border:1px solid rgba(239,68,68,.12);">
              <p class="text-[10px] font-semibold mb-1 text-red-500">NOT THIS</p>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(p.bad)}</p>
            </div>
          </div>
          ${p.note ? `<p class="text-[11px] -mt-1 px-1" style="color:var(--primary);">${md(p.note)}</p>` : ''}`).join('')}
      </div>`;
  },

  task(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-3">${escapeHtml(slide.title)}</h3>
      <div class="p-4 rounded-2xl mb-4" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.12);">
        <p class="font-semibold text-sm" style="color:var(--primary);">Scenario</p>
        <p class="text-sm mt-1" style="color:var(--ink);">${md(d.scenario)}</p>
      </div>
      <div class="space-y-2 mb-4">
        ${(d.steps || []).map((s, i) => `
          <div class="flex items-start gap-2.5">
            <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style="background:var(--primary);">${i + 1}</span>
            <p class="text-sm pt-0.5" style="color:var(--ink);">${md(s)}</p>
          </div>`).join('')}
      </div>
      ${(d.starters && d.starters.length) ? `
        <div class="p-3 rounded-xl mb-3" style="background:#F8F9FD; border:1px solid var(--line);">
          <p class="text-xs font-semibold mb-1.5" style="color:var(--secondary);">Sentence starters</p>
          ${d.starters.map(s => `<p class="text-sm" style="color:var(--navy);">${md(s)}</p>`).join('')}
        </div>` : ''}
      ${d.tip ? `<div class="p-3 rounded-xl text-xs mb-3" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.15);"><span class="font-semibold" style="color:#059669;">Tip:</span> <span style="color:var(--ink);">${md(d.tip)}</span></div>` : ''}
      ${(d.criteria && d.criteria.length) ? `
        <div class="p-3 rounded-xl" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);">
          <p class="text-xs font-semibold mb-1.5" style="color:var(--secondary);">Success criteria</p>
          ${d.criteria.map(c => `<p class="text-xs flex items-start gap-1.5" style="color:var(--ink);"><span style="color:var(--secondary);">-</span> ${md(c)}</p>`).join('')}
        </div>` : ''}
      ${d.notes ? aidBar([disclosure('Notes', 'notes', `<p class="text-sm" style="color:var(--ink);">${md(d.notes)}</p>`)]) : ''}
      ${(d.can_do || d.next_step) ? `
        <div class="mt-4 p-4 rounded-2xl" style="background:rgba(6,214,160,.07); border:1px solid rgba(6,214,160,.15);">
          ${d.can_do ? `<p class="text-sm font-medium" style="color:var(--ink);">"${md(d.can_do)}"</p>` : ''}
          ${d.next_step ? `<p class="text-xs mt-2" style="color:var(--muted);"><span class="font-semibold" style="color:#059669;">Next Step:</span> ${md(d.next_step)}</p>` : ''}
        </div>` : ''}`;
  },

  checklist(d, ctx, slide) {
    const numbered = d.style === 'numbered';
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-2">
        ${(d.items || []).map((it, i) => `
          <div class="flex items-start gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
            <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style="background:${numbered ? 'var(--secondary)' : '#059669'};">${numbered ? i + 1 : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'}</span>
            <div>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(it.text)}</p>
              ${it.hint ? `<p class="text-[11px] mt-0.5" style="color:var(--muted);">${md(it.hint)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${d.footer ? `<div class="mt-4 p-4 rounded-2xl" style="background:rgba(6,214,160,.07); border:1px solid rgba(6,214,160,.15);"><p class="font-semibold text-sm" style="color:#059669;">Next Step</p><p class="text-sm mt-1" style="color:var(--ink);">${md(d.footer)}</p></div>` : ''}`;
  },

  bankmatch(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-3" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-3"></div>'}
      ${bankChips(d.bank)}
      <div class="space-y-2.5">
        ${(d.prompts || []).map((p, i) => `
          <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
            <span class="text-[11px] font-bold w-5" style="color:var(--muted);">${i + 1}.</span>
            <p class="text-sm flex-1" style="color:var(--ink);">${md(typeof p === 'string' ? p : p.q)}</p>
          </div>`).join('')}
      </div>`;
  },

  /* ── Slide 5 (Vocabulary, 25-min): Fill-in-the-Blanks + Sentence Building ── */
  practice(d, ctx, slide) {
    const a = d.partA || {};
    const b = d.partB || {};
    return `
      <h3 class="text-lg mb-3">${escapeHtml(slide.title)}</h3>
      <div class="mb-5">
        <p class="text-sm font-semibold mb-2" style="color:var(--secondary);">Part A — Fill in the Blanks</p>
        ${a.instruction ? `<p class="text-xs mb-3" style="color:var(--muted);">${md(a.instruction)}</p>` : ''}
        ${bankChips(a.bank)}
        <div class="space-y-2.5">
          ${(a.sentences || []).map((s, i) => `
            <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
              <span class="text-[11px] font-bold w-5" style="color:var(--muted);">${i + 1}.</span>
              <p class="text-sm flex-1" style="color:var(--ink);">${md(s)}</p>
            </div>`).join('')}
        </div>
        ${aidBar([
          disclosure('Answer Keys', 'answers', aidNumberedList((a.answers || []).map(x => (typeof x === 'string' ? x : x.answer)))),
          disclosure('Feedback & Comment', 'feedback', aidNumberedList((a.answers || []).map(x => (x && x.feedback) || '').filter(Boolean)))
        ])}
      </div>
      <div>
        <p class="text-sm font-semibold mb-2" style="color:var(--secondary);">Part B — Sentence Building</p>
        ${b.instruction ? `<p class="text-xs mb-3" style="color:var(--muted);">${md(b.instruction)}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          ${(b.words || []).map(w => `<span class="text-sm px-3 py-1.5 rounded-xl font-medium" style="background:white; border:1px solid var(--line); color:var(--navy);">${escapeHtml(w)}</span>`).join('')}
        </div>
        ${aidBar([disclosure('Notes', 'notes', b.notes ? `<p class="text-sm" style="color:var(--ink);">${md(b.notes)}</p>` : '')])}
      </div>`;
  },

  /* ── Slide 3 (Vocabulary, 15-min): dialogue + mini-passage in one slide ── */
  integrated(d, ctx, slide) {
    const dl = d.dialogue || {};
    const ps = d.passage || {};
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.instruction ? `<p class="text-sm mb-3 font-medium" style="color:var(--primary);">${md(d.instruction)}</p>` : ''}
      ${dl.setting ? `<p class="text-sm mb-2" style="color:var(--muted);">${md(dl.setting)}</p>` : ''}
      <div class="space-y-2.5 mb-4">
        ${(dl.lines || []).map(l => `
          <div class="flex ${l.side === 'right' ? 'justify-end' : ''}">
            <div class="dialogue-bubble ${l.side === 'right' ? 'right' : 'left'}">
              <span class="text-[10px] font-semibold block mb-0.5">${escapeHtml(l.speaker)}</span>${md(l.line)}
            </div>
          </div>`).join('')}
      </div>
      <div class="p-5 rounded-2xl space-y-3" style="background:#F8F9FD; border:1px solid var(--line);">
        ${(ps.paragraphs || []).map(p => `<p class="text-sm leading-relaxed" style="color:var(--ink);">${md(p)}</p>`).join('')}
      </div>
      ${aidBar([disclosure('Notes', 'notes', d.notes ? `<p class="text-sm" style="color:var(--ink);">${md(d.notes)}</p>` : '')])}`;
  },

  /* ── Slide 4 (Vocabulary, 15-min): Application + one-line Review ── */
  applyreview(d, ctx, slide) {
    const app = d.application || {};
    const rev = d.review || {};
    return `
      <h3 class="text-lg mb-3">${escapeHtml(slide.title)}</h3>
      <div class="mb-5">
        <p class="text-sm font-semibold mb-2" style="color:var(--secondary);">Application</p>
        ${app.instruction ? `<p class="text-xs mb-3" style="color:var(--muted);">${md(app.instruction)}</p>` : ''}
        ${bankChips(app.bank)}
        <div class="space-y-2.5">
          ${(app.prompts || []).map((p, i) => `
            <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
              <span class="text-[11px] font-bold w-5" style="color:var(--muted);">${i + 1}.</span>
              <p class="text-sm flex-1" style="color:var(--ink);">${md(typeof p === 'string' ? p : p.q)}</p>
            </div>`).join('')}
        </div>
        ${aidBar([
          disclosure('Answer Keys', 'answers', aidNumberedList((app.answers || []).map(x => (typeof x === 'string' ? x : x.answer)))),
          disclosure('Feedback & Comment', 'feedback', aidNumberedList((app.answers || []).map(x => (x && x.feedback) || '').filter(Boolean))),
          disclosure('Notes', 'notes', app.notes ? `<p class="text-sm" style="color:var(--ink);">${md(app.notes)}</p>` : '')
        ])}
      </div>
      <div class="p-4 rounded-2xl" style="background:rgba(6,214,160,.07); border:1px solid rgba(6,214,160,.15);">
        ${rev.can_do ? `<p class="text-sm font-medium" style="color:var(--ink);">"${md(rev.can_do)}"</p>` : ''}
        ${rev.next_step ? `<p class="text-xs mt-2" style="color:var(--muted);"><span class="font-semibold" style="color:#059669;">Next Step:</span> ${md(rev.next_step)}</p>` : ''}
      </div>`;
  },

  /* ── Communication: Language Toolkit ── functional expressions grouped by
     communicative function (Open / Ask / Respond / Clarify / Close). */
  toolkit(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-4">
        ${(d.groups || []).map(g => `
          <div>
            <div class="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-2" style="background:rgba(0,78,137,.08); color:var(--secondary);">${escapeHtml(g.function || '')}</div>
            <div class="space-y-2">
              ${(g.items || []).map(it => {
                const phrase = typeof it === 'string' ? it : it.phrase;
                return `
                <div class="p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
                  <p class="text-sm font-semibold" style="color:var(--navy);">${md(phrase)}</p>
                  ${(it && it.use) ? `<p class="text-xs mt-0.5" style="color:var(--muted);">${md(it.use)}</p>` : ''}
                  ${(it && it.example) ? `<p class="text-xs mt-1 italic" style="color:var(--navy);">${md(it.example)}</p>` : ''}
                  ${(it && it.l1) ? `<p class="text-[11px] mt-0.5" style="color:var(--secondary);">${bidiText(it.l1)}</p>` : ''}
                </div>`; }).join('')}
            </div>
          </div>`).join('')}
      </div>
      ${d.repeat ? `<div class="mt-4 p-3 rounded-xl" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.12);"><span class="text-xs font-semibold" style="color:var(--primary);">Say it aloud:</span> <span class="text-xs" style="color:var(--ink);">${md(d.repeat)}</span></div>` : ''}`;
  },

  /* ── Grammar: Form & Use ── the core teaching slide, taught Meaning → Form →
     Use, adapted per grammar point. Renders (all optional, so older saved
     sessions with just formula/forms/use/examples still display):
       meaning → formula banner → forms (adaptive breakdown) →
       uses[] (or legacy `use` string) → legacy examples[] → exceptions[] →
       l1 → note (nuance). Target parts come **bold** from the model. */
  form(d, ctx, slide) {
    const sectionLabel = (text, color) =>
      `<p class="text-[10px] font-bold uppercase tracking-wide mb-2 mt-1" style="color:${color};">${text}</p>`;
    // USE: new uses[] array of {use, example}, or fall back to the old single `use` string.
    const uses = Array.isArray(d.uses) ? d.uses.filter(u => u && (u.use || u.example))
      : (d.use ? [{ use: d.use }] : []);
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-3" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-3"></div>'}
      ${d.meaning ? `
        <div class="p-3 rounded-xl mb-4" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);">
          ${sectionLabel('Meaning', 'var(--secondary)')}
          <p class="text-sm" style="color:var(--ink);">${md(d.meaning)}</p>
        </div>` : ''}
      ${d.formula ? `
        <div class="p-4 rounded-2xl mb-3 text-center" style="background:rgba(0,78,137,.06); border:1px solid rgba(0,78,137,.15);">
          <p class="text-[10px] font-bold uppercase tracking-wide mb-1" style="color:var(--secondary);">The Pattern</p>
          <p class="text-base font-bold" style="color:var(--navy);">${md(d.formula)}</p>
        </div>` : ''}
      ${(d.forms && d.forms.length) ? `
        <div class="space-y-2 mb-4">
          ${d.forms.map(f => `
            <div class="p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
              <div class="flex items-start gap-3">
                <span class="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full" style="background:rgba(0,78,137,.08); color:var(--secondary);">${escapeHtml(f.label || '')}</span>
                <p class="text-sm pt-0.5" style="color:var(--ink);">${md(f.example)}</p>
              </div>
              ${f.note ? `<p class="text-[11px] mt-1.5 ml-1" style="color:var(--muted);">${md(f.note)}</p>` : ''}
            </div>`).join('')}
        </div>` : ''}
      ${uses.length ? `
        <div class="mb-4">
          ${sectionLabel('Use it when', 'var(--primary)')}
          <div class="space-y-2">
            ${uses.map(u => `
              <div class="p-3 rounded-xl text-sm" style="background:rgba(255,107,53,.06); border:1px solid rgba(255,107,53,.12);">
                <span style="color:var(--ink);">${md(u.use || '')}</span>
                ${u.example ? `<p class="text-sm mt-1" style="color:var(--navy);">${md(u.example)}</p>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
      ${(d.examples && d.examples.length) ? `
        <div class="space-y-1.5 mb-4">
          ${d.examples.map(ex => `<p class="text-sm" style="color:var(--navy);">${md(ex)}</p>`).join('')}
        </div>` : ''}
      ${(d.exceptions && d.exceptions.length) ? `
        <div class="mb-3">
          ${sectionLabel('Watch out / Exceptions', '#B45309')}
          <div class="space-y-1.5">
            ${d.exceptions.map(x => `
              <div class="p-3 rounded-xl text-sm" style="background:rgba(255,210,63,.10); border:1px solid rgba(255,210,63,.30);">
                <span style="color:var(--ink);">${md(x.point || '')}</span>
                ${x.example ? `<p class="text-sm mt-1" style="color:var(--navy);">${md(x.example)}</p>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
      ${d.l1 ? `<p class="text-[11px] mt-2" style="color:var(--secondary);">${bidiText(d.l1)}</p>` : ''}
      ${d.note ? `<div class="mt-3 p-3 rounded-xl text-xs" style="background:rgba(239,68,68,.05); border:1px solid rgba(239,68,68,.12);"><span class="font-semibold text-red-500">Nuance:</span> <span style="color:var(--ink);">${md(d.note)}</span></div>` : ''}`;
  },

  /* ── Grammar Exercise 1: controlled practice — MCQ / gap-fill / judgment.
     Tutor clicks the learner's answer to reveal correct/incorrect + feedback. */
  exercise(d, ctx, slide) {
    const type = d.type || 'mcq';
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-3">
        ${(d.items || []).map((it, i) => {
          const q = `<p class="quiz-q"><span class="quiz-n">${i + 1}.</span> ${md(it.prompt || it.statement || it.sentence || '')}</p>`;
          if (type === 'gap') {
            return `<div class="quiz-item">${q}${revealInline('Reveal answer', `<strong style="color:#059669;">${md(it.answer || '')}</strong>${it.feedback ? ` — ${md(it.feedback)}` : ''}`)}</div>`;
          }
          const opts = it.options || (type === 'judgment'
            ? [ { text: 'Correct', correct: it.correct === true, feedback: it.feedback },
                { text: 'Incorrect', correct: it.correct === false, feedback: it.feedback } ]
            : []);
          return `<div class="quiz-item">${q}${quizChoices(opts)}</div>`;
        }).join('')}
      </div>`;
  },

  /* ── Grammar Exercise 2: True / False with instant per-answer feedback. ── */
  truefalse(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-3">
        ${(d.items || []).map((it, i) => `
          <div class="quiz-item">
            <p class="quiz-q"><span class="quiz-n">${i + 1}.</span> ${md(it.statement || '')}</p>
            ${quizChoices([
              { text: 'True', correct: it.isTrue === true, feedback: it.feedback },
              { text: 'False', correct: it.isTrue === false, feedback: it.feedback }
            ], true)}
          </div>`).join('')}
      </div>`;
  },

  /* ── Grammar Common Errors: wrong sentence, click to reveal the correction. ── */
  errors(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-3">
        ${(d.items || []).map((it, i) => `
          <div class="quiz-item">
            <p class="text-sm"><span class="quiz-n">${i + 1}.</span> <span class="err-wrong">${md(it.wrong || '')}</span></p>
            ${revealInline('Reveal correction', `<span class="err-correct">${md(it.correct || '')}</span>${it.why ? ` — <span style="color:var(--muted);">${md(it.why)}</span>` : ''}`)}
          </div>`).join('')}
      </div>`;
  },

  /* ── Grammar Communicative Practice: open production prompts + tutor aids. ── */
  production(d, ctx, slide) {
    const key = Array.isArray(d.answerKey) ? aidNumberedList(d.answerKey)
      : (d.answerKey ? `<p class="text-sm" style="color:var(--ink);">${md(d.answerKey)}</p>` : '');
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.instruction ? `<p class="text-sm mb-3 font-medium" style="color:var(--primary);">${md(d.instruction)}</p>` : ''}
      <div class="space-y-2 mb-2">
        ${(d.prompts || []).map((p, i) => `<div class="flex items-start gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);"><span class="quiz-n">${i + 1}.</span><p class="text-sm flex-1" style="color:var(--ink);">${md(p)}</p></div>`).join('')}
      </div>
      ${aidBar([
        disclosure('Answer Keys', 'answers', key),
        disclosure('Feedback & Comment', 'feedback', d.comment ? `<p class="text-sm" style="color:var(--ink);">${md(d.comment)}</p>` : ''),
        disclosure('Notes', 'notes', d.notes ? `<p class="text-sm" style="color:var(--ink);">${md(d.notes)}</p>` : '')
      ])}`;
  },

  /* ── Communication: Language Focus ── core sentence frames + mini-examples +
     call-and-response drills + (higher-level) richer variations. */
  focus(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      ${(d.frames && d.frames.length) ? `
        <div class="space-y-2 mb-4">
          ${d.frames.map(fr => `
            <div class="p-3 rounded-xl" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.14);">
              <p class="text-sm font-semibold" style="color:var(--navy);">${md(typeof fr === 'string' ? fr : fr.frame)}</p>
              ${(fr && fr.use) ? `<p class="text-xs mt-0.5" style="color:var(--muted);">${md(fr.use)}</p>` : ''}
            </div>`).join('')}
        </div>` : ''}
      ${(d.examples && d.examples.length) ? `
        <div class="p-4 rounded-2xl mb-4 space-y-1.5" style="background:#F8F9FD; border:1px solid var(--line);">
          ${d.examples.map(e => `<p class="text-sm" style="color:var(--ink);">${md(e)}</p>`).join('')}
        </div>` : ''}
      ${(d.drills && d.drills.length) ? `
        <p class="text-xs font-semibold mb-1.5" style="color:var(--secondary);">Say it: call &amp; response</p>
        <div class="space-y-2 mb-3">
          ${d.drills.map(dr => `
            <div class="p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
              <p class="text-sm" style="color:var(--muted);">Tutor: ${md(dr.prompt || '')}</p>
              <p class="text-sm font-medium" style="color:var(--navy);">You: ${md(dr.response || '')}</p>
            </div>`).join('')}
        </div>` : ''}
      ${(d.variations && d.variations.length) ? aidBar([disclosure('Notes', 'notes', `<p class="text-xs font-semibold mb-1" style="color:var(--secondary);">Richer variations</p>${aidNumberedList(d.variations)}`)]) : ''}`;
  },

  /* ── Communication: Conversation Questions ── each question reveals answer
     frame(s) on click; a tutor note on sequencing at the bottom. */
  questions(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-2">
        ${(d.items || []).map((it, i) => {
          const frames = (it.frames || []).map(fr => `${md(fr)}`).join('<br>');
          return `<div class="quiz-item">
            <p class="text-sm font-medium" style="color:var(--navy);"><span class="quiz-n">${i + 1}.</span> ${md(it.question || '')}</p>
            ${frames ? revealInline('Show answer frame', `<span style="color:var(--ink);">${frames}</span>`) : ''}
          </div>`; }).join('')}
      </div>
      ${d.notes ? aidBar([disclosure('Notes', 'notes', `<p class="text-sm" style="color:var(--ink);">${md(d.notes)}</p>`)]) : ''}`;
  }
};

/* ── Tutor aids: collapsible colour-coded disclosures (Notes / Answer Keys /
   Feedback & Comment). Visible to all; expand on click. Render only when the
   panel has content. The toggle works on the sibling panel, so duplicated
   slide HTML (e.g. the presentation overlay) never collides on ids. ── */
const AID_COLORS = {
  notes:    ['var(--secondary)', 'rgba(0,78,137,.08)',  'rgba(0,78,137,.22)'],
  answers:  ['#059669',          'rgba(6,214,160,.10)',  'rgba(6,214,160,.30)'],
  feedback: ['#B45309',          'rgba(255,210,63,.16)', 'rgba(255,210,63,.5)']
};
function disclosure(label, colorKey, innerHtml) {
  if (!innerHtml) return '';
  const [fg, bg, br] = AID_COLORS[colorKey] || AID_COLORS.notes;
  return `<div class="aid">
      <button type="button" class="aid-btn" onclick="toggleAid(this)" style="color:${fg};background:${bg};border:1px solid ${br};">
        <span>${escapeHtml(label)}</span><span class="aid-caret">▾</span>
      </button>
      <div class="aid-panel" hidden style="border:1px solid ${br};">${innerHtml}</div>
    </div>`;
}
function aidBar(items) {
  const shown = items.filter(Boolean);
  return shown.length ? `<div class="aid-bar">${shown.join('')}</div>` : '';
}
function aidNumberedList(arr) {
  if (!arr || !arr.length) return '';
  return `<ol class="aid-list">${arr.map(x => `<li>${md(String(x))}</li>`).join('')}</ol>`;
}
/* Global: toggle the panel that follows the clicked button. */
function toggleAid(btn) {
  const panel = btn && btn.nextElementSibling;
  if (panel) panel.hidden = !panel.hidden;
  const caret = btn && btn.querySelector('.aid-caret');
  if (caret) caret.textContent = panel && panel.hidden ? '▾' : '▴';
}

/* ── Interactive quiz choices (MCQ / True-False / judgment) ──
   Each choice reveals its own feedback and marks itself correct/incorrect on
   click. Tutor-driven: the tutor clicks the option the learner chose. Uses no
   ids, so duplicated slide HTML (presentation overlay) never collides. */
function quizChoices(options, row) {
  if (!options || !options.length) return '';
  return `<div class="quiz-choices${row ? ' row' : ''}">${options.map(o => {
    const text = typeof o === 'string' ? o : o.text;
    const fb = (o && o.feedback) ? o.feedback : '';
    return `<button type="button" class="quiz-choice" data-correct="${!!(o && o.correct)}" onclick="revealChoice(this)">
      <span class="quiz-choice-text">${md(text)}</span>
      ${fb ? `<span class="quiz-choice-fb" hidden>${md(fb)}</span>` : ''}
    </button>`; }).join('')}</div>`;
}
function revealChoice(btn) {
  const correct = btn.getAttribute('data-correct') === 'true';
  btn.classList.remove('is-correct', 'is-wrong');
  btn.classList.add(correct ? 'is-correct' : 'is-wrong');
  const fb = btn.querySelector('.quiz-choice-fb');
  if (fb) fb.hidden = false;
}
/* Inline click-to-reveal (gap-fill answers, common-error corrections). */
function revealInline(label, innerHtml) {
  return `<button type="button" class="reveal-btn" onclick="toggleAid(this)">${escapeHtml(label)}</button>
    <div class="aid-panel reveal-panel" hidden>${innerHtml}</div>`;
}

/* Shared: a "Word Bank" chip strip (used by bankmatch, practice, applyreview). */
function bankChips(bank) {
  if (!bank || !bank.length) return '';
  return `
    <div class="p-3 rounded-2xl mb-4 flex flex-wrap gap-2 justify-center" style="background:rgba(255,210,63,.1); border:1px dashed rgba(255,210,63,.4);">
      <span class="text-[10px] font-bold self-center uppercase tracking-wide" style="color:#B45309;">Word Bank:</span>
      ${bank.map(w => `<span class="text-sm px-3 py-1 rounded-full font-medium" style="background:white; border:1px solid rgba(255,210,63,.4); color:var(--navy);">${escapeHtml(w)}</span>`).join('')}
    </div>`;
}

/* Render one slide JSON → HTML string */
function renderSlideHTML(slide, ctx) {
  const builder = LAYOUT_BUILDERS[slide.layout] || LAYOUT_BUILDERS.rows;
  try {
    return `<div class="slide-body">${builder(slide.data || {}, ctx || {}, slide)}</div>`;
  } catch (e) {
    return `<div class="slide-body"><p class="text-sm text-red-500">Slide render error: ${escapeHtml(e.message)}</p></div>`;
  }
}

/* Render the full deck: attaches .html to each slide */
function renderAllSlides(content, ctx) {
  return (content.slides || []).map(slide => ({
    ...slide,
    html: renderSlideHTML(slide, ctx)
  }));
}
