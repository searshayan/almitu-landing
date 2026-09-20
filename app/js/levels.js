/* ═══════════════════════════════════════════════════════
   Almitu Pro — CEFR Levels & Tier System
   7 levels grouped into 3 tiers. The tier drives the
   render template (R1–R9) and the prompt; the exact level
   drives content complexity inside the prompt.
   ═══════════════════════════════════════════════════════ */

const LEVELS = [
  { value: 'LIT1',   label: 'Literacy 1 · Sounds & Pictures', tier: 'literacy' },
  { value: 'LIT2',   label: 'Literacy 2 · Letters & Sounds',  tier: 'literacy' },
  { value: 'LIT3',   label: 'Literacy 3 · Word Building',      tier: 'literacy' },
  { value: 'LIT4',   label: 'Literacy 4 · Sentences & Grammar', tier: 'literacy' },
  { value: 'LIT5',   label: 'Literacy 5 · Reading for Meaning', tier: 'literacy' },
  { value: 'LIT6',   label: 'Literacy 6 · Functional Reading & Writing', tier: 'literacy' },
  { value: 'Pre-A1', label: 'Beginner (Pre-A1)',          tier: 'foundation' },
  { value: 'A1',     label: 'Elementary (A1)',            tier: 'foundation' },
  { value: 'A2',     label: 'Pre-Intermediate (A2)',      tier: 'development' },
  { value: 'B1',     label: 'Intermediate (B1)',          tier: 'development' },
  { value: 'B2',     label: 'Upper-Intermediate (B2)',    tier: 'proficiency' },
  { value: 'C1',     label: 'Advanced (C1)',              tier: 'proficiency' },
  { value: 'C2',     label: 'Mastery (C2)',               tier: 'proficiency' }
];

