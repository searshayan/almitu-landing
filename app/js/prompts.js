/* ═══════════════════════════════════════════════════════
   Almitu Pro — Prompt Engine
   9 prompts = 3 skills × 3 tiers. Each prompt locks the
   model to one render template (R1–R9): a fixed slide
   sequence with fixed layouts. The model fills CONTENT
   only — structure is non-negotiable. This is what keeps
   outputs level-aligned and hallucination-free.
   ═══════════════════════════════════════════════════════ */

/* ── Layout data shapes the model must follow ── */
const LAYOUT_DOCS = `
LAYOUT DATA SHAPES (the "data" object for each layout):
- "hero":      { "emoji": "☕", "heading": "...", "goal": "one sentence", "can_do": "CEFR can-do statement", "badges": ["...","..."] }
- "cards":     { "intro": "short line or empty", "cols": 3, "items": [ { "emoji": "☕", "top": "main text", "mid": "secondary text or empty", "bottom": "small text or empty" } ] }
- "rows":      { "intro": "short line or empty", "rows": [ { "main": "primary text", "sub": "secondary text or empty", "note": "small colored note or empty" } ] }
- "dialogue":  { "setting": "one line scene description", "lines": [ { "speaker": "name", "side": "left|right", "line": "..." } ] }
- "table":     { "intro": "short line or empty", "headers": ["...","..."], "rows": [ ["cell","cell"] ] }
- "text":      { "paragraphs": ["... use **word** to bold target items ..."], "source_label": "label or empty", "note": "short note or empty" }
- "compare":   { "intro": "short line or empty", "pairs": [ { "good": "correct version", "bad": "incorrect version", "note": "why" } ] }
- "task":      { "scenario": "...", "steps": ["...","..."], "tip": "short tip or empty", "criteria": ["success criterion", "..."] }
- "checklist": { "intro": "short line or empty", "style": "check|numbered", "items": [ { "text": "...", "hint": "small hint or empty" } ], "footer": "homework/closing line or empty" }
- "bankmatch": { "intro": "instructions", "bank": ["word1","word2"], "prompts": [ { "q": "question or sentence with ___", "a": "answer from bank" } ] }`;

/* ── Tier rule blocks (CEFR alignment contract) ──
   {{L1_RULE}} is substituted per request in buildSystemPrompt. */
const TIER_RULES = {
  foundation: `TIER: FOUNDATION (Pre-A1, A1) — COGNITIVE LOAD MINIMIZATION
PRODUCTIVE & RECEPTIVE CONTRACT — every slide must comply:
- L1 Semantic Support: {{L1_RULE}}
- Lexis: high-frequency, CONCRETE nouns and highly functional verbs only. No abstraction.
- High-Frequency Visuals: every core word or functional phrase carries a contextually relevant emoji for direct semantic mapping.
- Scaffolded Lexical Chunks: word banks ALWAYS provided in "bankmatch" activities. Teach set survival-communication phrases, not grammatical paradigms.
- Oral-First Priming: chunks mirror immediate survival communication; activities centre on speaking/listening, minimal writing.
- Pronunciation tips (note fields): NEVER use IPA. Use intuitive phonetic approximations, e.g. "say it like: 'wuh-ter'".
- Quantifiable Scope: exactly 6-12 target items; sentences max 8 words; restrict to present simple & present continuous.
- High-Success Threshold: design tasks to maximize correct-response rate and learner confidence.
- Tone: warm, encouraging, supportive — entirely free of metalanguage or jargon.`,

  development: `TIER: DEVELOPMENT (A2, B1) — CONTEXTUAL SALIENCY & LEXICAL PRIMING
PRODUCTIVE & RECEPTIVE CONTRACT — every slide must comply:
- Narrative-Driven Context: introduce language through natural, non-synthetic paragraphs (60-90 words) using level-appropriate cohesive devices (then, because, however, so), not isolated lists.
- L1 Semantic Support: {{L1_RULE}}
- Unscaffolded Recall: NO word banks in activities — students must actively retrieve.
- Multi-Word Units: feature high-yield NATURAL collocations (e.g. heavy rain, take a break, make a decision) and transparent word families — never obscure or over-academic pairings.
- Structural Launchpads: guided writing uses sentence STARTERS, not complete fill-in frames. Starters balance emotional resonance with practical/professional utility.
- Semi-Structured Output: production tasks are open prompts, not fixed scripts.
- Complexity Ceiling: sentences max 15 words; grammar bound to past simple/continuous, basic comparatives, modal verbs, first conditional. Avoid all C-level structures.
- Tone: encouraging professional coach; light, clear metalanguage (noun, verb phrase) is acceptable.`,

  proficiency: `TIER: PROFICIENCY (B2, C1, C2) — AUTHENTIC SOCIOLINGUISTIC NUANCE
PRODUCTIVE & RECEPTIVE CONTRACT — every slide must comply:
- Authentic Sociolinguistic Corpora: generate realistic, un-scaffolded texts (corporate emails, opinion pieces, editorial reviews, professional dialogue) reproducing real pragmatic features — politeness gradations, idiomatic expressions, hedging ("it could be argued that", "I'm inclined to think"), and distinct registers.
- Zero Instructional Scaffolding: no word banks, no L1, no pre-formatted sentence frames, no completed example answers.
- Pragmatic & Stylistic Register: highlight formal/neutral/informal variation. In "table" layouts, explicitly distinguish DENOTATION (literal meaning) from CONNOTATION (implied emotional/cultural weight).
- High-Order Cognitive Analysis: frame tasks around evaluation, contrast, defense of stance, and structural critique.
- Extended Generative Production: open-ended speaking/writing assignments paired with explicit success criteria.
- Metacognitive Review: include dedicated learner self-assessment.
- Lexical Density: match the precise lexical and syntactic sophistication of the exact level (B2 < C1 < C2).
- Tone: intellectual peer; technical and meta-linguistic concepts are encouraged.`
};

