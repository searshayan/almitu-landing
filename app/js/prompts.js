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
LAYOUT DATA SHAPES (the "data" object for each layout). NEVER use emojis in any field:
- "hero":      { "heading": "...", "goal": "objective statement (one sentence)", "warmup": "a single engaging warm-up question tied to the topic", "badges": ["short chip","..."], "diagnostic": { "prompt": "quick-check question", "options": [ { "text": "...", "correct": true, "feedback": "why" } ] } (Grammar only; omit otherwise) }
- "wordlist":  { "intro": "short line or empty", "words": [ { "word": "Book", "pron": "/bʊk/  (IPA for A2-C2; a simple phonetic hint like 'say: buk' for Pre-A1/A1)", "pos": "Noun", "definition": "contextual meaning", "example": "sentence with the **Book** in bold", "l1": "L1 gloss or empty" } ], "collocations": ["read a book","..."] }
- "cards":     { "intro": "short line or empty", "cols": 3, "items": [ { "top": "main text", "mid": "secondary text or empty", "bottom": "small text or empty" } ] }
- "rows":      { "intro": "short line or empty", "rows": [ { "main": "primary text", "sub": "secondary text or empty", "note": "small colored note or empty" } ] }
- "dialogue":  { "instruction": "Read the dialogue aloud with your tutor.", "setting": "one line scene description", "lines": [ { "speaker": "name", "side": "left|right", "line": "..." } ], "notes": "tutor-aid text: comprehension-check questions + a pronunciation focus, or empty" }
- "text":      { "instruction": "Read the passage aloud with your tutor.", "paragraphs": ["... use **word** to bold target items ..."], "source_label": "label or empty", "note": "short note or empty" }
- "table":     { "intro": "short line or empty", "headers": ["...","..."], "rows": [ ["cell","cell"] ] }
- "compare":   { "intro": "short line or empty", "pairs": [ { "good": "correct version", "bad": "incorrect version", "note": "why" } ] }
- "task":      { "scenario": "...", "steps": ["learner instructions"], "starters": ["sentence starter", "..."], "tip": "short tip or empty", "criteria": ["success criterion", "..."], "notes": "(optional) tutor prompts / follow-up questions", "can_do": "(optional, combined speak+review) one Can-Do statement", "next_step": "(optional) post-session activity + tutor tracks metrics" }
- "toolkit":   { "intro": "short line or empty", "groups": [ { "function": "Opening|Requesting|Responding|Clarifying|Closing", "items": [ { "phrase": "the expression", "use": "one-line when/why", "example": "a simple model sentence using it", "l1": "L1 gloss or empty" } ] } ], "repeat": "one quick repeat-aloud activity, or empty" }
- "focus":     { "intro": "short line or empty", "frames": [ { "frame": "sentence frame / key phrase", "use": "how it helps" } ], "examples": [ "mini-dialogue line or sentence using the phrases" ], "drills": [ { "prompt": "tutor prompt", "response": "learner line using a key phrase" } ], "variations": [ "richer variation (higher levels)" ] }
- "questions": { "intro": "short line or empty", "items": [ { "question": "conversation question", "frames": [ "answer frame with a blank for the learner's own detail" ] } ], "notes": "tutor note on sequencing factual -> opinion" }
- "checklist": { "intro": "warm reinforcement line", "style": "check|numbered", "items": [ { "text": "I can ... (Can-Do statement)", "hint": "small hint or empty" } ], "footer": "the Next Step: name the post-session activity + note the tutor tracks completion time and metrics" }
- "bankmatch": { "intro": "instructions", "bank": ["word1","word2"], "prompts": [ { "q": "sentence with ___", "a": "answer from bank" } ] }
- "practice":  { "partA": { "instruction": "Fill in the blanks with the correct words from the Word Bank to complete the sentences.", "bank": ["target items = answer pool"], "sentences": ["... ___ ..."], "answers": [ { "answer": "item for blank 1", "feedback": "short feedback phrase" } ] }, "partB": { "instruction": "Create sentences using the following words.", "words": ["items to build with"], "notes": "tutor-aid: eliciting corrections / elaboration / difficulty, or empty" } }
- "integrated":{ "instruction": "Read the dialogue and text aloud with your tutor.", "dialogue": { "setting": "or empty", "lines": [ { "speaker": "name", "side": "left|right", "line": "..." } ] }, "passage": { "paragraphs": ["... **word** ..."] }, "notes": "tutor-aid: comprehension questions + a pronunciation focus, or empty" }
- "applyreview":{ "application": { "instruction": "...", "bank": ["target items = answer pool"], "prompts": ["... ___ ..."], "answers": [ { "answer": "item for prompt 1", "feedback": "short feedback phrase" } ], "notes": "tutor-aid or empty" }, "review": { "can_do": "one core Can-Do statement", "next_step": "post-session activity + tutor tracks metrics" } }
- "form":       { "intro": "short line or empty", "meaning": "what this grammar point MEANS — the idea/concept it expresses, in clear level-appropriate language", "formula": "the core structure/pattern (e.g. Subject + have/has + past participle) or the key rule if there is no single formula", "forms": [ { "label": "the case/aspect this row teaches — CHOOSE what actually teaches THIS point (a verb tense -> Affirmative/Negative/Question; articles -> a/an, the, no article; comparatives -> short adj +er / long adj more+ / irregular; prepositions -> each one's use; modals -> each modal's meaning; etc.), NEVER default to Positive/Negative/Question", "example": "a model sentence for that case, target parts in **bold**", "note": "a short clarification for this case, or empty" } ], "uses": [ { "use": "one real situation — when & why you use it", "example": "a model sentence for that use, target parts in **bold**" } ], "exceptions": [ { "point": "an exception, irregular or common pitfall for THIS point", "example": "a model sentence showing it (target parts **bold**), or empty" } ], "l1": "a short L1 note on the point, or empty", "note": "ONE higher-level contrast/nuance (B2-C2), or empty" }
- "exercise":   { "intro": "one-line instruction", "type": "mcq|gap|judgment", "items": [ (mcq) { "prompt": "...", "options": [ { "text": "...", "correct": true, "feedback": "..." } ] } | (gap) { "sentence": "... ___ ...", "answer": "...", "feedback": "..." } | (judgment) { "statement": "...", "correct": true, "feedback": "..." } ] }
- "truefalse":  { "intro": "one-line instruction", "items": [ { "statement": "...", "isTrue": true, "feedback": "why it is true or false" } ] }
- "errors":     { "intro": "one-line instruction", "items": [ { "wrong": "the mistaken sentence", "correct": "the corrected sentence", "why": "one short reason" } ] }
- "production": { "instruction": "one-line prompt-setter", "prompts": [ "open prompt to use the grammar" ], "answerKey": [ "sample strong answer" ], "comment": "what to praise / watch", "notes": "follow-up questions + correction strategies" }`;

/* ── Tier rule blocks (CEFR alignment contract) ──
   {{L1_RULE}} is substituted per request in buildSystemPrompt. */
const TIER_RULES = {
  foundation: `TIER: FOUNDATION (Pre-A1, A1) — COGNITIVE LOAD MINIMIZATION