const TIERS = {
  literacy: {
    key: 'literacy',
    label: 'Literacy',
    levels: 'Pre-reading',
    color: '#0E8C7F',
    bg: 'rgba(14,140,127,.08)',
    border: 'rgba(14,140,127,.25)',
    desc: 'Brand-new readers: letters, sounds and first words, taught with real pictures and lots of repetition.',
    rules: [
      'Pre-reading: teach letter names AND letter sounds, and blend simple CVC words',
      'One letter or a small set of items per session — never a wall of text',
      'Every target item is paired with a picture; no sentences beyond CVC',
      'Oral-first and multisensory; heavy repetition and high success',
      'L1 support and images throughout; no grammar explanations'
    ]
  },
  foundation: {
    key: 'foundation',
    label: 'Foundation',
    levels: 'Pre-A1 · A1',
    color: '#E85A2A',
    bg: 'rgba(255,107,53,.08)',
    border: 'rgba(255,107,53,.25)',
    desc: 'Early beginners building their first words and everyday phrases with plenty of support.',
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
    desc: 'Growing learners forming their own sentences and short paragraphs with lighter support.',
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
    desc: 'Confident learners refining fluency, nuance and independent, extended communication.',
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

/* Literacy is the pre-reading tier below Pre-A1; it drives a distinct set of
   session types, render templates and picture-first slides. */
function isLiteracyTier(tierKey) { return tierKey === 'literacy'; }
function isLiteracyLevel(levelValue) { return tierForLevel(levelValue) === 'literacy'; }

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
  'Farsi Iran': 'Farsi (Iranian Persian, in Perso-Arabic script)',
  'Mandarin Chinese': 'Mandarin Chinese (Putonghua / Standard Mandarin, written in Simplified Chinese characters)',
  'Korean': 'Korean (in Hangul script)',
  'Japanese': 'Japanese (standard orthography — kanji with hiragana/katakana as appropriate)'
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
  'LIT1': 'Pre-alphabet. No reading yet. Learner hears and says everyday words anchored to a real picture; builds spoken vocabulary and the idea that a word names a thing. Everything oral, image-first, with L1 support.',
  'LIT2': 'Letters and sounds. Learner recognises letters and their sounds (name AND phonic sound), one small group at a time, each anchored to a picture example. Begins to blend two or three sounds. No connected text.',
  'LIT3': 'Word building. Learner blends and reads simple CVC words and a few high-frequency sight words, checking meaning against a picture. Short, decodable items only — no sentences beyond CVC.',
  'LIT4': 'Sentences and grammar. Learner moves from words to accurate simple sentences — subject + verb, articles, plurals, adjectives, prepositions, questions and negatives — always through pictures, oral models, reading and guided writing.',
  'LIT5': 'Reading for meaning. Learner reads short, controlled texts (single sentences up to five connected ones) and shows understanding — matching sentence to picture, scanning for key words and numbers, answering who/what/where and yes/no, sequencing, following instructions and retelling. Decoding is secure; the focus is comprehension.',
  'LIT6': 'Functional reading and writing. Learner reads and completes the everyday texts of adult life — signs and symbols, prices and money, the clock and the calendar, appointment cards, receipts, labels and timetables — and writes their own key details (name, address, phone, date) into simple forms. Real-world documents, not stories.',
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

/* ── Tutor-facing level guidance ──
   A short, plain-language brief shown under the level selector: the goal of
   the level, what to expect from the learner, and how to teach at it. One
   entry per CEFR level (kept separate from the prompt-facing descriptors). */
const LEVEL_GUIDE = {
  'LIT1': {
    goal:   'Build spoken words and the idea that every picture has a name — before any letters.',
    expect: 'Pointing, naming and repeating; answers of one or two words, fully supported by pictures and first language.',
    teach:  'Say the word, show the picture, have the learner repeat — lots of times. Keep it playful and all spoken.'
  },
  'LIT2': {
    goal:   'Recognise letters and the sounds they make, one small group at a time.',
    expect: 'Matching a letter to its sound and to a picture word; first attempts at blending two or three sounds.',
    teach:  'Teach the letter name and its sound together with the example picture; model blending aloud; repeat daily.'
  },
  'LIT3': {
    goal:   'Sound out and read simple CVC words and a few common sight words.',
    expect: 'Blending c-a-t → cat, then checking the picture; recognising a handful of whole words on sight.',
    teach:  'Blend slowly then quickly, always confirming meaning with the picture; keep every item short and high-success.'
  },
  'LIT4': {
    goal:   'Read and write simple, correct sentences about everyday life.',
    expect: 'Building and reading short sentences with a frame; first use of grammar (be, verbs, articles, plurals, prepositions, questions).',
    teach:  'Teach each pattern through a picture, an oral model, a readable sentence and word cards — never a definition alone.'
  },
  'LIT5': {
    goal:   'Read short texts and show real understanding — not just sound out the words.',
    expect: 'Matching sentences to pictures, scanning for key words and numbers, answering who/what/where and yes/no, sequencing and retelling short texts.',
    teach:  'Read the text together, then ask the learner to point to the answer in the words; reread for fluency and always check meaning with the picture.'
  },
  'LIT6': {
    goal:   'Read the everyday texts of adult life and write your own key details.',
    expect: 'Reading signs, prices, the clock and calendar, cards, receipts and labels; writing name, address, phone and date into a simple form.',
    teach:  'Use a real example of each document; read it together, point to the important part, then have the learner fill in or find their own details.'
  },
  'Pre-A1': {
    goal:   'Help the learner recognise and say a small set of everyday words and fixed phrases.',
    expect: 'Very short spoken answers, lots of repetition, and full support from images and their first language.',
    teach:  'Model everything first, keep writing to a minimum, and celebrate small wins to build confidence.'
  },
  'A1': {
    goal:   'Build simple present-tense sentences and questions about familiar, everyday needs.',
    expect: 'Short turns, familiar vocabulary, and steady support throughout.',
    teach:  'Introduce one structure at a time, practise it out loud, then use it in a guided task.'
  },
  'A2': {
    goal:   'Connect simple sentences about routines, past events and near-future plans.',
    expect: 'Short paragraphs, common word pairings, and only light support.',
    teach:  'Set a clear context first, then move from guided practice to semi-independent speaking and writing.'
  },
  'B1': {
    goal:   'Handle everyday, work and travel situations and give opinions with basic reasons.',
    expect: 'Connected talk, fewer prompts, and growing independence.',
    teach:  'Give a realistic scenario, step back, and let the learner produce with minimal help.'
  },
  'B2': {
    goal:   'Discuss a range of topics in detail and argue a point of view with some nuance.',
    expect: 'Clear, detailed language and the beginnings of register awareness — no scaffolding.',
    teach:  'Focus on precision and appropriacy, and push for well-supported, extended answers.'
  },
  'C1': {
    goal:   'Use fluent, flexible language for social, academic and professional purposes.',
    expect: 'Spontaneous, well-structured output and a good grasp of implied meaning.',
    teach:  'Challenge with authentic material and refine stance, cohesion and precision.'
  },
  'C2': {
    goal:   'Communicate with near-native precision, handling idiom, style and subtle meaning.',
    expect: 'Sophisticated, effortless language shaped for effect.',
    teach:  'Fine-tune nuance and rhetorical control through demanding, open-ended tasks.'
  }
};

function levelGuide(level) {
  return LEVEL_GUIDE[level] || LEVEL_GUIDE['A1'];
}

/* ── Session duration modes ──
   15-min is a distinct architecture, NOT a shortened 25-min. */
const DURATIONS = {
  15: {
    key: 15,
    label: '15-min micro session',
    arc: 'a tight, high-intensity arc with reduced language load and fewer target items',
    rules: [
      'Follow EXACTLY the slide sequence given in the required-slides list — do not add or drop slides',
      'Fewer target items and shorter texts than the 25-min session; one clear focus',
      'Reduced explanation; tighter instructions; concise close',
      'Keep one clear application/production step and a brief review'
    ]
  },
  25: {
    key: 25,
    label: '25-min normal session',
    arc: 'the fuller arc with room for guided practice plus a production stage',
    rules: [
      'Follow EXACTLY the slide sequence given in the required-slides list — do not add or drop slides',
      'Fuller scope: the complete target-word set, richer examples and practice',
      'Room for a substantial practice/production stage',
      'A broader but still focused review and next step'
    ]
  }
};

function getDuration(d) {
  return DURATIONS[Number(d)] || DURATIONS[25];
}
