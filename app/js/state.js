/* ═══════════════════════════════════════════════════════
   Almitu Pro — Global State Management

   State is organized into conceptual layers (see fingerprint.js):
   1. Input Form State      — studentProfile + duration + sessionType + details
   2. Generation Fingerprint — generation.fingerprint / generation.stale
   3. Generated Content      — generatedLessonPlan
   4. Session Instance       — each saved notebook (studentId + fingerprint + id)
   5. Practice State         — selectedNotebookId + per-notebook progress
   ═══════════════════════════════════════════════════════ */

function freshState() {
  return {
    activeRole: 'tutor',
    currentStep: 1,
    currentSlide: 0,
    previewSlide: 0,

    // ── Input form state ──
    sessionDuration: 25,          // 15 | 25 — first-class generation driver
    sessionType: 'vocabulary',
    studentProfile: {
      name: 'Amira',
      language: 'Ukrainian',
      countryOfResident: 'Canada',
      level: 'A1',
      l1Support: true
    },

    // ── Generation fingerprint state ──
    generation: {
      fingerprint: null,          // fingerprint of the content currently generated
      stale: false                // true when a content-driving input changed post-generation
    },

    // ── Generated content state ──
    generatedLessonPlan: null,    // { meta, formData, content, slides[], engineUsed, fingerprint }

    // ── Live session ──
    liveChatLog: [],

    // ── Session instances + practice ──
    savedNotebooks: [],           // each: { id, studentId, fingerprint, student, plan, ... }
    selectedNotebookId: null      // which session the student is practicing
  };
}

window.almituState = freshState();

function getState() { return window.almituState; }
function resetState() { window.almituState = freshState(); }

/* ═══════════════════════════════════════════════════════
   Session persistence now lives in Supabase (see js/data.js).
   savedNotebooks is an in-memory projection of the current
   user's `sessions` rows, loaded per dashboard. These two
   helpers are kept as harmless no-ops so any legacy call site
   doesn't break.
   ═══════════════════════════════════════════════════════ */

function persistNotebooks() { /* no-op: sessions persist server-side */ }
function loadPersistedNotebooks() { /* no-op: loaded from Supabase per role */ }