PRODUCTIVE & RECEPTIVE CONTRACT — every slide must comply:
- L1 Semantic Support: {{L1_RULE}}
- Lexis: high-frequency, CONCRETE nouns and highly functional verbs only. No abstraction.
- High-Frequency Support: anchor every core word or functional phrase in a concrete, immediately recognizable everyday context for direct semantic mapping. Do NOT use emojis.
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
   RENDER SKELETONS
   All three skills follow the emoji-free spec, each with a 25-min and a
   distinct 15-min architecture:
     Vocabulary    — VOCAB_SKELETON_25 (6) / _15 (4)
     Grammar       — GRAMMAR_SKELETON_25 (7) / _15 (5)
     Communication — COMM_SKELETON_25 (7) / _15 (5)
   Slide TYPES are fixed; tier / level / duration / L1 drive only CONTENT
   depth, scaffolding and density — handled in buildSystemPrompt.
   ═══════════════════════════════════════════════════════ */

/* ── Vocabulary · 25-minute · 6 slides ── */
const VOCAB_SKELETON_25 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the number of target words and the lexical domain. warmup = a SINGLE engaging warm-up question tied directly to the topic (this replaces the can-do here). 1-2 short chips. No emojis.' },
  { icon: '', label: 'New Words', layout: 'wordlist', brief: 'words = ONE card for EVERY item in the tutor\'s Target Vocabulary, in the SAME order, exactly as many cards as items — never add, drop, reorder or substitute (a multi-word phrase counts as one item). Each card: word; pron = IPA in slashes for A2-C2, a simple learner phonetic hint (e.g. "say: buk") for Pre-A1/A1 (NEVER IPA below A2); pos = part of speech; definition = one clear one-sentence contextual meaning at this level; example = one natural sentence with the item in **bold**, set in a context relevant to the Learner Profile and topic; l1 = gloss ONLY if L1 support is on, else "". collocations = topic collocations (Pre-A1: 2-3; A1-B1: 4; B2-C2: 5).' },
  { icon: '', label: 'Dialogue Practice', layout: 'dialogue', brief: 'instruction EXACTLY "Read the dialogue aloud with your tutor." Title the dialogue after the topic. Write a CONNECTED dialogue between two named people/roles in a real situation relevant to the Learner Profile and topic, with a clear goal and a natural beginning-middle-resolution where EACH line answers the previous one. Naturally use EVERY target item at least once (bold each on first use) — only where it genuinely fits, never forced. Obey the exact line count for this level given in LENGTH TARGETS. Student side = right. notes = 1-2 short comprehension-check questions plus one pronunciation focus (a sound or stress to watch).' },
  { icon: '', label: 'Short Story / Article', layout: 'text', brief: 'instruction EXACTLY "Read the passage aloud with your tutor." Title the passage after the topic. Write ONE cohesive text with a single throughline: a STORY (a character + a situation + a small arc) at Pre-A1-B1, or a short informational/opinion ARTICLE (topic sentence -> support -> close) at B2-C2. Use EVERY target item at natural points (bold each); reinforce meaning through context, NOT dictionary-style explanation. Obey the exact paragraph count for this level given in LENGTH TARGETS. Reading level = this level, relevant to the Learner Profile. Optional short tutor tip in note.' },
  { icon: '', label: 'Fill in the Blanks & Sentence Building', layout: 'practice', brief: 'partA.instruction EXACTLY "Fill in the blanks with the correct words from the Word Bank to complete the sentences." partA.bank = the target vocabulary (the answer pool). partA.sentences = numbered items each with ONE blank (___) for Pre-A1-B1, OR a short connected dialogue with numbered blanks for B2-C2; obey the exact item count in LENGTH TARGETS; every blank has ONE unambiguous answer; use each item where possible. partA.answers = for each blank in order { answer: the correct item, feedback: a short interactive-checking feedback phrase }. partB.instruction EXACTLY "Create sentences using the following words." partB.words = items for the learner to build their own sentences, PRIORITISING items not used in Part A (not limited to them). partB.notes = brief tutor notes on eliciting corrections, encouraging elaboration and adapting difficulty.' },
  { icon: '', label: 'Review & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm, specific tutor reinforcement line. items = EXACTLY 3 Can-Do statements ("I can …") matched to the level. footer = the Next Step: name the level-appropriate post-session activity the student completes on the platform and note the tutor tracks completion time and practice metrics. Add an L1 line in items only if L1 support is on.' }
];