/* ── Render specs: the fixed slide sequence per skill × tier ── */
const RENDER_SPECS = {
  vocabulary: {
    foundation: { id: 'R1', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, simple goal, can-do statement ("I can name/ask for...")' },
      { icon: '🃏', label: 'New Words',     layout: 'cards',     brief: 'EVERY target vocabulary item as a card: emoji, the word (top), L1 hint (mid — only if L1 support on, else empty), a 2-4 word chunk using it (bottom). cols:3' },
      { icon: '🗣️', label: 'Say It',        layout: 'rows',      brief: 'Listen & repeat: 4-6 memorized chunks using target words. main=chunk, sub=L1 hint if enabled, note=pronunciation tip' },
      { icon: '🧩', label: 'Word Bank',     layout: 'bankmatch', brief: 'Match activity WITH word bank: bank = all target words; 5-6 prompts like "a hot drink ☕ → ___" answered from bank' },
      { icon: '🎤', label: 'Speak',         layout: 'task',      brief: 'Oral micro-task: simple scenario, 3-4 steps with fixed sentence frames embedded in steps, tip with word bank reminder' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Recap of words learned + footer = tiny oral homework (label words at home, say chunks aloud)' }
    ]},
    development: { id: 'R2', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal, can-do statement' },
      { icon: '📖', label: 'In Context',    layout: 'text',      brief: '2 short paragraphs (60-90 words total) naturally using ALL target vocabulary in **bold**. Realistic everyday context tied to the learning objective' },
      { icon: '🔍', label: 'Work It Out',   layout: 'rows',      brief: 'Meaning from context: each row main = "What does **word** mean here?", sub = the sentence fragment it appeared in, note empty (NO answer given)' },
      { icon: '🧬', label: 'Collocations',  layout: 'table',     brief: 'headers: [Word, Common Collocations, Word Family]. One row per target word with 2-3 real collocations and family members' },
      { icon: '✍️', label: 'Guided Writing',layout: 'rows',      brief: 'Sentence starters: each row main = starter using a target word ("I usually order ... when ..."), sub = "finish the sentence about your life", NO completed examples' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Recap + footer = written homework (3 sentences using new collocations)' }
    ]},
    proficiency: { id: 'R3', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal framed around precision and register' },
      { icon: '📰', label: 'Authentic Text',layout: 'text',      brief: 'A realistic authentic-style excerpt (90-130 words: review/article/email) with target lexis in **bold**. source_label like "Restaurant review — city magazine"' },
      { icon: '🎭', label: 'Register & Nuance', layout: 'table', brief: 'headers: [Item, Register, Nuance / Connotation, Natural Example]. Analyze each target item: formal/neutral/informal, what it implies' },
      { icon: '🧠', label: 'Critical Analysis', layout: 'checklist', brief: 'style:numbered. 4-5 analysis questions: why did the writer choose X over Y, what changes if we swap, evaluate tone' },
      { icon: '🚀', label: 'Production',    layout: 'task',      brief: 'Extended open-ended task (e.g. write/deliver a 2-min version for a different audience). steps = task stages, criteria = 3-4 success criteria. NO model answer' },
      { icon: '🪞', label: 'Self-Assessment', layout: 'checklist', brief: 'style:check. "I can..." statements matched to the exact level + footer = reflection question' }
    ]}
  },

  grammar: {
    foundation: { id: 'R4', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, simple goal, can-do statement' },
      { icon: '🧱', label: 'The Pattern',   layout: 'cards',     brief: 'The structure as memorized chunks: each card = emoji, a full chunk using the pattern (top), L1 hint (mid, if enabled), when to use it in 2-3 words (bottom). cols:2' },
      { icon: '👀', label: 'Spot It',       layout: 'compare',   brief: '3 pairs: good = correct sentence with pattern (max 8 words), bad = typical beginner error, note = one simple reason' },
      { icon: '🧩', label: 'Practice',      layout: 'bankmatch', brief: 'WITH word bank: bank = key pattern pieces; prompts = 5 sentences with ___ completed from bank' },
      { icon: '🎤', label: 'Speak',         layout: 'task',      brief: 'Oral practice: scenario, steps containing fixed sentence frames with the pattern, encouraging tip' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Pattern recap + footer = oral homework' }
    ]},
    development: { id: 'R5', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal, can-do statement' },
      { icon: '📖', label: 'In Context',    layout: 'text',      brief: 'Short paragraph (60-90 words) naturally using the target structure 4-5 times in **bold**' },
      { icon: '🔬', label: 'Find the Rule', layout: 'table',     brief: 'Guided discovery. headers: [Form, Use, Example from the text]. 2-3 rows. The student completes understanding with the tutor' },
      { icon: '🔁', label: 'Transform',     layout: 'rows',      brief: 'NO word bank. 5 transformation prompts: main = base sentence, sub = instruction ("make it negative / about yesterday / a question"), note empty' },
      { icon: '✍️', label: 'Your Sentences',layout: 'rows',      brief: 'Sentence starters using the structure about the student\'s real life. NO completed examples' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Rule recap + footer = written homework' }
    ]},
    proficiency: { id: 'R6', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal framed around precision, style and control' },
      { icon: '📰', label: 'Authentic Use', layout: 'text',      brief: 'Authentic-style excerpt (90-130 words) where the structure does real stylistic work, instances in **bold**, source_label set' },
      { icon: '⚖️', label: 'Nuance',        layout: 'table',     brief: 'headers: [Version A, Version B, What Changes]. 3-4 rows contrasting the structure with near-alternatives (aspect, register, emphasis shifts)' },
      { icon: '🧠', label: 'Critical Tasks',layout: 'checklist', brief: 'style:numbered. Reformulation and error-analysis tasks: improve weak sentences, justify choices, NO answers provided' },
      { icon: '🚀', label: 'Production',    layout: 'task',      brief: 'Extended production requiring the structure (opinion piece, formal complaint, narrative). criteria = accuracy + range + style' },
      { icon: '🪞', label: 'Self-Assessment', layout: 'checklist', brief: 'style:check. Control statements + reflection footer' }
    ]}
  },

  communication: {
    foundation: { id: 'R7', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, simple goal, can-do statement' },
      { icon: '🃏', label: 'Key Phrases',   layout: 'cards',     brief: 'Each target expression as a card: emoji, phrase (top), L1 hint (mid, if enabled), its function in 2-3 words (bottom). cols:2' },
      { icon: '🎭', label: 'Model Dialogue',layout: 'dialogue',  brief: 'SHORT dialogue (6-8 turns, max 8 words per line) using ALL key phrases. Student side = right' },
      { icon: '🔁', label: 'Drill',         layout: 'bankmatch', brief: 'WITH word bank of the key phrases: prompts = situations ("The waiter asks what you want → ___"), answers from bank' },
      { icon: '🎬', label: 'Role-Play',     layout: 'task',      brief: 'Fully scaffolded role-play: scenario, steps = the script skeleton with frames, tip = "use the phrases from slide 2"' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Phrases recap + footer = oral homework (practice the dialogue)' }
    ]},
    development: { id: 'R8', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal, can-do statement' },
      { icon: '🗺️', label: 'The Situation', layout: 'text',      brief: 'Scenario paragraph (50-80 words) setting context + note listing the target expressions to listen for' },
      { icon: '🎭', label: 'Model Dialogue',layout: 'dialogue',  brief: 'Natural dialogue (8-12 turns) using target expressions, mild complications included (a question back, a problem)' },
      { icon: '🧰', label: 'Language Toolkit', layout: 'table',  brief: 'headers: [Function, Expressions]. Group target expressions by communicative function + 1-2 natural extensions each' },
      { icon: '🎬', label: 'Role-Play',     layout: 'task',      brief: 'Semi-structured: scenario with a TWIST the student must handle, steps = situation prompts NOT scripts, criteria = 2-3 goals' },
      { icon: '✅', label: 'Review',        layout: 'checklist', brief: 'style:check. Recap + footer = real-world mission homework' }
    ]},
    proficiency: { id: 'R9', slides: [
      { icon: '🎯', label: 'Objective',     layout: 'hero',      brief: 'Session title, goal framed around persuasion, register, discourse control' },
      { icon: '📰', label: 'Stimulus',      layout: 'text',      brief: 'Authentic-style stimulus (100-140 words: opinion excerpt, transcript, scenario brief) raising a genuine issue, source_label set' },
      { icon: '🎛️', label: 'Discourse Strategies', layout: 'table', brief: 'headers: [Situation, Strategy, Natural Exponent]. Hedging, concession, turn-taking, register shifting — matched to target expressions' },
      { icon: '🧠', label: 'Critical Discussion', layout: 'checklist', brief: 'style:numbered. 4-5 open discussion questions demanding stance + justification, NO sample answers' },
      { icon: '🚀', label: 'Extended Task', layout: 'task',      brief: 'The speaking activity at full scale (debate/negotiation/presentation): steps = stages with time guidance, criteria = evaluation rubric points' },
      { icon: '🪞', label: 'Self & Peer Review', layout: 'checklist', brief: 'style:check. Performance statements + footer = peer-feedback question to ask the tutor' }
    ]}
  }
};

