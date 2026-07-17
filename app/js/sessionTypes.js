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
        hint: 'These exact words will be taught — the AI will not add or replace items.' },
      { id: 'objective', label: 'Learning Objective / Context', type: 'textarea', required: true, rows: 2,
        placeholder: 'Student can name and ask for common café items when ordering',
        hint: 'What should the student be able to DO with these words after the session?' },
      { id: 'realWorldContext', label: 'Real-World Context', type: 'text', required: false,
        placeholder: 'e.g. Student visits a café every morning before work', hint: 'Where will the student actually use this vocabulary?' },
      { id: 'personalization', label: 'Student Interests / Personalization', type: 'text', required: false,
        placeholder: 'e.g. Loves football, has two kids, works in a bakery', hint: 'Helps the AI personalize examples.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else the AI should know…', hint: '' }
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
        hint: 'Your own model sentences — the AI will build on these.' },
      { id: 'commonErrors', label: 'Common Errors / L1 Interference', type: 'text', required: false,
        placeholder: 'e.g. Student drops "have", says "I visited" for unfinished time', hint: 'Known mistakes to target.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else the AI should know…', hint: '' }
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
        hint: 'The key functional phrases — the AI builds the session around these.' },
      { id: 'speakingActivity', label: 'Speaking Activity', type: 'select', required: true,
        options: ['Role-play', 'Guided Discussion', 'Interview', 'Debate', 'Presentation', 'Negotiation', 'Problem-solving'],
        hint: 'The main production activity for the session.' },
      { id: 'roles', label: 'Student Role / Tutor Role', type: 'text', required: false,
        placeholder: 'e.g. Student = patient, Tutor = receptionist', hint: 'Who plays whom in the activity.' },
      { id: 'culturalNotes', label: 'Cultural Context Notes', type: 'text', required: false,
        placeholder: 'e.g. In Germany appointments are usually formal and punctual', hint: 'Cultural framing for the scenario.' },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false, rows: 2,
        placeholder: 'Anything else the AI should know…', hint: '' }
    ]
  }
};

function getSessionType(key) { return SESSION_TYPES[key] || SESSION_TYPES.vocabulary; }
function getAllSessionTypes() { return Object.values(SESSION_TYPES); }