/* ── Vocabulary · 15-minute · 4 slides (distinct architecture, not a trimmed 25-min) ── */
const VOCAB_SKELETON_15 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective; warmup = a SINGLE engaging warm-up question tied to the topic. 1-2 short chips. No emojis.' },
  { icon: '', label: 'New Words & Collocations', layout: 'wordlist', brief: 'words = ONE card for EVERY item in the tutor\'s Target Vocabulary, in the SAME order, exactly as many cards as items — never add, drop, reorder or substitute (a multi-word phrase counts as one item). Fields as the 25-min word list: pron = IPA for A2-C2, a phonetic hint (e.g. "say: buk") for Pre-A1/A1 (never IPA below A2); pos; one-sentence contextual definition at this level; example with the item in **bold** in a context relevant to the Learner Profile; l1 gloss only if L1 support is on. collocations = 3 topic collocations (Pre-A1: 2).' },
  { icon: '', label: 'Integrated Practice', layout: 'integrated', brief: 'instruction EXACTLY "Read the dialogue and text aloud with your tutor." Write a CONNECTED dialogue between two named roles in a real situation relevant to the Learner Profile and topic (each line answers the previous), then a cohesive mini-passage on the same topic. Together the dialogue and passage use EVERY target item at least once, naturally (bold each item on first use) — never forced. Obey the exact dialogue line count and passage length in LENGTH TARGETS. Student side = right. notes = 1-2 short comprehension-check questions plus one pronunciation focus.' },
  { icon: '', label: 'Application & Review', layout: 'applyreview', brief: 'application.instruction = a clear gap-fill / sentence-building instruction. application.bank = the target vocabulary (answer pool). application.prompts = rapid items each with ONE blank (___); obey the exact count in LENGTH TARGETS; every blank has ONE unambiguous answer. application.answers = for each prompt in order { answer: the correct item, feedback: a short interactive-checking phrase }. application.notes = brief tutor notes on eliciting corrections and adapting difficulty. review.can_do = ONE core Can-Do statement for the level; review.next_step = the post-session activity + a note that the tutor tracks completion time and metrics.' }
];