/* ── 15-MINUTE render specs (distinct 5-beat architecture) ──
   Arc: immediate launch → one teaching move → fast retrieval/shaping
        → one production task → one-point feedback.
   NOT a shortened 25-min: no guided-practice stage, fewer targets. */
const RENDER_SPECS_15 = {
  vocabulary: {
    foundation: { id: 'R1', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: session title, ONE simple can-do ("I can use these words for..."). No warm-up.' },
      { icon: '🃏', label: 'Teach',    layout: 'cards',     brief: 'ONE teaching move: EVERY target word as a card — emoji, word (top), L1 hint (mid, only if L1 on else empty), a 2-3 word chunk (bottom). cols:3' },
      { icon: '🧩', label: 'Retrieve', layout: 'bankmatch', brief: 'Fast retrieval WITH word bank: bank = all target words; 4-5 quick prompts like "a hot drink ☕ → ___"' },
      { icon: '🎤', label: 'Produce',  layout: 'task',      brief: 'ONE short oral task: tiny scenario, 3 steps with fixed sentence frames, tip = use the word bank' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. ONE-POINT feedback: 3 words recap + footer = one tiny oral homework' }
    ]},
    development: { id: 'R2', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + can-do statement, no warm-up' },
      { icon: '📖', label: 'Teach',    layout: 'text',      brief: 'ONE teaching move: a single short paragraph (40-60 words) using ALL target words in **bold** in a real context' },
      { icon: '🔍', label: 'Shape',    layout: 'rows',      brief: 'Fast meaning-from-context: rows main = "What does **word** mean here?", sub = the fragment, NO answers, NO bank' },
      { icon: '✍️', label: 'Produce',  layout: 'rows',      brief: 'ONE guided production: 3 sentence starters using target words, sub = "finish about your life", no examples' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. One-point feedback + footer = one short written homework' }
    ]},
    proficiency: { id: 'R3', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + precision/register goal' },
      { icon: '📰', label: 'Teach',    layout: 'text',      brief: 'ONE authentic-style excerpt (60-80 words) with target lexis in **bold**; source_label set' },
      { icon: '🎭', label: 'Shape',    layout: 'table',     brief: 'Fast nuance pass. headers:[Item, Register, Nuance / Connotation]. One row per target item, no examples column (keep tight)' },
      { icon: '🚀', label: 'Produce',  layout: 'task',      brief: 'ONE extended open task (2-min spoken/written response), steps = stages, criteria = 3 success criteria, no model' },
      { icon: '🪞', label: 'Feedback', layout: 'checklist', brief: 'style:check. Self-assessment "I can..." + footer = one reflection question' }
    ]}
  },
  grammar: {
    foundation: { id: 'R4', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + one simple can-do' },
      { icon: '🧱', label: 'Teach',    layout: 'cards',     brief: 'ONE teaching move: the pattern as 2-3 memorised chunks. cards: emoji, chunk (top), L1 hint (mid if on), when-to-use (bottom). cols:2' },
      { icon: '🧩', label: 'Retrieve', layout: 'bankmatch', brief: 'WITH word bank of pattern pieces: 4-5 sentences with ___ completed from the bank' },
      { icon: '🎤', label: 'Produce',  layout: 'task',      brief: 'ONE oral task: say it about you, 3 steps with fixed frames, encouraging tip' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. One-point feedback + one tiny oral homework' }
    ]},
    development: { id: 'R5', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + can-do' },
      { icon: '📖', label: 'Teach',    layout: 'text',      brief: 'ONE short paragraph (40-60 words) using the target structure 3-4 times in **bold**' },
      { icon: '🔁', label: 'Shape',    layout: 'rows',      brief: 'Fast transform, NO bank: 4 prompts, main = base sentence, sub = "make it negative / a question / past", no answers' },
      { icon: '✍️', label: 'Produce',  layout: 'rows',      brief: 'ONE guided production: 3 sentence starters with the structure about the student, no examples' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. One-point feedback + one short written homework' }
    ]},
    proficiency: { id: 'R6', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + precision/style goal' },
      { icon: '📰', label: 'Teach',    layout: 'text',      brief: 'ONE authentic-style excerpt (60-80 words) where the structure does stylistic work, instances **bold**, source_label set' },
      { icon: '⚖️', label: 'Shape',    layout: 'table',     brief: 'headers:[Version A, Version B, What Changes]. 3 rows contrasting the structure with alternatives' },
      { icon: '🚀', label: 'Produce',  layout: 'task',      brief: 'ONE extended production requiring the structure, criteria = accuracy + range + style' },
      { icon: '🪞', label: 'Feedback', layout: 'checklist', brief: 'style:check. Control self-assessment + one reflection footer' }
    ]}
  },
  communication: {
    foundation: { id: 'R7', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + one simple can-do' },
      { icon: '🃏', label: 'Teach',    layout: 'cards',     brief: 'ONE teaching move: each target expression as a card — emoji, phrase (top), L1 hint (mid if on), function (bottom). cols:2' },
      { icon: '🎭', label: 'Model',    layout: 'dialogue',  brief: 'VERY short model dialogue (4-6 turns, max 8 words/line) using ALL key phrases. Student side = right' },
      { icon: '🎬', label: 'Produce',  layout: 'task',      brief: 'ONE scaffolded role-play: scenario, 3 script-skeleton steps with frames, tip = use slide-2 phrases' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. One-point feedback + one oral homework' }
    ]},
    development: { id: 'R8', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + can-do' },
      { icon: '🗺️', label: 'Teach',    layout: 'text',      brief: 'ONE short scenario paragraph (40-60 words) + note listing the target expressions to use' },
      { icon: '🎭', label: 'Model',    layout: 'dialogue',  brief: 'Short natural dialogue (6-8 turns) using target expressions with ONE complication' },
      { icon: '🎬', label: 'Produce',  layout: 'task',      brief: 'ONE semi-structured role-play with a twist; steps = situation prompts not scripts; criteria = 2 goals' },
      { icon: '✅', label: 'Feedback', layout: 'checklist', brief: 'style:check. One-point feedback + one real-world mission homework' }
    ]},
    proficiency: { id: 'R9', slides: [
      { icon: '🚀', label: 'Launch',   layout: 'hero',      brief: 'Instant start: title + persuasion/register goal' },
      { icon: '📰', label: 'Teach',    layout: 'text',      brief: 'ONE short authentic-style stimulus (70-90 words) raising a real issue; source_label set' },
      { icon: '🎛️', label: 'Shape',    layout: 'table',     brief: 'headers:[Situation, Strategy, Natural Exponent]. 3 rows: hedging, concession, register-shift tied to target expressions' },
      { icon: '🚀', label: 'Produce',  layout: 'task',      brief: 'ONE extended speaking task (debate/negotiation), steps = stages, criteria = rubric points' },
      { icon: '🪞', label: 'Feedback', layout: 'checklist', brief: 'style:check. Self + peer review statements + one feedback question footer' }
    ]}
  }
};

