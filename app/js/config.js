/* ═══════════════════════════════════════════════════════
   Almitu Pro — AI Engine Configuration
   Demo (rule-based) | Claude API | Custom API (OpenAI-compatible)

   The config is now stored centrally in Supabase (app_settings) and
   managed by admins. It's cached in memory (window._almituConfig) so
   getConfig() stays synchronous for the generation code paths.
   ═══════════════════════════════════════════════════════ */

const DEFAULT_CONFIG = {
  engine: 'demo',                 // 'demo' | 'claude' | 'custom'
  claudeKey: '',
  claudeModel: 'claude-sonnet-4-6',
  customUrl: '',
  customKey: '',
  customModel: ''
};

/* Map a Supabase app_settings row → the in-memory config shape. */
function settingsRowToConfig(row) {
  if (!row) return { ...DEFAULT_CONFIG };
  return {
    engine: row.engine || 'demo',
    claudeKey: row.claude_key || '',
    claudeModel: row.claude_model || 'claude-sonnet-4-6',
    customUrl: row.custom_url || '',
    customKey: row.custom_key || '',
    customModel: row.custom_model || ''
  };
}

/* Synchronous accessor used by the generation code. Falls back to demo
   until the remote config has loaded. */
function getConfig() {
  return window._almituConfig || { ...DEFAULT_CONFIG };
}

/* Load the central config once per session (called for admins + tutors). */
async function loadRemoteConfig() {
  try {
    const row = await dataGetSettings();
    window._almituConfig = settingsRowToConfig(row);
  } catch (e) {
    console.warn('Could not load AI config; using Demo engine.', e);
    window._almituConfig = { ...DEFAULT_CONFIG };
  }
  updateEngineChip();
  return window._almituConfig;
}

/* ── Settings Modal (opened from the Admin dashboard) ── */

function openSettings() {
  const cfg = getConfig();
  document.getElementById('settingsModal').classList.remove('hidden');
  document.querySelectorAll('input[name="engineChoice"]').forEach(r => { r.checked = r.value === cfg.engine; });
  document.getElementById('cfgClaudeKey').value = cfg.claudeKey;
  document.getElementById('cfgClaudeModel').value = cfg.claudeModel;
  document.getElementById('cfgCustomUrl').value = cfg.customUrl;
  document.getElementById('cfgCustomKey').value = cfg.customKey;
  document.getElementById('cfgCustomModel').value = cfg.customModel;
  updateEngineSections();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function updateEngineSections() {
  const selected = document.querySelector('input[name="engineChoice"]:checked')?.value || 'demo';
  document.getElementById('claudeSection').classList.toggle('hidden', selected !== 'claude');
  document.getElementById('customSection').classList.toggle('hidden', selected !== 'custom');
}

async function saveSettings() {
  const cfg = {
    engine: document.querySelector('input[name="engineChoice"]:checked')?.value || 'demo',
    claudeKey: document.getElementById('cfgClaudeKey').value.trim(),
    claudeModel: document.getElementById('cfgClaudeModel').value.trim() || 'claude-sonnet-4-6',
    customUrl: document.getElementById('cfgCustomUrl').value.trim(),
    customKey: document.getElementById('cfgCustomKey').value.trim(),
    customModel: document.getElementById('cfgCustomModel').value.trim()
  };

  if (cfg.engine === 'claude' && !cfg.claudeKey) { showToast('Please paste your Claude API key, or switch to Demo.', 'error'); return; }
  if (cfg.engine === 'custom' && (!cfg.customUrl || !cfg.customKey)) { showToast('Custom API needs a Base URL and a key.', 'error'); return; }

  try {
    await dataSaveSettings({
      engine: cfg.engine,
      claude_key: cfg.claudeKey,
      claude_model: cfg.claudeModel,
      custom_url: cfg.customUrl,
      custom_key: cfg.customKey,
      custom_model: cfg.customModel
    });
    window._almituConfig = cfg;
    updateEngineChip();
    closeSettings();
    showToast('AI Engine settings saved for everyone.', 'success');
  } catch (e) {
    showToast('Could not save settings: ' + e.message, 'error');
  }
}

function updateEngineChip() {
  const cfg = getConfig();
  const chip = document.getElementById('engineChip');
  if (!chip) return;   // header chip removed; only present if an admin view adds it
  const labels = { demo: 'Demo Engine', claude: 'Claude API', custom: 'Custom API' };
  const colors = { demo: '#B45309', claude: '#C44A22', custom: '#004E89' };
  const bgs = { demo: 'rgba(255,210,63,.12)', claude: 'rgba(255,107,53,.1)', custom: 'rgba(0,78,137,.08)' };
  chip.textContent = labels[cfg.engine];
  chip.style.color = colors[cfg.engine];
  if (chip.parentElement) chip.parentElement.style.background = bgs[cfg.engine];
}

/* ── Toast notifications ── */

function showToast(msg, kind) {
  const colors = { success: '#06D6A0', error: '#EF4444', info: '#004E89', warn: '#FF6B35' };
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeftColor = colors[kind] || colors.info;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4200);
}