/* ── Grammar · 25-minute · 7 slides (Diagnose → Form → Controlled → Produce → Errors → Recall → Review) ── */
const GRAMMAR_SKELETON_25 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the grammar point and what the learner will be able to DO. warmup = a short friendly warm-up question that activates prior knowledge (address the learner as "you"). diagnostic = ONE quick check that reveals prior knowledge — see GRAMMAR TARGETS for the type: { prompt, options:[{ text, correct (boolean), feedback }] } (for a judgment, use two options: Correct / Incorrect). 1-2 short chips. No emojis; no personal names.' },
  { icon: '', label: 'Form & Use', layout: 'form', brief: 'This is the CORE teaching slide — it must FULLY teach the grammar point so the student learns it and the tutor needs little extra explanation. Teach it MEANING -> FORM -> USE, adapted to THIS point (never a fixed template). intro = optional one-line framing. meaning = what the point expresses (the concept), clear at this level. formula = the core structure/pattern or key rule. forms = 2-4 entries breaking the point down the way it is ACTUALLY taught — pick the breakdown that teaches THIS point (only use Affirmative/Negative/Question for verb tenses/forms where it genuinely applies; articles -> a/an vs the vs zero; comparatives -> adjective types; prepositions -> each preposition; etc.); each { label = the case/aspect, example = a model sentence with the target parts **bold**, note = short clarification or "" }. uses = 2-3 real use cases (when & why), each with its OWN model example. exceptions = 1-3 exceptions / irregulars / common pitfalls for this point (draw on the common-errors input), each with an example where useful. EVERY explanation must carry at least one concrete example. Base the whole breakdown on the structure, objective, context and common-errors from the form, calibrated to the level. l1 = short L1 note ONLY if L1 support is on, else "". note = ONE contrast/nuance for B2-C2, else "".' },
  { icon: '', label: 'Exercise 1', layout: 'exercise', brief: 'intro = a one-line instruction. type = see GRAMMAR TARGETS (mcq for Pre-A1-A2, gap for B1-B2, judgment for C1-C2). items = EXACTLY the count in GRAMMAR TARGETS, each directly testing the target pattern. mcq item = { prompt, options:[{text, correct(boolean), feedback}] } with ONE correct option and clear feedback on each. gap item = { sentence (with ___ where the target form goes), answer, feedback }. judgment item = { statement, correct(boolean), feedback }. Vocabulary/contexts relevant to the Learner Profile.' },
  { icon: '', label: 'Communicative Practice', layout: 'production', brief: 'instruction = a one-line prompt-setter. prompts = 2-3 OPEN prompts that require the learner to USE the target grammar in meaningful sentences about their real-life context (Learner Profile). answerKey = 2-3 strong sample answers. comment = what to praise / watch for. notes = follow-up questions and correction strategies for the tutor.' },
  { icon: '', label: 'Common Errors', layout: 'errors', brief: 'intro = a one-line instruction. items = 3-5 common errors learners make with this grammar point (draw on the tutor common-errors input where given). Each item = { wrong: the mistaken sentence, correct: the fixed version, why: one short reason }. Realistic for the level and Learner Profile.' },
  { icon: '', label: 'Exercise 2', layout: 'truefalse', brief: 'intro = a one-line instruction. items = EXACTLY the True/False count in GRAMMAR TARGETS, each a statement strictly about the grammar point that helps the learner recognise the pattern. item = { statement, isTrue (boolean), feedback: one short line on why it is true or false }.' },
  { icon: '', label: 'Review & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm, specific tutor reinforcement line. items = EXACTLY 3 Can-Do statements ("I can …") about using the grammar point, matched to the level. footer = the Next Step: name the level-appropriate post-session activity and note the tutor tracks completion time and practice metrics. Add an L1 line in items only if L1 support is on.' }
];