/* ═══════════════════════════════════════════════════════
   UNIFIED RENDER SKELETON (supersedes RENDER_SPECS / RENDER_SPECS_15)
   ONE fixed 6-slide shell per skill, used for EVERY tier and BOTH
   durations. Slide TYPES never change; tier / level / duration / L1
   drive only CONTENT depth, scaffolding, L1 lines and density —
   handled by the tier, level and duration blocks in buildSystemPrompt.
   (The two legacy spec objects above are now unused.)
   ═══════════════════════════════════════════════════════ */
const RENDER_SKELETON = {
  vocabulary: [
    { icon: '🎯', label: 'Objective', layout: 'hero', brief: 'Title + duration subtitle. One goal sentence and one CEFR-appropriate "I can…" statement. 1-2 short chips (word count, place, "Speak today!").' },
    { icon: '🃏', label: 'New Words', layout: 'cards', brief: 'Target words as cards, cols:3. Each card: emoji, the word (top), L1 translation (mid — ONLY if L1 support on, else empty string), ONE example sentence whose complexity matches the exact level (bottom). Item count scales with duration (fewer for 15-min).' },
    { icon: '🗣️', label: 'Listen & Repeat', layout: 'rows', brief: '4-6 short sentences combining the new words with useful frames. row.main = the sentence (complexity by level); row.sub = L1 translation (only if L1 on); row.note = a SIMPLE learner-friendly phonetic hint (Foundation only, and only where truly helpful).' },
    { icon: '🧩', label: 'Word Bank', layout: 'bankmatch', brief: 'bank = all target words as chips. 6-8 clues (fewer for 15-min); each clue ends with ___. Clue difficulty by tier: Foundation concrete/visual, Development contextual, Proficiency inferential. Never reveal the answer word in the clue.' },
    { icon: '🎤', label: 'Scenario / Speak', layout: 'task', brief: 'scenario anchored in the country of residence where natural (e.g. Tim Hortons in Canada). 3-5 numbered steps (fewer for 15-min), each using target language. tip references the Word Bank. criteria = 2-4 success points graded by tier.' },
    { icon: '✅', label: 'Review & Homework', layout: 'checklist', brief: 'style:check. "I can…" / "I know…" review items (add an L1 line only if L1 on). footer = one small, level-appropriate homework task.' }
  ],
  grammar: [
    { icon: '🎯', label: 'Objective', layout: 'hero', brief: 'Title + duration subtitle. Goal + a CEFR-appropriate "I can…" (e.g. "I can tell a short story using past simple"). 1-2 chips.' },
    { icon: '📐', label: 'Grammar Focus', layout: 'rows', brief: 'intro = the pattern line (e.g. "have/has + past participle"). 3-6 example rows: main = an example sentence using the pattern (complexity by level); sub = L1 gloss (only if L1 on); note = a short right-vs-wrong or usage hint where helpful.' },
    { icon: '🔁', label: 'Form Practice', layout: 'rows', brief: '4-6 lines exemplifying the pattern across persons/tenses for oral repetition. main = sentence; sub = L1 (if on); note = phonetic/usage hint (Foundation, only if helpful).' },
    { icon: '🧩', label: 'Controlled Practice', layout: 'bankmatch', brief: 'Gap-fill / transformation. bank = the pattern pieces or verb forms. 6-8 prompts (fewer for 15-min), each with ___ where the target form goes. Difficulty by tier.' },
    { icon: '🎤', label: 'Scenario / Speak', layout: 'task', brief: 'Communicative task that forces the structure, anchored in the country where natural. 3-5 steps, tip, tiered criteria (e.g. "use the structure at least 3 times").' },
    { icon: '✅', label: 'Review & Homework', layout: 'checklist', brief: 'style:check. Rule review + "I can…" lines (L1 line only if L1 on). footer = one small homework task.' }
  ],
  communication: [
    { icon: '🎯', label: 'Objective', layout: 'hero', brief: 'Title + duration subtitle. Goal + "I can…" (e.g. "I can order food and ask the price"). 1-2 chips.' },
    { icon: '💬', label: 'Key Phrases', layout: 'cards', brief: '4-8 functional phrases as cards, cols:2. Each card: emoji, the phrase (top), L1 (mid — only if L1 on), function / when-to-use (bottom). Complexity by tier: Foundation very short, Development phrase + reason, Proficiency discourse-level.' },
    { icon: '🗣️', label: 'Practice Lines', layout: 'rows', brief: '4-6 lines the learner repeats (mini-dialogue turns), focused on politeness and clarity. main = the line; sub = L1 (if on); note = phonetic (Foundation, if helpful).' },
    { icon: '🧩', label: 'Controlled Practice', layout: 'bankmatch', brief: 'Match phrases to situations. bank = the key phrases. 6-8 prompts: q = a situation ending with ___, a = the correct phrase. Fewer for 15-min.' },
    { icon: '🎤', label: 'Scenario / Speak', layout: 'task', brief: 'Role-play anchored in the country where natural. 3-5 steps using the phrases, tip, tiered criteria (Foundation: use a phrase once; Proficiency: give a reason, respond to a counter, summarize).' },
    { icon: '✅', label: 'Review & Homework', layout: 'checklist', brief: 'style:check. "I can…" review lines (L1 only if L1 on). footer = one small homework task.' }
  ]
};

