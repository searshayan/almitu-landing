/* ═══════════════════════════════════════════════════════
   Almitu Pro — Generation API Router
   Routes generation to: Claude API | Custom API | Demo.
   On API failure → graceful fallback to Demo with warning.
   ═══════════════════════════════════════════════════════ */

/* PHASE 1 — slides only (fast; the tutor reviews/edits these before launch). */
async function generateSlides(formData) {
  const cfg = getConfig();

  if (cfg.engine === 'claude' && cfg.claudeKey) {
    try {
      const parsed = await callClaude(formData, cfg);
      return { content: { slides: parsed.slides }, engineUsed: 'Claude API' };
    } catch (e) {
      console.error('Claude API error:', e);
      return { content: demoSlides(formData), engineUsed: 'Demo (fallback)', warning: 'Claude API failed: ' + e.message + ' — showing demo slides instead.' };
    }
  }

  if (cfg.engine === 'custom' && cfg.customUrl && cfg.customKey) {
    try {
      const parsed = await callCustom(formData, cfg);
      return { content: { slides: parsed.slides }, engineUsed: 'Custom API' };
    } catch (e) {
      console.error('Custom API error:', e);
      return { content: demoSlides(formData), engineUsed: 'Demo (fallback)', warning: 'Custom API failed: ' + e.message + ' — showing demo slides instead.' };
    }
  }

  // Slides-only demo is quick — no long wait for the tutor.
  await new Promise(r => setTimeout(r, 1500));
  return { content: demoSlides(formData), engineUsed: 'Demo Engine' };
}

/* PHASE 2 — post-session practice bank (deferred; runs in the background
   after the tutor launches, so it's ready by the student dashboard). */
async function generatePracticeBank(formData, slides) {
  const cfg = getConfig();

  if (cfg.engine === 'claude' && cfg.claudeKey) {
    try { return await callClaudePractice(formData, slides, cfg); }
    catch (e) { console.error('Practice API error:', e); return demoPracticeBank(formData); }
  }
  if (cfg.engine === 'custom' && cfg.customUrl && cfg.customKey) {
    try { return await callCustomPractice(formData, slides, cfg); }
    catch (e) { console.error('Practice API error:', e); return demoPracticeBank(formData); }
  }
  await new Promise(r => setTimeout(r, 1000));
  return demoPracticeBank(formData);
}

async function callClaudePractice(formData, slides, cfg) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.claudeModel || 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: [{ type: 'text', text: buildPracticeBankSystemPrompt(formData), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildPracticeBankUserPrompt(formData, slides) }]
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  logTokenUsage('practice', data.usage);
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return parsePracticeJSON(text);
}

async function callCustomPractice(formData, slides, cfg) {
  const base = cfg.customUrl.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + cfg.customKey },
    body: JSON.stringify({
      model: cfg.customModel || 'gpt-4o',
      messages: [
        { role: 'system', content: buildPracticeBankSystemPrompt(formData) },
        { role: 'user', content: buildPracticeBankUserPrompt(formData, slides) }
      ],
      max_tokens: 3000
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return parsePracticeJSON(data.choices?.[0]?.message?.content || '');
}

function parsePracticeJSON(text) {
  let raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in practice response');
  const parsed = JSON.parse(raw.slice(start, end + 1));
  const pb = parsed.practice_bank || parsed;
  return { items: pb.items || [], sentences: pb.sentences || [] };
}

/* ── Auto-fill routing ── */

async function autofillFields(meta, fieldsToFill) {
  const cfg = getConfig();

  if (cfg.engine === 'claude' && cfg.claudeKey) {
    try { return await autofillClaude(meta, fieldsToFill, cfg); }
    catch (e) { console.error('Auto-fill API error:', e); showToast('API auto-fill failed — using built-in suggestions.', 'warn'); return demoAutofill(meta); }
  }
  if (cfg.engine === 'custom' && cfg.customUrl && cfg.customKey) {
    try { return await autofillCustom(meta, fieldsToFill, cfg); }
    catch (e) { console.error('Auto-fill API error:', e); showToast('API auto-fill failed — using built-in suggestions.', 'warn'); return demoAutofill(meta); }
  }
  await new Promise(r => setTimeout(r, 900));
  return demoAutofill(meta);
}

async function autofillClaude(meta, fieldsToFill, cfg) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.claudeModel || 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: buildAutofillSystemPrompt(meta),
      messages: [{ role: 'user', content: buildAutofillUserPrompt(meta, fieldsToFill) }]
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return parseFlatJSON(text);
}