/* ── Grammar · 15-minute · 5 slides (condensed: Diagnose → Form → Controlled → Recall → Review) ── */
const GRAMMAR_SKELETON_15 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the grammar point. warmup = a short warm-up question that activates prior knowledge (address the learner as "you"). diagnostic = ONE quick check per GRAMMAR TARGETS: { prompt, options:[{text, correct(boolean), feedback}] }. 1-2 short chips. No emojis; no names.' },
  { icon: '', label: 'Form & Use', layout: 'form', brief: 'CORE teaching slide, taught MEANING -> FORM -> USE, adapted to THIS grammar point (never a fixed template). meaning = the concept in one line. formula = the pattern/rule. forms = 2-3 entries breaking the point down the way it is actually taught (do NOT default to Positive/Negative/Question — pick what teaches THIS point), each { label, example with target parts **bold** }. uses = 1-2 use cases, each with an example. exceptions = the single most important exception/pitfall with an example, or []. Every explanation carries an example. l1 only if L1 support is on. Keep it tight but complete.' },
  { icon: '', label: 'Exercise 1', layout: 'exercise', brief: 'intro + type per GRAMMAR TARGETS (mcq Pre-A1-A2 / gap B1-B2 / judgment C1-C2). items = the count in GRAMMAR TARGETS, each testing the target pattern, with correct + incorrect feedback (same item shapes as the 25-min Exercise 1).' },
  { icon: '', label: 'Exercise 2', layout: 'truefalse', brief: 'intro + items = the True/False count in GRAMMAR TARGETS. item = { statement, isTrue (boolean), feedback }. Statements strictly about the grammar point.' },
  { icon: '', label: 'Review & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm reinforcement line. items = EXACTLY 3 Can-Do statements for the level. footer = the Next Step: post-session activity + tutor tracks completion time and metrics. L1 line only if on.' }
];

/* ── Communication & Speaking · 25-minute · 7 slides (Objective → Toolkit → Focus → Model → Questions → Task → Review) ── */
const COMM_SKELETON_25 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the real-life scenario and what the learner will be able to DO in it. warmup = a SINGLE warm-up question that primes the situation. 1-2 short chips. No emojis; no personal names.' },
  { icon: '', label: 'Language Toolkit', layout: 'toolkit', brief: 'Introduce the key words/phrases/chunks the learner needs to reach the objectives. COUNT: 6 for Pre-A1-A2, 8 for B1-C2. Present them in groups = 2-4 communicative functions; each item: phrase; use = one line on when/why; example = a simple model sentence using the phrase; l1 = gloss ONLY if L1 support is on, else "". repeat = ONE quick pronunciation/repetition activity (the learner repeats each item aloud). Friendly, 2-4 minutes.' },
  { icon: '', label: 'Language Focus', layout: 'focus', brief: 'frames = 3-5 core sentence frames / key phrases, each with use = one very simple line on how it helps with the speaking focus and objectives. examples = 2-3 short mini-dialogue lines or sentences using the phrases in the topic context, at this level. drills = 3-5 call-and-response items { prompt: what the tutor says, response: the learner\'s line using a key phrase }. For higher levels add richer variations (adding reasons/opinions/detail) in variations = [ ... ].' },
  { icon: '', label: 'Model Dialogue', layout: 'dialogue', brief: 'instruction EXACTLY "Read together, swap roles, then adapt it to talk about your own real situation." A short, natural dialogue showing the speaking focus in a realistic situation. TURNS: 6 for Pre-A1-A2, 8 for B1-B2, 10 for C1-C2. Speakers use several key phrases in questions and answers; bold the most useful lines to notice and reuse. notes = brief role-play notes. Student side = right. Use generic names or role pairs, never a personal name.' },
  { icon: '', label: 'Conversation Questions', layout: 'questions', brief: 'items = conversation questions that support the speaking focus and objectives within the topic. COUNT: 4 for Pre-A1-A2, 5 for B1-B2, 6 for C1-C2. Each item = { question, frames: [1-2 answer frames that model the key phrases and leave a blank/space for the learner\'s own detail] } — the frames reveal on click. Keep language short so each question supports ~1 minute of speaking. notes = a tutor note on sequencing from simple factual questions to opinion/feeling questions.' },
  { icon: '', label: 'Main Speaking Task', layout: 'task', brief: 'ONE structured speaking task built from the tutor\'s Speaking Activity type, Student/Tutor roles and Scenario, at this level. scenario = the setup. steps = clear learner instructions. starters = sentence starters that naturally trigger the key phrases while working toward the objectives. tip references the Toolkit. criteria = 2-4 success points by level. notes = tutor prompts and follow-up questions that keep the learner speaking and add detail. Completable in ~5-8 minutes.' },
  { icon: '', label: 'Review & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm, specific tutor reinforcement line. items = EXACTLY 3 Can-Do statements ("I can …") about handling the situation, matched to the level. footer = the Next Step: name the level-appropriate post-session activity and note the tutor tracks completion time and practice metrics. Add an L1 line in items only if L1 support is on.' }
];