/* One fixed skeleton per skill, for all tiers and both durations. */
function getRenderSpec(skill, tier, duration) {
  const slides = RENDER_SKELETON[skill] || RENDER_SKELETON.vocabulary;
  return { id: renderIdFor(skill, tier), slides };
}

/* ── Prompt builders ── */

function buildSystemPrompt(formData) {
  const tier = formData.tier;
  const l1Lang = resolveL1Language(formData.language);
  const l1Rule = formData.l1Support
    ? `REQUIRED — provide an accurate, contextualized ${l1Lang} translation or immediate semantic hint inside every designated L1 data slot.`
    : 'DISABLED — keep all L1 data slots strictly as empty strings (""). Do not introduce any non-English text under any circumstances.';
  const tierRules = TIER_RULES[tier].replace(/\{\{L1_RULE\}\}/g, l1Rule);
  const dur = getDuration(formData.duration);
  const durationRules = `SESSION FORMAT: ${dur.label.toUpperCase()} (${dur.slideCount} slides)
Lesson arc: ${dur.arc}
Format rules — every slide must comply:
${dur.rules.map(r => '- ' + r).join('\n')}`;
  const levelLock = levelDescriptor(formData.level);

  return `You are the Almitu Session Engine: an advanced computational ESL curriculum designer applying task-based language teaching (TBLT) to produce CEFR-aligned instructional content for live 1-to-1 micro-tutoring sessions. Learners span busy professionals, migrants and refugees, and motivated language enthusiasts — always adults with a real-world reason to learn.

${tierRules}

${durationRules}

EXACT-LEVEL CALIBRATION — the learner is ${formData.level}:
${levelLock}
Adjacent levels must NOT read alike: an A1 lesson and a C1 lesson on the same topic must differ in text length, sentence complexity, task type, scaffolding, and cognitive demand — not merely wording. Calibrate every string to ${formData.level} precisely.

ANTI-HALLUCINATION & LINGUISTIC CONTRACT (non-negotiable):
1. Target Adherence: work strictly within the target vocabulary, structures, and expressions the tutor provided. Never substitute, append, or modify these target items, and never introduce unassigned grammar or peripheral vocabulary that would overwhelm the learner.
2. Contextual Accuracy: every example must deploy the target language naturally, correctly, and in idiomatic compliance with modern native usage.
3. Strict Level Lock: the learner's confirmed level is ${formData.level}. Every instructional phrase, scenario, text, and review question must be written at or below this exact CEFR level — no accidental level-drift where a simple task carries complex instructions.
4. Minimalist Data Sourcing: when tutor input is sparse, generate sparse, concrete, tightly-focused content. Never invent biographical facts about the learner.
5. Schema as Absolute Boundary: treat every JSON field as a hard boundary. Content strings must never break or restructure the layout fields. Return exactly one valid JSON object — no markdown fences, no preamble, no trailing comments, no unescaped characters.

OUTPUT SCHEMA (slides only — post-session practice is generated in a later, separate call):
{ "slides": [ ...exactly the slides specified, in order... ] }

Each slide object: { "icon": "<given>", "label": "<given>", "title": "a brief, descriptive slide title", "layout": "<given>", "data": { ...per layout shape... } }
${LAYOUT_DOCS}`;
}

