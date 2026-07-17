/* ═══════════════════════════════════════════════════════
   Almitu Pro — Generation Fingerprinting & Invalidation
   Separates CONTENT-GENERATION variables from INSTANCE /
   PERSONALIZATION variables. The fingerprint decides when
   AI content must be regenerated vs. safely reused.

   Included (content-driving):  cefrLevel, tier, skill,
     duration, normalizedTopic, countryOfResident, l1Support,
     firstLanguage (ONLY when l1Support = true).
   Excluded (instance-only):    studentName.

   → Changing student name reuses content (Feedback 3).
   → Changing level / duration / L1 / topic / country / skill
     invalidates and forces regeneration.
   ═══════════════════════════════════════════════════════ */

/* The primary title field differs per skill. */
function mainTitleOf(formData) {
  const d = formData.details || {};
  return d.vocabTheme || d.grammarTitle || d.scenarioTitle || d.topic || '';
}

/* Normalize a topic so trivial differences don't bust the cache. */
function normalizeTopic(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/* Small stable string hash (djb2) → short hex fingerprint. */
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* Build the canonical, order-stable fingerprint payload. */
function fingerprintPayload(formData) {
  return {
    cefr: formData.level,
    tier: formData.tier,
    skill: formData.sessionType,
    duration: Number(formData.duration),
    topic: normalizeTopic(mainTitleOf(formData)),
    country: (formData.countryOfResident || '').trim().toLowerCase(),
    l1: formData.l1Support ? 'on' : 'off',
    // first language only matters to content when L1 support is on
    firstLang: formData.l1Support ? (formData.language || '') : ''
  };
}

function computeFingerprint(formData) {
  return hashString(JSON.stringify(fingerprintPayload(formData)));
}

/* Deterministic student id from name (instance identity, not content). */
function studentIdFromName(name) {
  return 'stu_' + hashString(String(name || 'student').trim().toLowerCase());
}
