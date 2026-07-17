/* ═══════════════════════════════════════════════════════
   Almitu Pro — Render Engine
   Turns slide JSON (from Claude / custom API / demo engine)
   into themed HTML. The 9 render templates (R1–R9) are
   sequences of these layouts — defined in prompts.js and
   produced by the engines. Layout = structure; tier rules
   live in the content itself.
   ═══════════════════════════════════════════════════════ */

function md(text) {
  // minimal markdown: **bold** → highlighted target item
  return escapeHtml(String(text ?? '')).replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--primary);">$1</strong>');
}

const LAYOUT_BUILDERS = {

  hero(d, ctx, slide) {
    return `
      <div class="text-center py-6">
        <div class="text-5xl mb-4">${escapeHtml(d.emoji || '🎯')}</div>
        <h3 class="text-2xl mb-2">${md(d.heading || slide.title)}</h3>
        <p class="text-sm mb-5" style="color:var(--muted);">25-Minute Live Micro-Session</p>
        <div class="inline-flex px-5 py-3 rounded-2xl mb-3" style="background:rgba(255,107,53,.07); border:1px solid rgba(255,107,53,.15);">
          <span class="text-sm font-semibold" style="color:var(--primary);">Today's Goal</span>
        </div>
        <p class="font-medium" style="color:var(--ink);">${md(d.goal)}</p>
        ${d.can_do ? `<p class="text-sm mt-3 italic" style="color:var(--secondary);">"${md(d.can_do)}"</p>` : ''}
        <div class="flex justify-center flex-wrap gap-2 mt-6">
          ${(d.badges || []).map(b => `<span class="text-xs px-3 py-1 rounded-full" style="background:#F1F2F6; color:var(--muted);">${escapeHtml(b)}</span>`).join('')}
        </div>
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
            ${it.emoji ? `<div class="text-2xl mb-1">${escapeHtml(it.emoji)}</div>` : ''}
            <p class="text-sm font-semibold" style="color:var(--navy);">${md(it.top)}</p>
            ${it.mid ? `<p class="text-[11px] mt-0.5" style="color:var(--secondary);">${escapeHtml(it.mid)}</p>` : ''}
            ${it.bottom ? `<p class="text-[11px] mt-0.5" style="color:var(--muted);">${md(it.bottom)}</p>` : ''}
          </div>`).join('')}
      </div>`;
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

  dialogue(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.setting ? `<p class="text-sm mb-4" style="color:var(--muted);">📍 ${md(d.setting)}</p>` : '<div class="mb-4"></div>'}
      <div class="space-y-2.5">
        ${(d.lines || []).map(l => `
          <div class="flex ${l.side === 'right' ? 'justify-end' : ''}">
            <div class="dialogue-bubble ${l.side === 'right' ? 'right' : 'left'}">
              <span class="text-[10px] font-semibold block mb-0.5">${escapeHtml(l.speaker)}</span>${md(l.line)}
            </div>
          </div>`).join('')}
      </div>`;
  },

  table(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-4" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-4"></div>'}
      <div class="rounded-2xl overflow-hidden" style="border:1px solid var(--line);">
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
      ${d.source_label ? `<p class="text-[11px] uppercase tracking-wider mb-3 font-semibold" style="color:var(--muted);">📄 ${escapeHtml(d.source_label)}</p>` : '<div class="mb-3"></div>'}
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
              <p class="text-[10px] font-semibold mb-1" style="color:#059669;">✓ CORRECT</p>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(p.good)}</p>
            </div>
            <div class="p-3 rounded-xl" style="background:rgba(239,68,68,.05); border:1px solid rgba(239,68,68,.12);">
              <p class="text-[10px] font-semibold mb-1 text-red-500">✗ NOT THIS</p>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(p.bad)}</p>
            </div>
          </div>
          ${p.note ? `<p class="text-[11px] -mt-1 px-1" style="color:var(--primary);">→ ${md(p.note)}</p>` : ''}`).join('')}
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
      ${d.tip ? `<div class="p-3 rounded-xl text-xs mb-3" style="background:rgba(6,214,160,.08); border:1px solid rgba(6,214,160,.15);"><span class="font-semibold" style="color:#059669;">💡 Tip:</span> <span style="color:var(--ink);">${md(d.tip)}</span></div>` : ''}
      ${(d.criteria && d.criteria.length) ? `
        <div class="p-3 rounded-xl" style="background:rgba(0,78,137,.05); border:1px solid rgba(0,78,137,.12);">
          <p class="text-xs font-semibold mb-1.5" style="color:var(--secondary);">Success criteria</p>
          ${d.criteria.map(c => `<p class="text-xs flex items-start gap-1.5" style="color:var(--ink);"><span style="color:var(--secondary);">▸</span> ${md(c)}</p>`).join('')}
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
            <span class="flex-shrink-0 ${numbered ? 'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white' : 'text-base'}" style="${numbered ? 'background:var(--secondary);' : 'color:#059669;'}">${numbered ? i + 1 : '✓'}</span>
            <div>
              <p class="text-sm font-medium" style="color:var(--ink);">${md(it.text)}</p>
              ${it.hint ? `<p class="text-[11px] mt-0.5" style="color:var(--muted);">${md(it.hint)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${d.footer ? `<div class="mt-4 p-4 rounded-2xl" style="background:rgba(6,214,160,.07); border:1px solid rgba(6,214,160,.15);"><p class="font-semibold text-sm" style="color:#059669;">📝 Homework</p><p class="text-sm mt-1" style="color:var(--ink);">${md(d.footer)}</p></div>` : ''}`;
  },

  bankmatch(d, ctx, slide) {
    return `
      <h3 class="text-lg mb-1">${escapeHtml(slide.title)}</h3>
      ${d.intro ? `<p class="text-sm mb-3" style="color:var(--muted);">${md(d.intro)}</p>` : '<div class="mb-3"></div>'}
      <div class="p-3 rounded-2xl mb-4 flex flex-wrap gap-2 justify-center" style="background:rgba(255,210,63,.1); border:1px dashed rgba(255,210,63,.4);">
        <span class="text-[10px] font-bold self-center uppercase tracking-wide" style="color:#B45309;">Word Bank:</span>
        ${(d.bank || []).map(w => `<span class="text-sm px-3 py-1 rounded-full font-medium" style="background:white; border:1px solid rgba(255,210,63,.4); color:var(--navy);">${escapeHtml(w)}</span>`).join('')}
      </div>
      <div class="space-y-2.5">
        ${(d.prompts || []).map((p, i) => `
          <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#F8F9FD; border:1px solid var(--line);">
            <span class="text-[11px] font-bold w-5" style="color:var(--muted);">${i + 1}.</span>
            <p class="text-sm flex-1" style="color:var(--ink);">${md(p.q)}</p>
          </div>`).join('')}
      </div>`;
  }
};

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