function buildUserPrompt(formData) {
  const spec = getRenderSpec(formData.sessionType, formData.tier, formData.duration);
  const st = getSessionType(formData.sessionType);
  const l1Lang = resolveL1Language(formData.language);

  let detailLines = '';
  st.fields.forEach(f => {
    const v = formData.details[f.id];
    if (v) detailLines += `- ${f.label}: ${v}\n`;
  });

  const slideSpec = spec.slides.map((s, i) =>
    `Slide ${i + 1} [Icon: "${s.icon}" | Label: "${s.label}" | Layout: "${s.layout}"]\n   Linguistic Brief: ${s.brief}`
  ).join('\n');

  return `Generate the complete instructional slide deck for a ${formData.duration}-minute live interactive session, complying fully with render template ${spec.id} and the ${formData.duration}-minute format rules.

LEARNER PROFILE:
- Name: ${formData.studentName}
- Native Language / Culture: ${formData.language}
- Country of Residence: ${formData.countryOfResident || 'not specified'} — ground examples, settings, and scenarios in this real-world context where natural (currency, places, services, everyday situations). Improve realism only; never stereotype the learner.
- L1 Translation Support: ${formData.l1Support ? 'ENABLED — populate all L1 data slots with ' + l1Lang + ' terms.' : 'DISABLED — all L1 strings must remain empty ("").'}
- Confirmed CEFR Target Level: ${formData.level} (Tier Classification: ${formData.tier})
- Session Duration: ${formData.duration} minutes

SESSION FOCUS: ${st.label}

INPUT SOURCE DATA (the tutor's target items — treat as inviolable):
${detailLines}
REQUIRED SLIDE SEQUENCE (output exactly these ${spec.slides.length} slides in linear progression, respecting every icon, label, and layout framework):
${slideSpec}

Output ONLY the slides payload as a single, syntactically perfect JSON object. Do NOT include a practice_bank — post-session practice is generated separately after the tutor reviews and launches the session.`;
}