async function autofillCustom(meta, fieldsToFill, cfg) {
  const base = cfg.customUrl.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + cfg.customKey },
    body: JSON.stringify({
      model: cfg.customModel || 'gpt-4o',
      messages: [
        { role: 'system', content: buildAutofillSystemPrompt(meta) },
        { role: 'user', content: buildAutofillUserPrompt(meta, fieldsToFill) }
      ],
      max_tokens: 1500
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return parseFlatJSON(data.choices?.[0]?.message?.content || '');
}

function parseFlatJSON(text) {
  let raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(raw.slice(start, end + 1));
}

/* ── Claude API (direct browser call) ── */

async function callClaude(formData, cfg) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.claudeModel || 'claude-sonnet-4-6',
      max_tokens: 8192,
      // Prompt caching: the system prompt (engine role + tier rules + layout
      // schema + contract, ~1.2k tokens) is the large, repeated portion. The
      // cache_control breakpoint caches it as a prefix. Subsequent calls that
      // build an IDENTICAL system prompt — i.e. same tier + level + language +
      // L1 setting, the common "several sessions for one student" pattern —
      // read it back at ~0.1x input cost instead of full price.
      // NOTE: caching only triggers above the model's minimum cacheable length
      // (1024 tokens for Sonnet/Opus, 2048 for Haiku); harmless no-op otherwise.
      system: [
        { type: 'text', text: buildSystemPrompt(formData), cache_control: { type: 'ephemeral' } }
      ],
      messages: [{ role: 'user', content: buildUserPrompt(formData) }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  logTokenUsage('generate', data.usage);
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return parseContentJSON(text);
}

/* Log token usage incl. cache hits/writes so cost savings are verifiable in console. */
function logTokenUsage(label, usage) {
  if (!usage) return;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const hit = cacheRead > 0 ? ` · CACHE HIT (${cacheRead} tok read @ ~0.1x)` : (cacheWrite > 0 ? ` · cache written (${cacheWrite} tok)` : '');
  console.log(`[almitu ${label}] input:${inTok} output:${outTok}${hit}`);
}

/* ── Custom API (OpenAI-compatible chat completions) ── */

async function callCustom(formData, cfg) {
  // OpenAI-compatible endpoints apply prompt caching automatically server-side
  // for long stable prefixes (no cache_control field needed), so the system
  // prompt benefits here too without extra code.
  const base = cfg.customUrl.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': 'Bearer ' + cfg.customKey
    },
    body: JSON.stringify({
      model: cfg.customModel || 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt(formData) },
        { role: 'user', content: buildUserPrompt(formData) }
      ],
      max_tokens: 8192
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseContentJSON(text);
}

/* ── Robust JSON extraction & validation ── */

function parseContentJSON(text) {
  let raw = text.trim();
  // strip code fences if the model added them anyway
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // grab outermost object
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  const parsed = JSON.parse(raw.slice(start, end + 1));

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) throw new Error('Response has no slides');
  if (!parsed.practice_bank || !Array.isArray(parsed.practice_bank.items)) {
    parsed.practice_bank = { items: [], sentences: [] };
  }
  parsed.practice_bank.sentences = parsed.practice_bank.sentences || [];
  return parsed;
}
