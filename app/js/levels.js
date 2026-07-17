/* ═══════════════════════════════════════════════════════
   Almitu Pro — CEFR Levels & Tier System
   7 levels grouped into 3 tiers. The tier drives the
   render template (R1–R9) and the prompt; the exact level
   drives content complexity inside the prompt.
   ═══════════════════════════════════════════════════════ */

const LEVELS = [
  { value: 'Pre-A1', label: 'Beginner (Pre-A1)',          tier: 'foundation' },
  { value: 'A1',     label: 'Elementary (A1)',            tier: 'foundation' },
  { value: 'A2',     label: 'Pre-Intermediate (A2)',      tier: 'development' },
  { value: 'B1',     label: 'Intermediate (B1)',          tier: 'development' },
  { value: 'B2',     label: 'Upper-Intermediate (B2)',    tier: 'proficiency' },
  { value: 'C1',     label: 'Advanced (C1)',              tier: 'proficiency' },
  { value: 'C2',     label: 'Mastery (C2)',               tier: 'proficiency' }
];

const TIERS = {
  foundation: {
    key: 'foundation',
    label: 'Foundation',
    levels: 'Pre-A1 · A1',
    color: '#E85A2A',
    bg: 'rgba(255,107,53,.08)',
    border: 'rgba(255,107,53,.25)',
    desc: 'L1 hints · image support · word banks · memorized chunks · oral-first · short high-success activities',
    rules: [
      'L1 hints visible (when L1 support is enabled)',
      'Image/emoji support throughout',
      'Word banks always provided in activities',
      'Memorized chunk approach',
      'Oral-first, minimal writing',
      'Max 6 to 12 vocabulary items',
      'Short, high-success activities'
    ]
  },
  development: {
    key: 'development',
    label: 'Development',
    levels: 'A2 · B1',
    color: '#004E89',
    bg: 'rgba(0,78,137,.07)',
    border: 'rgba(0,78,137,.22)',
    desc: 'Context-based introduction · collocations & word families · guided writing · semi-structured production',
    rules: [
      'Context-based word/structure introduction',
      'No L1 hints (unless selected by tutor)',
      'No word banks in activities',
      'Collocations and word families',
      'Short paragraph contexts',
      'Guided writing (sentence starters)',
      'Semi-structured production tasks'
    ]
  },
  proficiency: {
    key: 'proficiency',
    label: 'Proficiency',
    levels: 'B2 · C1 · C2',
    color: '#7C3AED',
    bg: 'rgba(124,58,246,.07)',
    border: 'rgba(124,58,246,.22)',
    desc: 'Authentic texts · zero scaffolding · register & nuance · critical analysis · extended production · self-assessment',
    rules: [
      'Authentic text materials',
      'Zero scaffolding (no word banks, no frames, no L1)',
      'Register and nuance focus',
      'Critical analysis tasks',
      'Extended open-ended production',
      'Self-assessment and peer feedback',
      'Rhetorical and stylistic awareness'
    ]
  }
};

function tierForLevel(levelValue) {
  const lvl = LEVELS.find(l => l.value === levelValue);
  return lvl ? lvl.tier : 'foundation';
}

function getTier(tierKey) {
  return TIERS[tierKey] || TIERS.foundation;
}

/* Render matrix: skill × tier → render id (for labeling/debug) */
const RENDER_MATRIX = {
  vocabulary:    { foundation: 'R1', development: 'R2', proficiency: 'R3' },
  grammar:       { foundation: 'R4', development: 'R5', proficiency: 'R6' },
  communication: { foundation: 'R7', development: 'R8', proficiency: 'R9' }
};

function renderIdFor(skill, tier) {
  return (RENDER_MATRIX[skill] && RENDER_MATRIX[skill][tier]) || 'R1';
}

/* ── L1 language resolution ──
   The dropdown shows tutor-friendly labels (what the tutor recognizes),
   but the AI must be instructed in the precise language variety so it
   produces the correct script/dialect. Example: a tutor picks
   "Farsi Afghanistan" (an Afghan learner) → the model is told to write
   L1 support in Dari (Afghan Persian), not Iranian Farsi.
   The friendly label is still what shows in the UI; only the prompt
   sees the resolved name. */
const L1_LANGUAGE_MAP = {
  'Farsi Afghanistan': 'Dari (Afghan Persian — the Persian variety spoken in Afghanistan, in Perso-Arabic script)',
  'Farsi Iran': 'Farsi (Iranian Persian, in Perso-Arabic script)'
};

function resolveL1Language(value) {
  return L1_LANGUAGE_MAP[value] || value;
}

/* ── L1 support availability by tier ──
   Foundation & Development: tutor may toggle L1 support.
   Proficiency: L1 support is pedagogically inappropriate — always off. */
function l1Allowed(tierKey) {
  return tierKey !== 'proficiency';
}

/* ── Exact-CEFR descriptors ──
   Injected into prompts so generation calibrates to the precise level,
   not just the tier. This is what makes A2 ≠ B1 and B2 ≠ C1 ≠ C2. */
const LEVEL_DESCRIPTORS = {
  'Pre-A1': 'Absolute beginner. Isolated high-frequency words, fixed greetings, and memorised chunks only. No independent sentence building yet. Everything supported by images and L1.',
  'A1':     'Basic user. Simple present-tense statements and questions about immediate, concrete needs. Very short turns, heavy scaffolding, familiar everyday words.',
  'A2':     'Elementary. Simple connected sentences about routine matters; can use past and near-future with support. Short paragraph contexts, light scaffolding, common collocations.',
  'B1':     'Intermediate. Copes with most everyday, travel and work situations; connected discourse; can give opinions with basic reasons. Semi-structured production, minimal scaffolding.',
  'B2':     'Upper-intermediate. Clear, detailed language on a range of topics; can argue a viewpoint and handle some abstraction and nuance. No scaffolding; register awareness begins.',
  'C1':     'Advanced. Fluent, spontaneous, flexible use; grasps implicit meaning; effective language for social, academic and professional purposes. Extended, well-structured output; precision and stance.',
  'C2':     'Mastery. Near-native precision; subtle shades of meaning, idiom and style handled effortlessly; can restructure discourse for rhetorical effect. Maximum lexical/syntactic sophistication.'
};

function levelDescriptor(level) {
  return LEVEL_DESCRIPTORS[level] || LEVEL_DESCRIPTORS['A1'];
}

/* ── Session duration modes ──
   15-min is a distinct architecture, NOT a shortened 25-min. */
const DURATIONS = {
  15: {
    key: 15,
    label: '15-min micro session',
    slideCount: 6,
    arc: 'the same 6-slide arc, delivered with reduced language load and tighter tasks',
    rules: [
      'SAME 6 slides as the 25-min session — scale DENSITY and DEPTH, never slide count',
      'Fewer target items (≈6-8), fewer word-bank clues (≈4-6), fewer scenario steps (3-4)',
      'Reduced explanation; tighter instructions; lighter, more focused homework',
      'Keep one clear production task and a concise one-point feedback/close'
    ]
  },
  25: {
    key: 25,
    label: '25-min normal session',
    slideCount: 6,
    arc: 'the full 6-slide arc: Objective → Words/Focus/Phrases → Listen & Repeat/Form → Word Bank/Practice → Scenario/Speak → Review & Homework',
    rules: [
      'Fuller scope: up to 10-12 words / 6-8 clues / 4-5 scenario steps',
      'Room for a substantial communicative/production stage',
      'Richer feedback and a broader but still focused review'
    ]
  }
};

function getDuration(d) {
  return DURATIONS[Number(d)] || DURATIONS[25];
}