/* ═══════════════════════════════════════════════════════
   PRACTICE-BANK PROMPTS (Phase 2 — post-session)
   Generated AFTER the tutor reviews, edits and launches the
   session, so slide generation stays fast. Built from the
   tutor's target items and the FINAL (possibly edited) slides.
   ═══════════════════════════════════════════════════════ */

function buildPracticeBankSystemPrompt(formData) {
  const l1Lang = resolveL1Language(formData.language);
  return `You are the Almitu Practice Engine. Build the post-session practice bank that powers a learner's self-study activities (flashcards, MCQ, gap-fill, reorder, matching). Calibrate everything to CEFR ${formData.level}.

RULES:
- Cover EVERY target item the tutor supplied — no more, no fewer.
- Definitions and examples must sit exactly at ${formData.level}.
- ${formData.l1Support ? 'L1 support is ON: give an accurate ' + l1Lang + ' translation for each item.' : 'L1 support is OFF: leave every "l1" and "l1_explanation" field as an empty string.'}
- Return ONLY one valid JSON object. No markdown, no commentary.

OUTPUT SCHEMA:
{ "practice_bank": { "items": [ { "term": "target item", "meaning": "clear ${formData.level}-appropriate definition", "l1": "${formData.l1Support ? l1Lang + ' translation' : ''}", "example": "one natural sentence using the term", "explanation": "short ${formData.level}-appropriate English note on meaning/form/use", "l1_explanation": "${formData.tier === 'foundation' ? 'the explanation in ' + l1Lang + ' (REQUIRED — powers answer feedback)' : ''}" } ], "sentences": [ "6-8 standalone practice sentences, each containing exactly one target term" ] } }`;
}