/* ── Communication & Speaking · 15-minute · 5 slides (condensed) ── */
const COMM_SKELETON_15 = [
  { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the scenario; warmup = a SINGLE warm-up question priming the situation. 1-2 short chips. No emojis; no names.' },
  { icon: '', label: 'Language Toolkit', layout: 'toolkit', brief: 'The 6 most essential key words/phrases (from the tutor\'s target expressions) in 2-3 functions; each item: phrase + use (one line) + example (a simple model sentence) + l1 only if on. repeat = ONE quick repeat-aloud activity.' },
  { icon: '', label: 'Model Dialogue', layout: 'dialogue', brief: 'instruction EXACTLY "Read together, swap roles, then adapt it to your own situation." A short realistic exchange (4-6 turns; Pre-A1: 3) using the key phrases (bold the most useful lines). Student side = right. Generic names/roles only.' },
  { icon: '', label: 'Conversation Questions', layout: 'questions', brief: 'items = 3-4 conversation questions supporting the objectives; each { question, frames: [1 answer frame modelling the key phrases with a blank for personal detail] } (reveal on click). notes = a short tutor sequencing note.' },
  { icon: '', label: 'Main Speaking Task', layout: 'task', brief: 'ONE condensed speaking task from the tutor\'s Speaking Activity type, roles and scenario: scenario + 3 steps + starters (sentence starters using the key phrases) + tip + 2-3 criteria + notes (tutor prompts). Then can_do = ONE core Can-Do statement for the level, and next_step = the post-session activity + a note that the tutor tracks completion time and metrics.' }
];

const RENDER_SKELETON = {};   // all three skills are now spec-based (see *_SKELETON_* above)

/* All three skills are spec-based and switch architecture by duration. */
function getRenderSpec(skill, tier, duration) {
  const short = Number(duration) === 15;
  let slides;
  if (skill === 'grammar') {
    slides = short ? GRAMMAR_SKELETON_15 : GRAMMAR_SKELETON_25;
  } else if (skill === 'communication') {
    slides = short ? COMM_SKELETON_15 : COMM_SKELETON_25;
  } else {
    slides = short ? VOCAB_SKELETON_15 : VOCAB_SKELETON_25;   // vocabulary (default)
  }
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
  const slideCount = getRenderSpec(formData.sessionType, formData.tier, formData.duration).slides.length;
  const durationRules = `SESSION FORMAT: ${dur.label.toUpperCase()} (${slideCount} slides)
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
6. No Emojis: never output an emoji or pictographic character in ANY field (titles, text, examples, chips, icons). Keep every "icon" field an empty string. Use plain professional typography only.
7. Naming & Address: NEVER write the learner's personal name in any slide. Address the learner directly as "you". In dialogues, role-plays and examples, use common first names or role pairs that fit the topic (e.g. Tutor/Student, Manager/Employee, Customer/Assistant, Doctor/Patient, Neighbour/Neighbour). The content must read naturally for ANY student so the session can be reused.

OUTPUT SCHEMA (slides only — post-session practice is generated in a later, separate call):
{ "slides": [ ...exactly the slides specified, in order... ] }

Each slide object: { "icon": "<given>", "label": "<given>", "title": "a brief, descriptive slide title", "layout": "<given>", "data": { ...per layout shape... } }
${LAYOUT_DOCS}`;
}

/* Strict, level-resolved length targets for the Vocabulary practice slides.
   Injected as exact requirements so counts are not left to the model. */
function vocabTargets(level) {
  const band = ['Pre-A1', 'A1'].includes(level) ? 'low'
    : ['A2', 'B1'].includes(level) ? 'mid' : 'high';
  return {
    // 25-minute deck
    dialogueLines: band === 'low' ? '6 to 8' : band === 'mid' ? '8 to 10' : '10 to 14',
    storyGenre: band === 'high' ? 'a short informational/opinion ARTICLE' : 'a STORY',
    storyParagraphs: band === 'low' ? '1 paragraph' : band === 'mid' ? '2 paragraphs' : '3 paragraphs',
    fillItems: band === 'low' ? '6 numbered sentences (one blank each)'
      : band === 'mid' ? '8 numbered sentences (one blank each)'
        : 'a short connected dialogue with 8-10 numbered blanks',
    // 15-minute micro-session
    intDialogueLines: band === 'low' ? '4 to 6' : band === 'mid' ? '6 to 8' : '8 to 10',
    intPassage: band === 'low' ? '2-3 sentences' : band === 'mid' ? '3-4 sentences' : '4-6 sentences',
    applyItems: band === 'low' ? '3' : band === 'mid' ? '4' : '4-5'
  };
}

/* Strict, level-resolved exercise types + counts for Grammar. */
function grammarTargets(level, duration) {
  const exType = ['Pre-A1', 'A1', 'A2'].includes(level) ? 'multiple-choice (MCQ, one correct option)'
    : ['B1', 'B2'].includes(level) ? 'gap-fill (one blank each)'
      : 'sentence-judgment (Correct / Incorrect)';
  const diagType = ['Pre-A1', 'A1', 'A2', 'B1'].includes(level)
    ? 'a multiple-choice question (MCQ)'
    : 'a short correct/incorrect judgment';
  const short = Number(duration) === 15;
  return { exType, diagType, exCount: short ? 3 : 5, tfCount: short ? 4 : 5 };
}

/* Strict, level-resolved counts for Communication & Speaking. */
function commTargets(level) {
  const low = ['Pre-A1', 'A1', 'A2'].includes(level);
  const mid = ['B1', 'B2'].includes(level);
  return {
    toolkit: low ? 6 : 8,
    dialogueTurns: low ? 6 : mid ? 8 : 10,
    questions: low ? 4 : mid ? 5 : 6
  };
}

/* Resolve a Student Profile string for personalization. Live sessions use the
   tutor's real inputs; curriculum/empty falls back to a neutral adult learner
   grounded only in the topic/context (no invented personal facts). */
function resolveStudentProfile(formData) {
  const d = formData.details || {};
  const bits = [];
  if (formData.countryOfResident) bits.push('living in ' + formData.countryOfResident);
  if (d.personalization) bits.push(d.personalization);
  if (d.realWorldContext) bits.push('will use this English for: ' + d.realWorldContext);
  return bits.length
    ? 'An adult learner ' + bits.join('; ') + '.'
    : 'A general adult learner — ground examples only in the topic and context above; invent no personal facts.';
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

  // Vocabulary-only: strict, level-resolved length targets the briefs refer to.
  let lengthTargets = '';
  if (formData.sessionType === 'vocabulary') {
    const t = vocabTargets(formData.level);
    lengthTargets = Number(formData.duration) === 15
      ? `\nLENGTH TARGETS for ${formData.level} (STRICT — obey exactly):
- Integrated Practice: a dialogue of ${t.intDialogueLines} lines PLUS a mini-passage of ${t.intPassage}; together they use EVERY target item.
- Application: ${t.applyItems} items.\n`
      : `\nLENGTH TARGETS for ${formData.level} (STRICT — obey exactly):
- Dialogue Practice: ${t.dialogueLines} lines.
- Short Story / Article: ${t.storyGenre}, ${t.storyParagraphs}.
- Fill in the Blanks (Part A): ${t.fillItems}.\n`;
  } else if (formData.sessionType === 'grammar') {
    const g = grammarTargets(formData.level, formData.duration);
    lengthTargets = `\nGRAMMAR TARGETS for ${formData.level} (STRICT — obey exactly):
- Warm-up diagnostic: ${g.diagType}.
- Exercise 1: EXACTLY ${g.exCount} ${g.exType} items, each with correct + incorrect feedback.
- Exercise 2 (True/False): EXACTLY ${g.tfCount} statements.\n`;
  } else if (formData.sessionType === 'communication') {
    const c = commTargets(formData.level);
    lengthTargets = `\nCOMMUNICATION TARGETS for ${formData.level} (STRICT — obey exactly):
- Language Toolkit: ${c.toolkit} key phrases.
- Model Dialogue: ${c.dialogueTurns} turns.
- Conversation Questions: ${c.questions} questions, each with 1-2 revealable answer frames.\n`;
  }

  return `Generate the complete instructional slide deck for a ${formData.duration}-minute live interactive session, complying fully with render template ${spec.id} and the ${formData.duration}-minute format rules.

LEARNER PROFILE:
- Addressing: refer to the learner ONLY as "you"; NEVER write a personal name in slide content (see Naming & Address rule). Use generic names or role pairs in dialogues.
- Profile (personalize content to this): ${resolveStudentProfile(formData)}
- Native Language / Culture: ${formData.language}
- Country of Residence: ${formData.countryOfResident || 'not specified'} — ground examples, settings, and scenarios in this real-world context where natural (currency, places, services, everyday situations). Improve realism only; never stereotype the learner.
- L1 Translation Support: ${formData.l1Support ? 'ENABLED — populate all L1 data slots with ' + l1Lang + ' terms.' : 'DISABLED — all L1 strings must remain empty ("").'}
- Confirmed CEFR Target Level: ${formData.level} (Tier Classification: ${formData.tier})
- Session Duration: ${formData.duration} minutes

SESSION FOCUS: ${st.label}

INPUT SOURCE DATA (the tutor's target items — treat as inviolable):
${detailLines}${lengthTargets}
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

CALIBRATION — base every suggestion ONLY on: the level, the session duration, the topic/theme/scenario the tutor wrote, the country of residence, and L1 support. Never calibrate on, or invent, a student's identity.
- NAMING: never use a personal name. Address the learner as "you" and phrase objectives as "You can …" (e.g. "You can order confidently at a café."). Communication roles read like "You = the customer; Tutor = the waiter." Every fill must read naturally for ANY student so the session is reusable.
- Student level: ${meta.level} (tier: ${tier.label}) — ${levelDescriptor(meta.level)}
- Tier characteristics: ${tier.rules.join('; ')}
- Session duration: ${dur.label} — ${dur.key === 15 ? 'keep scope TIGHT: fewer targets, one focus, shorter outputs' : 'fuller scope with room for guided practice plus production'}.
- Difficulty lock: all suggestions (vocabulary, expressions, structures, objectives) must sit EXACTLY at ${meta.level} — an A1 fill and a C1 fill for the same theme must look genuinely different in difficulty and ambition.
- For 15-minute sessions suggest fewer target items than for 25-minute sessions.
- VOCABULARY fills: 6-12 comma-separated target items, all genuinely ${meta.level}-level and tightly related to the theme (all of them are taught); objective + real-world context phrased with "you".
- GRAMMAR fills: a clear grammar structure/pattern; exampleSentences = 3 model sentences at ${meta.level} that best DEMONSTRATE this grammar point's key cases/contrasts (for a verb tense that may be affirmative/negative/question; for articles a/the/zero; for comparatives different adjective types — fit the point, don't force a pos/neg/question triple); they seed the Form & Use and exercise slides; commonErrors = 3-5 realistic mistakes a ${meta.language || 'learner'} at this level tends to make — they feed the Common Errors slide and the Form & Use exceptions.
- COMMUNICATION fills: targetExpressions = 6-8 functional phrases the learner needs for the scenario (feed the Toolkit, Language Focus and Conversation Questions); pick a speakingActivity that fits the scenario and level; roles phrased with "you" (e.g. "You = the customer; Tutor = the receptionist").
- Country of residence (${meta.countryOfResident || 'unspecified'}): make examples, scenarios and settings locally relevant where natural — never stereotype.
- L1 support is ${meta.l1Support ? 'ON' : 'OFF'}: ${meta.l1Support ? 'brief bilingual scaffolding is acceptable in notes' : 'do NOT mention translation, bilingual prompts, or first-language mediation'}.
- Keep every field concise — these are form inputs, not essays.

Return ONLY a valid JSON object mapping field ids to string values. No markdown, no commentary.`;
}

function buildAutofillUserPrompt(meta, fieldsToFill) {
  const fieldSpec = fieldsToFill.map(f => `- "${f.id}": ${f.label}${f.hint ? ' — ' + f.hint : ''}`).join('\n');
  return `Session type: ${getSessionType(meta.sessionType).label}
Calibration — First language: ${meta.language || 'unspecified'} · Country of residence: ${meta.countryOfResident || 'unspecified'} · L1 support: ${meta.l1Support ? 'yes' : 'no'} · Level: ${meta.level} (${meta.tier} tier) · Duration: ${meta.duration} min
The tutor wrote — ${meta.firstFieldLabel}: "${meta.title}"

Fill these fields (JSON keys must match the ids exactly):
${fieldSpec}

Return ONLY the JSON object.`;
}
