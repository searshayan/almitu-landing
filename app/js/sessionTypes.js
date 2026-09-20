/* ═══════════════════════════════════════════════════════
   Almitu Pro — Session Types & Dynamic Input Field Schemas
   3 active types: Vocabulary, Grammar, Communication & Speaking
   ═══════════════════════════════════════════════════════ */

const SESSION_TYPES = {
  vocabulary: {
    key: 'vocabulary',
    label: 'Vocabulary',
    icon: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`,
    fields: [
      { id: 'vocabTheme', label: 'Vocabulary Theme / Category', type: 'text', required: true,
        placeholder: 'e.g. Food and drinks at a café', hint: 'The thematic word group for this session.' },
      { id: 'targetVocab', label: 'Target Vocabulary (6–12 items, comma-separated)', type: 'textarea', required: true, rows: 2, counter: true,
        placeholder: 'coffee, tea, juice, water, croissant, cake, sandwich, menu',
        hint: 'These exact words will be taught — No items will be added or replaced.' },
      { id: 'objective', label: 'Learning Objective / Context', type: 'textarea', required: true, rows: 2,
        placeholder: 'Student can name and ask for common café items when ordering',
        hint: 'What should the student be able to DO with these words after the session?' },
      { id: 'realWorldContext', label: 'Real-World Context', type: 'text', required: false,
        placeholder: 'e.g. Student visits a café every morning before work', hint: 'Where will the student actually use this vocabulary?' },
      { id: 'personalization', label: 'Student Interests / Personalization', type: 'text', required: false,
        placeholder: 'e.g. Loves football, has two kids, works in a bakery', hint: 'Helps to personalize the examples.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  },

  grammar: {
    key: 'grammar',
    label: 'Grammar',
    icon: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    fields: [
      { id: 'grammarTitle', label: 'Grammar Title', type: 'text', required: true,
        placeholder: 'e.g. Present Perfect for life experiences', hint: 'The name of the grammar point.' },
      { id: 'grammarStructure', label: 'Grammar Structure', type: 'text', required: true,
        placeholder: 'e.g. Subject + have/has + past participle', hint: 'The exact form/pattern to teach.' },
      { id: 'objective', label: 'Learning Objective / Context', type: 'textarea', required: true, rows: 2,
        placeholder: 'Student can talk about experiences they have had in their life',
        hint: 'What should the student be able to DO with this structure?' },
      { id: 'exampleSentences', label: 'Example Sentences', type: 'textarea', required: false, rows: 2,
        placeholder: 'I have visited three countries. She has never tried sushi.',
        hint: 'Your own model sentences — these will be built on.' },
      { id: 'commonErrors', label: 'Common Errors / L1 Interference', type: 'text', required: false,
        placeholder: 'e.g. Student drops "have", says "I visited" for unfinished time', hint: 'Known mistakes to target.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  },

  communication: {
    key: 'communication',
    label: 'Communication & Speaking',
    icon: `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>`,
    fields: [
      { id: 'scenarioTitle', label: 'Communication Scenario / Title', type: 'text', required: true,
        placeholder: 'e.g. Making a doctor\'s appointment by phone', hint: 'The real-life situation to practice.' },
      { id: 'objective', label: 'Learning Objective / Context', type: 'textarea', required: true, rows: 2,
        placeholder: 'Student can call a clinic, explain symptoms, and agree on a time',
        hint: 'What should the student be able to DO in this scenario?' },
      { id: 'targetExpressions', label: 'Target Expressions / Vocabulary Use', type: 'textarea', required: true, rows: 2,
        placeholder: 'I\'d like to make an appointment, Is ... available?, Could you repeat that?',
        hint: 'The key functional phrases — the session is built around these.' },
      { id: 'speakingActivity', label: 'Speaking Activity', type: 'select', required: true,
        options: ['Role-play', 'Guided Discussion', 'Interview', 'Debate', 'Presentation', 'Negotiation', 'Problem-solving'],
        hint: 'The main production activity for the session.' },
      { id: 'roles', label: 'Student Role / Tutor Role', type: 'text', required: false,
        placeholder: 'e.g. Student = patient, Tutor = receptionist', hint: 'Who plays whom in the activity.' },
      { id: 'culturalNotes', label: 'Cultural Context Notes', type: 'text', required: false,
        placeholder: 'e.g. In Germany appointments are usually formal and punctual', hint: 'Cultural framing for the scenario.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  }
};

/* ═══════════════════════════════════════════════════════
   Literacy session types — shown only when a Literacy level is chosen.
   Pre-reading skills: letters/sounds, CVC blending, sight words, picture-word.
   Every target item is rendered with a picture from the literacy pack.
   ═══════════════════════════════════════════════════════ */
const _litIcon = `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h7"/></svg>`;
const LITERACY_SESSION_TYPES = {
  oral: {
    key: 'oral', label: 'Listening & Speaking', literacy: true, icon: _litIcon,
    fields: [
      { id: 'title', label: 'Session title', type: 'text', required: true, placeholder: 'e.g. Hello and my name', hint: 'Authored session.' }
    ]
  },
  sentences: {
    key: 'sentences', label: 'Sentences & Grammar', literacy: true, icon: _litIcon,
    fields: [
      { id: 'title', label: 'Session title', type: 'text', required: true, placeholder: 'e.g. Subject + be', hint: 'Authored session.' }
    ]
  },
  reading: {
    key: 'reading', label: 'Reading for Meaning', literacy: true, icon: _litIcon,
    fields: [
      { id: 'title', label: 'Session title', type: 'text', required: true, placeholder: 'e.g. Who, what, where', hint: 'Authored session.' }
    ]
  },
  functional: {
    key: 'functional', label: 'Functional Reading & Writing', literacy: true, icon: _litIcon,
    fields: [
      { id: 'title', label: 'Session title', type: 'text', required: true, placeholder: 'e.g. Reading the clock', hint: 'Authored session.' }
    ]
  },
  alphabet: {
    key: 'alphabet', label: 'Alphabet & Sounds', literacy: true, icon: _litIcon,
    fields: [
      { id: 'targetLetters', label: 'Target Letters', type: 'text', required: true,
        placeholder: 'e.g. s, a, t, p, i, n', hint: 'The letters to teach this session, in phonics order.' },
      { id: 'exampleWords', label: 'Example Words (one per letter)', type: 'text', required: true,
        placeholder: 'e.g. sun, apple, tent, pig, igloo, nest', hint: 'A clear, picturable word for each letter — a real picture is shown for each.' },
      { id: 'objective', label: 'Learning Objective', type: 'textarea', required: true, rows: 2,
        placeholder: 'Recognise each letter and say its sound', hint: 'What should the learner be able to DO by the end?' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  },
  blending: {
    key: 'blending', label: 'Word Building', literacy: true, icon: _litIcon,
    fields: [
      { id: 'targetWords', label: 'Target Words (CVC, comma-separated)', type: 'textarea', required: true, rows: 2, counter: true,
        placeholder: 'cat, hat, map, pan, bag, van', hint: 'Simple decodable words — each shown with a picture. No items are added or replaced.' },
      { id: 'vowelFocus', label: 'Sound / Vowel Focus', type: 'text', required: false,
        placeholder: 'e.g. short a', hint: 'The sound pattern these words share.' },
      { id: 'objective', label: 'Learning Objective', type: 'textarea', required: true, rows: 2,
        placeholder: 'Blend and read simple words with the short-a sound', hint: 'What should the learner be able to DO by the end?' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  },
  sightword: {
    key: 'sightword', label: 'Sight Words', literacy: true, icon: _litIcon,
    fields: [
      { id: 'sightWords', label: 'Sight Words (comma-separated)', type: 'textarea', required: true, rows: 2, counter: true,
        placeholder: 'the, and, is, to, you, come', hint: 'Common words taught by whole-word recognition. Picturable ones show a symbol; the rest show the word.' },
      { id: 'objective', label: 'Learning Objective', type: 'textarea', required: true, rows: 2,
        placeholder: 'Recognise the first ten sight words on sight', hint: 'What should the learner be able to DO by the end?' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  },
  pictureword: {
    key: 'pictureword', label: 'Picture–Word', literacy: true, icon: _litIcon,
    fields: [
      { id: 'theme', label: 'Picture Theme', type: 'text', required: true,
        placeholder: 'e.g. Family, Food, Animals', hint: 'The everyday theme for this set.' },
      { id: 'targetWords', label: 'Words to Name (comma-separated)', type: 'textarea', required: true, rows: 2, counter: true,
        placeholder: 'mother, father, baby, sister, brother', hint: 'Each word is shown as a real picture for the learner to name.' },
      { id: 'objective', label: 'Learning Objective', type: 'textarea', required: true, rows: 2,
        placeholder: 'Name common family members from a photo', hint: 'What should the learner be able to DO by the end?' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else to be considered…', hint: '' }
    ]
  }
};

/* Lookups search both sets, so a key resolves the same everywhere (UI, render,
   curriculum). getSessionType falls back to vocabulary for unknown keys. */
function getSessionType(key) { return SESSION_TYPES[key] || LITERACY_SESSION_TYPES[key] || SESSION_TYPES.vocabulary; }
function getAllSessionTypes() { return Object.values(SESSION_TYPES); }

/* The session types to OFFER for a given level: the literacy set for Literacy
   levels, the standard CEFR set otherwise. */
function sessionTypesForLevel(levelValue) {
  return (typeof isLiteracyLevel === 'function' && isLiteracyLevel(levelValue))
    ? Object.values(LITERACY_SESSION_TYPES)
    : Object.values(SESSION_TYPES);
}
function isLiteracySessionType(key) { return !!LITERACY_SESSION_TYPES[key]; }