function buildPracticeBankUserPrompt(formData, slides) {
  const st = getSessionType(formData.sessionType);
  let detailLines = '';
  st.fields.forEach(f => {
    const v = formData.details[f.id];
    if (v) detailLines += `- ${f.label}: ${v}\n`;
  });
  // A compact digest of the finalized slides so practice reflects any tutor edits.
  const slideDigest = (slides || []).map(s => `${s.label}: ${s.title}`).join(' | ');

  return `Build the practice bank for this ${formData.duration}-minute ${st.label} session at ${formData.level} (${formData.tier} tier).

TARGET ITEMS (inviolable — cover all, add none):
${detailLines}
The session was delivered as these slides (reflect any of the tutor's wording): ${slideDigest}

Produce the practice_bank per the schema. Return ONLY the JSON object.`;
}

/* ═══════════════════════════════════════════════════════
   AUTO-FILL PROMPTS
   Fills the remaining form fields from the session title,
   calibrated to the student's exact level and tier.
   ═══════════════════════════════════════════════════════ */

function buildAutofillSystemPrompt(meta) {
  const tier = getTier(meta.tier);
  const dur = getDuration(meta.duration);
  return `You are the almitu Session Planner assistant. A tutor has chosen a session type and written only the title/theme. Fill in the remaining planning fields with realistic, high-quality suggestions a busy ESL tutor would write themselves.

CALIBRATION (strict):
- Student level: ${meta.level} (tier: ${tier.label}) — ${levelDescriptor(meta.level)}
- Tier characteristics: ${tier.rules.join('; ')}
- Session duration: ${dur.label} — ${dur.key === 15 ? 'keep scope TIGHT: fewer targets, one focus, shorter outputs' : 'fuller scope with room for guided practice plus production'}.
- Difficulty lock: all suggestions (vocabulary, expressions, structures, objectives) must sit EXACTLY at ${meta.level} — an A1 fill and a C1 fill for the same theme must look genuinely different in difficulty and ambition.
- For 15-minute sessions suggest fewer target items than for 25-minute sessions.
- Vocabulary suggestions: 6-12 comma-separated items, all genuinely ${meta.level}-level, all tightly related to the theme.
- Country of residence (${meta.countryOfResident || 'unspecified'}): make examples, scenarios and settings locally relevant where natural — never stereotype.
- L1 support is ${meta.l1Support ? 'ON' : 'OFF'}: ${meta.l1Support ? 'brief bilingual scaffolding is acceptable in objectives/notes' : 'do NOT mention translation, bilingual prompts, or first-language mediation'}.
- Keep every field concise — these are form inputs, not essays.

Return ONLY a valid JSON object mapping field ids to string values. No markdown, no commentary.`;
}

function buildAutofillUserPrompt(meta, fieldsToFill) {
  const fieldSpec = fieldsToFill.map(f => `- "${f.id}": ${f.label}${f.hint ? ' — ' + f.hint : ''}`).join('\n');
  return `Session type: ${getSessionType(meta.sessionType).label}
Student: ${meta.studentName} · First language: ${meta.language} · Country of residence: ${meta.countryOfResident || 'unspecified'} · L1 support: ${meta.l1Support ? 'yes' : 'no'} · Level: ${meta.level} (${meta.tier} tier) · Duration: ${meta.duration} min
The tutor wrote — ${meta.firstFieldLabel}: "${meta.title}"

Fill these fields (JSON keys must match the ids exactly):
${fieldSpec}

Return ONLY the JSON object.`;
}
