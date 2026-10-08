/* ═══════════════════════════════════════════════════════
   Almitu — Speaking track
   A separate curriculum beside Literacy and the CEFR tiers, with its own three
   tiers (Foundation, Development, Proficiency) and NO CEFR levels. Difficulty is
   calibrated by a hidden "step" (F1–F4, D1–D6, P1–P4) that only the generator
   sees: it never reaches a tutor or a learner.

   Records come from app/curriculum/speaking-<tier>.json (built from the approved
   workbook by tools/build_speaking_curriculum.py). Slides go through the normal
   generateSlides() path with the Speaking skeleton below; the practice bank is
   items + sentences + a "model talk" Listening card (no Reading, no Explore More).
   ═══════════════════════════════════════════════════════ */

/* One row per hidden step. toolkit/turns/questions are the slide counts; listen* is
   the model-talk length (characters are what ElevenLabs bills on); talk is the
   tutor/learner share the slides should assume. */
const SPEAKING_STEPS = {
  F1: { tier: 'foundation', toolkit: 6, turns: 6, questions: 4, listenQ: 5, listenChars: '500–750 characters', listenSecs: '40–55', listenTarget: 45,
        turn: 'one or two very short sentences built from memorized chunks',
        language: 'present-tense be/have only; no past tense; the six given chunks and nothing else',
        support: 'word bank and pictures always on; first-language hints if enabled',
        talk: 'about 60% tutor / 40% learner — the tutor models every exchange first',
        descriptor: 'Speaking Foundation, first stage. Absolute-beginner speakers: memorized chunks and fixed phrases only, one or two very short sentences per turn, present-tense be/have only, no past tense. The tutor models everything first; word bank and pictures always on; very high success.' },
  F2: { tier: 'foundation', toolkit: 6, turns: 6, questions: 4, listenQ: 5, listenChars: '500–750 characters', listenSecs: '40–55', listenTarget: 45,
        turn: 'two to three short sentences, with prompts',
        language: 'simple present, can, likes, there is/are, simple questions; places and times',
        support: 'word bank and pictures; hints optional',
        talk: 'about 55% tutor / 45% learner — the tutor models, then the learner repeats and adapts',
        descriptor: 'Speaking Foundation, second stage. Short chunks and sentence frames, two to three short sentences per turn; simple present, can, likes, there is/are, simple questions; places and times. The tutor models, then the learner repeats and adapts; word bank available.' },
  F3: { tier: 'foundation', toolkit: 6, turns: 6, questions: 4, listenQ: 5, listenChars: '500–750 characters', listenSecs: '40–55', listenTarget: 45,
        turn: 'three short linked sentences with a simple reason (because)',
        language: 'simple past with a small set of common verbs, comparatives, present continuous',
        support: 'word bank; fewer pictures',
        talk: 'about 50% tutor / 50% learner — the learner leads most exchanges after one model',
        descriptor: 'Speaking Foundation, third stage. Three short linked sentences with a simple reason (because); simple past with a small set of common verbs, comparatives, present continuous. The learner leads most exchanges after one model.' },
  F4: { tier: 'foundation', toolkit: 6, turns: 6, questions: 4, listenQ: 5, listenChars: '500–750 characters', listenSecs: '40–55', listenTarget: 45,
        turn: 'three to four linked short sentences',
        language: 'adds frequency, quantity, going to and simple directions',
        support: 'word bank on request',
        talk: 'about 45% tutor / 55% learner — the tutor models only the new phrases',
        descriptor: 'Speaking Foundation, fourth stage. Three to four linked short sentences; adds frequency, quantity, going to and simple directions. The learner leads; the tutor models only the new phrases.' },
  D1: { tier: 'development', toolkit: 6, turns: 6, questions: 4, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'short connected answers of three to five sentences with a reason',
        language: 'simple past stories, comparatives, can/have to',
        support: 'sentence starters; hints optional',
        talk: 'about 40% tutor / 60% learner',
        descriptor: 'Speaking Development, early stage. Short connected answers of three to five sentences with a reason; simple past stories, comparatives, can/have to. Sentence starters available.' },
  D2: { tier: 'development', toolkit: 6, turns: 6, questions: 4, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'four to five connected sentences',
        language: 'past and present contrast, would, want to',
        support: 'sentence starters',
        talk: 'about 40% tutor / 60% learner',
        descriptor: 'Speaking Development, second stage. Four to five connected sentences; past and present contrast, would, want to. Sentence starters available.' },
  D3: { tier: 'development', toolkit: 6, turns: 6, questions: 4, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'five sentences with reasons and examples',
        language: 'present perfect for experience and used to (as chunks)',
        support: 'sentence starters on request',
        talk: 'about 40% tutor / 60% learner',
        descriptor: 'Speaking Development, third stage. Five sentences with reasons and examples; present perfect for experience and used to introduced as chunks. Starters only on request.' },
  D4: { tier: 'development', toolkit: 8, turns: 8, questions: 5, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'short stories and opinions of several sentences',
        language: 'present perfect, used to, relative clauses, simple conditionals (as chunks)',
        support: 'a planning minute; few starters',
        talk: 'about 35% tutor / 65% learner',
        descriptor: 'Speaking Development, fourth stage. Short stories and opinions of several sentences; present perfect, used to, relative clauses, simple conditionals as chunks. A planning minute, few starters.' },
  D5: { tier: 'development', toolkit: 8, turns: 8, questions: 5, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'a two-minute talk on a familiar topic',
        language: 'narrative tenses, comparison over time, advice and suggestions',
        support: 'a planning minute',
        talk: 'about 35% tutor / 65% learner',
        descriptor: 'Speaking Development, fifth stage. A two-minute talk on a familiar topic; narrative tenses, comparison over time, advice and suggestions. A planning minute.' },
  D6: { tier: 'development', toolkit: 8, turns: 8, questions: 5, listenQ: 6, listenChars: '850–1,200 characters', listenSecs: '65–90', listenTarget: 75,
        turn: 'a two- to three-minute talk with detail',
        language: 'mixed tenses, reasons, results and reflection',
        support: 'a planning minute only',
        talk: 'about 35% tutor / 65% learner',
        descriptor: 'Speaking Development, final stage. A two- to three-minute talk with detail; mixed tenses, reasons, results and reflection. A planning minute only.' },
  P1: { tier: 'proficiency', toolkit: 8, turns: 8, questions: 5, listenQ: 7, listenChars: '1,600–2,000 characters', listenSecs: '120–150', listenTarget: 135,
        turn: 'real-life exchanges with one complication',
        language: 'polite requests, formal and informal register, clarifying',
        support: 'structure frames only',
        talk: 'about 30% tutor / 70% learner',
        descriptor: 'Speaking Proficiency, first stage. Real-life exchanges that include one complication; polite requests, formal and informal register, clarifying. Structure frames only.' },
  P2: { tier: 'proficiency', toolkit: 8, turns: 8, questions: 5, listenQ: 7, listenChars: '1,600–2,000 characters', listenSecs: '120–150', listenTarget: 135,
        turn: 'extended turns with agreement, disagreement and conflict language',
        language: 'hedging, concession, conditionals, reporting',
        support: 'rubric and frames only',
        talk: 'about 30% tutor / 70% learner',
        descriptor: 'Speaking Proficiency, second stage. Extended turns; agreeing and disagreeing, conflict and emotion language; hedging, concession, conditionals, reporting. Rubric and frames only.' },
  P3: { tier: 'proficiency', toolkit: 8, turns: 10, questions: 6, listenQ: 7, listenChars: '1,600–2,000 characters', listenSecs: '120–150', listenTarget: 135,
        turn: 'structured presentations and discussion of abstract topics',
        language: 'signposting, cause and effect, reporting verbs, passive',
        support: 'rubric only',
        talk: 'about 25% tutor / 75% learner',
        descriptor: 'Speaking Proficiency, third stage. Structured presentations and discussion of abstract and social topics; signposting, cause and effect, reporting verbs, passive. Rubric only.' },
  P4: { tier: 'proficiency', toolkit: 8, turns: 10, questions: 6, listenQ: 7, listenChars: '1,600–2,000 characters', listenSecs: '120–150', listenTarget: 135,
        turn: 'persuasion, storytelling and unprepared speaking',
        language: 'rhetorical devices, narrative control, fast recovery',
        support: 'no scripts',
        talk: 'about 20% tutor / 80% learner',
        descriptor: 'Speaking Proficiency, final stage. Persuasion, storytelling and unprepared speaking; rhetorical devices, narrative control, fast recovery. No scripts.' }
};

/* Plug the hidden steps into the existing calibration tables (keyed 'SPK-F1' …) so
   levelDescriptor(), commTargets() and practiceCardSpec() all work unchanged. */
Object.keys(SPEAKING_STEPS).forEach(k => {
  const s = SPEAKING_STEPS[k];
  LEVEL_DESCRIPTORS['SPK-' + k] = s.descriptor;
  PRACTICE_CARD_SPEC['SPK-' + k] = { readWords: '', readQ: String(s.listenQ), listenSecs: s.listenSecs, listenTarget: s.listenTarget, listenChars: s.listenChars };
});

function speakingStepOf(levelKey) {
  const m = /^SPK-([FDP]\d)$/.exec(levelKey || '');
  return m ? SPEAKING_STEPS[m[1]] : null;
}

/* ─────────── Generator input ─────────── */

function speakingFormData(rec) {
  const roleMatch = /Student\s*=\s*([^,.]+)[,.]\s*Tutor\s*=\s*([^.]+)/i.exec(rec.task || '');
  const roles = roleMatch ? `Student = ${roleMatch[1].trim()}, Tutor = ${roleMatch[2].trim()}` : '';
  const notes = [
    'Main task: ' + (rec.task || ''),
    rec.exit_task ? 'Success check: ' + rec.exit_task : '',
    rec.language_focus ? 'Language focus: ' + rec.language_focus : '',
    rec.pronunciation ? 'Pronunciation focus: ' + rec.pronunciation : '',
    rec.tutor_notes ? 'Tutor notes: ' + rec.tutor_notes : ''
  ].filter(Boolean).join(' | ');
  return {
    studentName: 'the student', language: '', countryOfResident: '', l1Support: false,
    level: 'SPK-' + rec.step,            // hidden calibration key — never displayed
    tier: rec.tier,                       // foundation | development | proficiency (reuses TIER_RULES)
    sessionType: 'speaking',
    duration: 25,
    details: {
      scenarioTitle: rec.title, objective: rec.objective || '',
      targetExpressions: (rec.expressions || []).join('\n'),
      speakingActivity: rec.activity, roles, culturalNotes: '', notes
    },
    speaking: {
      step: rec.step, unit: rec.unit, unitTitle: rec.unit_title, unitOutcome: rec.unit_outcome,
      kind: rec.kind, covers: rec.covers || [], canDo: rec.can_do, listeningMode: rec.listening_mode,
      expressions: rec.expressions || [], tierLabel: rec.level
    }
  };
}

/* ─────────── Slide skeletons ─────────── */

function speakingSkeleton(formData) {
  const sp = formData.speaking || {};
  const st = SPEAKING_STEPS[sp.step] || SPEAKING_STEPS.F2;
  const n = (sp.expressions || []).length || st.toolkit;
  const foundation = formData.tier === 'foundation';
  const modelNote = foundation
    ? ' notes = tutor-aid: the tutor reads the whole dialogue aloud FIRST, then the learner echoes each line, then they swap roles and the learner adapts it.'
    : ' notes = brief role-play notes. The tutor only models briefly; the learner takes the lead.';

  if (sp.kind === 'review') {
    const k = (sp.covers || []).length || 4;
    return [
      { icon: '', label: 'Milestone', layout: 'hero', brief: 'goal = ONE sentence that frames today as a milestone, built from the unit outcome given in the input (start with "Today you show that you can"). warmup = a SINGLE warm-up question that pulls together the unit topics. badges = [] (the app adds the unit badges). No emojis; no personal names.' },
      { icon: '', label: 'Key Phrases Recap', layout: 'toolkit', brief: `Present EXACTLY the ${n} target phrases from the input, verbatim and in the given order — none added, removed or reworded. Group them into 2-4 communicative functions; each item: phrase; use = one line on when/why; example = a simple model sentence using it; l1 = "". repeat = ONE quick repeat-aloud activity.` },
      { icon: '', label: 'Station Circuit', layout: 'task', brief: `ONE circuit task. scenario = a one-line setup. steps = EXACTLY ${k} stations, one per lesson covered (${(sp.covers || []).join(', ')}), each a 30-60 second exchange between tutor and learner that uses that lesson's phrases from the recap. starters = sentence starters drawn only from the recap phrases. tip = how the tutor picks the weakest stations first. criteria = 2-3 success points. notes = tutor prompts for the free chain conversation that follows (mix at least three lessons${formData.tier === 'development' ? '; include one unexpected question' : ''}${formData.tier === 'proficiency' ? '; include one complication' : ''}).` },
      { icon: '', label: 'Mixed Conversation', layout: 'questions', brief: `items = ${st.questions} conversation questions that deliberately mix topics from the lessons covered, each { question, frames: [1 answer frame using a recap phrase and leaving room for the learner's own detail] }. notes = a tutor note on how to run it as a free chain conversation and when to stop.` },
      { icon: '', label: 'Milestone & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm, specific tutor line celebrating the milestone. items = EXACTLY 3 short plain recap points a TUTOR can read aloud (what the learner can now do, drawn from the unit outcome) — factual, NOT "I can" statements. footer = the Next Step: the learner practices the speaking challenge shown below aloud before the next session, and the tutor records whether the milestone was reached.' }
    ];
  }

  return [
    { icon: '', label: 'Objective & Warm-up', layout: 'hero', brief: 'goal = a one-sentence objective naming the real-life scenario and what the learner will be able to DO in it (use the can-do wording given in the input). warmup = a SINGLE warm-up question that primes the situation. badges = [] (the app adds the unit badge). No emojis; no personal names.' },
    { icon: '', label: 'Language Toolkit', layout: 'toolkit', brief: `Present EXACTLY the ${n} target phrases from the input, verbatim and in the given order — none added, removed or reworded. Group them into 2-4 communicative functions; each item: phrase; use = one line on when/why; example = a simple model sentence using it; l1 = "" unless L1 support is on. repeat = ONE quick repeat-aloud activity${foundation ? ' (the tutor says each phrase first, the learner echoes it)' : ''}. Friendly, 2-4 minutes.` },
    { icon: '', label: 'Language Focus', layout: 'focus', brief: `frames = 3-5 core sentence frames taken from the target phrases, each with use = one very simple line on how it helps. examples = 2-3 short mini-dialogue lines using the phrases in the topic context. drills = 3-5 call-and-response items { prompt: what the tutor says, response: the learner's line using a key phrase }.${foundation ? ' Leave variations = [].' : ' variations = [ 2-3 richer variations adding a reason, an example or detail ].'}` },
    { icon: '', label: 'Model Dialogue', layout: 'dialogue', brief: `instruction EXACTLY "Read together, swap roles, then adapt it to talk about your own real situation." A short, natural dialogue showing the speaking focus in a realistic situation. TURNS: exactly ${st.turns}. Speakers use several of the target phrases; bold the most useful lines to notice and reuse. Student side = right. Use generic names or role pairs, never a personal name.${modelNote}` },
    { icon: '', label: 'Conversation Questions', layout: 'questions', brief: `items = EXACTLY ${st.questions} conversation questions that support the objective, each { question, frames: [1-2 answer frames that model the target phrases and leave a blank for the learner's own detail] } — the frames reveal on click. Keep language short so each question supports about a minute of speaking. notes = a tutor note on sequencing from simple factual questions to opinion or feeling questions.` },
    { icon: '', label: 'Main Speaking Task', layout: 'task', brief: `ONE structured speaking task built from the Speaking Activity, the roles and the "Main task" given in the input notes. scenario = the setup. steps = clear learner instructions. starters = sentence starters that trigger the target phrases. tip references the Toolkit. criteria = 2-3 success points matching the "Success check" in the input notes. notes = tutor prompts and follow-up questions that keep the learner speaking and add detail.${sp.step && /^P/.test(sp.step) ? ' Include the complication named in the main task.' : ''} Completable in about 5-8 minutes.` },
    { icon: '', label: 'Review & Next Step', layout: 'checklist', brief: 'style:check. intro = one warm, specific tutor reinforcement line. items = EXACTLY 3 short plain recap points a TUTOR can read aloud (the situation, the key phrases taught, the speaking practice done) — factual, NOT "I can" statements. footer = the Next Step: the learner practices the speaking challenge shown below aloud before the next session, and the tutor notes how it went.' }
  ];
}

/* Extra block appended to the slide user prompt for Speaking sessions. */
function speakingPromptBlock(formData) {
  const sp = formData.speaking || {};
  const st = SPEAKING_STEPS[sp.step] || SPEAKING_STEPS.F2;
  return `
SPEAKING TRACK — QUICK-RESULT SPEAKING (this is not a CEFR lesson; the learner just wants to speak):
- Difficulty profile for this session: learner turn = ${st.turn}; language range = ${st.language}; support = ${st.support}; talk share = ${st.talk}.
- Unit: "${sp.unitTitle}". Unit outcome: ${sp.unitOutcome}
- Can-do (learner-facing goal for this session): ${sp.canDo}
- Session kind: ${sp.kind === 'review' ? 'REVIEW AND MILESTONE — no new language; reuse only the phrases given.' : 'CORE session.'}
- TARGET PHRASES (verbatim, in this order, ${(sp.expressions || []).length} of them): ${(sp.expressions || []).map((e, i) => (i + 1) + '. ' + e).join('  ')}
- Never write a level code, the word CEFR, or any of A1, A2, B1, B2, C1, C2, Pre-A1 in any field. Never mention a step. Learners must never see difficulty labels.
- Keep the tutor-vs-learner talk share above visible in the tutor notes (model first at Foundation; learner leads later).
`;
}

/* ─────────── Practice bank ─────────── */

function buildSpeakingPracticeBankSystemPrompt(formData) {
  const sp = formData.speaking || {};
  const st = SPEAKING_STEPS[sp.step] || SPEAKING_STEPS.F2;
  const spec = practiceCardSpec(formData.level);
  const tierRules = TIER_RULES[formData.tier].replace(/\{\{L1_RULE\}\}/g, 'DISABLED — keep all L1 data slots strictly as empty strings (""). Do not introduce any non-English text under any circumstances.');
  const setup = sp.listeningMode === 'setup_message';
  const modeText = setup
    ? `LISTENING MODE: SETUP MESSAGE. This session is a real-life service situation, so the narrator reads ONE short message that sets up the task as a voicemail, a recorded announcement or a note read aloud to the listener (for example a hotel confirming a booking, a clinic reminding about an appointment, a bank announcing opening hours). It must be addressed to "you" and be a single voice. The questions ask what the message wants AND what the learner would say or do in reply, and the best reply must use or closely match one of the target phrases.`
    : `LISTENING MODE: MODEL TALK. The narrator gives ONE well-organized model answer to this session's main speaking task — the kind of talk a good learner would give — using several of the target phrases naturally. Write it as one speaker talking (first person is fine, e.g. "My neighbors are friendly. We look out for each other."). The questions check HOW it was said: which phrase the speaker used to do something (give a reason, make a request, close politely), what example or reason was given, how it ended. Questions must still be answerable from the script alone.`;
  return `You are the Almitu Practice Engine. Build the post-session practice bank for a SPEAKING session: flashcards, quiz, gap-fill, reorder and matching (all derived from "items" and "sentences") PLUS one Listening card. There is NO Reading card and NO Explore More card.

${tierRules}

DIFFICULTY PROFILE (hidden from learners — never mention it): ${st.descriptor}
Language range: ${st.language}. Learner turn: ${st.turn}.

RULES:
- Cover EVERY target phrase supplied — no more, no fewer. One target phrase = one "items" entry; never merge or split phrases.
- "term" is the phrase exactly as given. "meaning" explains in plain, level-appropriate English WHEN and WHY you say it (these are speaking phrases, not isolated words). "example" is one natural sentence or short exchange using it.
- "sentences": 6-8 standalone practice sentences, each containing exactly one target phrase (a blank-able chunk). Keep them at the difficulty profile.
- L1 support is OFF: leave every "l1" and "l1_explanation" field as an empty string.
- Never write a level code, the word CEFR, or any of A1, A2, B1, B2, C1, C2, Pre-A1 anywhere.
- Return ONLY one valid JSON object. No markdown, no commentary.

LISTENING PRACTICE (written for speaking, not just to describe the topic)
${modeText}
- "internalScript": ONE narrator's natural spoken text for TTS. LENGTH IS A HARD LIMIT: ${spec.listenChars} — count characters, not words. Roughly ${spec.listenTarget}s of audio. Aim for the range; a script shorter than half the minimum is rejected and regenerated, so write a real talk with an opening, a middle part and a close, not two or three lines. Never write a back-and-forth between named speakers; a single voice reads it start to finish.
- Real structure: a clear opening, two or three connected parts, a close. Vary sentence length naturally for the difficulty profile; no idioms or sarcasm at Foundation.
- ${spec.readQ} questions, ALL "type": "multiple_choice" with exactly 3 options; no typed answers, no trick questions, no "Which is NOT" negatives. Each question and its correct answer must be directly verifiable from the script. Feedback may quote only a very short phrase and must NEVER reveal the whole script.
- "keyLanguageAfterCompletion": the target phrases as the speaker used them, each { phrase (the exact target phrase), focus (what it does in the talk) } — this becomes the learner's "Notice" box.

OUTPUT SCHEMA:
{ "practice_bank": {
  "items": [ { "term": "target phrase exactly as given", "meaning": "when and why you say it", "l1": "", "example": "one natural sentence using it", "explanation": "short English note on meaning/form/use", "l1_explanation": "" } ],
  "sentences": [ "6-8 standalone practice sentences, each containing exactly one target phrase" ],
  "listening": { "id": "listening", "type": "listening_practice", "title": "Listen: [specific title]", "estimatedMinutes": 5, "cefrLevel": "${sp.tierLabel || 'Speaking'}", "canDo": "I can hear how a good answer sounds and say something similar myself.", "instructions": ["Listen to the whole talk once.","Choose the best answer.","Replay as many times as you need, then try saying your own version aloud."], "audio": { "generationRequired": true, "internalScript": "[INTERNAL ONLY — spoken script for TTS; never shown to the student]", "voiceProfile": "almitu-learning-voice", "speakerPlan": ["narrator"], "speed": 0.9, "format": "mp3", "audioStatus": "pending", "audioPath": null, "durationTargetSeconds": ${spec.listenTarget}, "transcriptPolicy": "never_display" }, "questions": [ { "id": "listening-q1", "type": "multiple_choice", "question": "[clear question]", "options": ["[option]","[option]","[option]"], "answer": "[exact correct option]", "feedbackCorrect": "[short confirmation]", "feedbackIncorrect": "[short listening clue without revealing the full script]" } ], "keyLanguageAfterCompletion": [ { "phrase": "[exact target phrase]", "focus": "[what it does in the talk]" } ] }
} }`;
}

function buildSpeakingPracticeBankUserPrompt(formData, slides) {
  const sp = formData.speaking || {};
  const d = formData.details || {};
  const digest = (slides || []).map(s => `${s.label}: ${s.title}`).join(' | ');
  return `Build the practice bank for this Speaking session.

TARGET PHRASES (inviolable — cover all ${(sp.expressions || []).length}, add none):
${(sp.expressions || []).map((e, i) => `  ${i + 1}. ${e}`).join('\n')}

SESSION: "${d.scenarioTitle}" — ${d.objective}
Unit: ${sp.unitTitle}. Unit outcome: ${sp.unitOutcome}
Main task: ${(d.notes || '').split(' | ')[0].replace(/^Main task: /, '')}
Listening mode: ${sp.listeningMode === 'setup_message' ? 'setup message (voicemail / announcement)' : 'model talk'}
The session was delivered as these slides: ${digest}

Produce the practice_bank per the schema — items, sentences and the Listening card only. Return ONLY the JSON object.`;
}

/* ─────────── Post-processing and validation ─────────── */

function _walkStrings(v, fn) {
  if (typeof v === 'string') fn(v);
  else if (Array.isArray(v)) v.forEach(x => _walkStrings(x, fn));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => _walkStrings(x, fn));
}
const _LEVEL_LEAK = /\bSPK-|\bCEFR\b|\b(Pre-A1|A1|A2|B1|B2|C1|C2)\b/;
function _normPhrase(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/[“”"‘’']/g, '').replace(/\.{3}|…|_{2,}/g, '___').replace(/[.,!?;:]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* Add the deterministic parts (unit badge, outcome, repair phrases, speaking
   challenge) and verify the AI kept to the record. Throws on any mismatch so the
   caller can retry, and nothing wrong is ever stored. */
function speakingProcess(content, rec) {
  const fd = speakingFormData(rec);
  const expected = speakingSkeleton(fd);
  const slides = content.slides || [];
  if (slides.length !== expected.length) throw new Error(`Expected ${expected.length} slides, got ${slides.length}.`);

  let leak = null;
  _walkStrings(slides, s => { if (!leak && _LEVEL_LEAK.test(s)) leak = s; });
  if (leak) throw new Error('A level label leaked into the slides: "' + leak.slice(0, 60) + '"');

  const toolkit = slides.find(s => s.layout === 'toolkit');
  if (!toolkit) throw new Error('No toolkit slide.');
  const got = [];
  (toolkit.data.groups || []).forEach(g => (g.items || []).forEach(it => got.push(_normPhrase(typeof it === 'string' ? it : it.phrase))));
  const want = rec.expressions.map(_normPhrase);
  const missing = want.filter(w => !got.includes(w));
  if (got.length !== want.length || missing.length) throw new Error(`Toolkit does not match the ${want.length} target phrases (missing: ${missing.slice(0, 2).join(' / ') || 'count differs'}).`);

  // Hero: unit badge + outcome.
  const hero = slides.find(s => s.layout === 'hero');
  if (hero) {
    hero.data = hero.data || {};
    hero.data.badges = [`Unit ${rec.unit}: ${rec.unit_title}`].concat(rec.kind === 'review' ? ['Milestone'] : []);
    hero.data.outcome = rec.unit_outcome;
  }
  // Repair phrases slide on unit openers.
  if (rec.repair_phrases && rec.repair_phrases.length) {
    const idx = slides.indexOf(hero) + 1;
    slides.splice(idx, 0, {
      icon: '', label: 'Repair Phrases', title: 'Repair phrases for this unit', layout: 'toolkit',
      data: {
        intro: 'Use these whenever you do not understand or need help. You can use them in every session in this unit.',
        groups: [{ function: 'When you need help', items: rec.repair_phrases.map(p => ({ phrase: p, use: '', example: '', l1: '' })) }],
        repeat: 'Say each phrase after your tutor, then use one during the speaking task.'
      }
    });
  }
  // Between-session speaking challenge on the Review slide.
  const last = slides[slides.length - 1];
  if (last && last.layout === 'checklist') {
    last.data = last.data || {};
    last.data.challengeTitle = 'Speaking challenge before the next session';
    last.data.challenge = rec.challenge.slice();
  }
  return content;
}

function speakingValidateBank(bank, rec) {
  if (!bank || !Array.isArray(bank.items)) throw new Error('Practice bank has no items.');
  delete bank.reading; delete bank.externalResources;
  const items = bank.items.filter(i => i && i.term);
  if (items.length !== rec.expressions.length) throw new Error(`Practice bank has ${items.length} items for ${rec.expressions.length} phrases.`);
  const L = bank.listening;
  if (!L || !L.audio || !L.audio.internalScript || !Array.isArray(L.questions) || !L.questions.length) throw new Error('Listening card is missing or incomplete.');
  // Audio length is what the TTS service bills on, so a ceiling is enforced (and a floor, so it is never a couple of lines).
  const st = SPEAKING_STEPS[rec.step], nums = (st.listenChars.match(/[\d,]+/g) || []).map(x => Number(x.replace(/,/g, '')));
  const len = String(L.audio.internalScript).length;
  if (nums.length === 2 && (len < nums[0] * 0.5 || len > nums[1] * 1.15)) throw new Error(`Listening script is ${len} characters; the range is ${st.listenChars}.`);
  L.cefrLevel = rec.level;   // the card's level label is the tier name, never a step or a CEFR level
  let leak = null;
  _walkStrings(bank, s => { if (!leak && _LEVEL_LEAK.test(s)) leak = s; });
  if (leak) throw new Error('A level label leaked into the practice bank: "' + leak.slice(0, 60) + '"');
  return bank;
}

/* ─────────── Generate one Speaking session ─────────── */

async function generateSpeakingSession(rec, overwrite) {
  const formData = speakingFormData(rec);

  // Slides: up to two attempts. A demo fallback means the AI call failed — never store that.
  let result = null, lastErr = null;
  for (let attempt = 1; attempt <= 2 && !result; attempt++) {
    const r = await generateSlides(formData);
    if (/demo/i.test(r.engineUsed || '')) throw new Error(r.warning || 'The AI engine did not respond (demo fallback). Nothing was stored.');
    try { speakingProcess(r.content, rec); result = r; }
    catch (e) { lastErr = e; console.warn(`Speaking slides attempt ${attempt} rejected:`, e.message); }
  }
  if (!result) throw lastErr || new Error('Slides did not pass validation.');

  const slides = renderAllSlides(result.content, { tier: formData.tier, l1Support: false, language: '' });

  const plan = {
    meta: {
      title: rec.title, student: formData.studentName, language: '', countryOfResident: '',
      level: rec.level, tier: rec.tier, duration: formData.duration, sessionType: 'speaking',
      renderId: 'SPK', curriculumId: rec.curriculum_id,
      unit: rec.unit, unitTitle: rec.unit_title, unitOutcome: rec.unit_outcome, kind: rec.kind
    },
    formData,
    fingerprint: computeFingerprint(formData),
    content: result.content,
    slides,
    engineUsed: result.engineUsed,
    practiceReady: false,
    practiceGenerating: false
  };

  // Practice bank: up to two attempts; an incomplete bank is never stored.
  let bank = null; lastErr = null;
  for (let attempt = 1; attempt <= 2 && !bank; attempt++) {
    try { bank = speakingValidateBank(await generatePracticeBank(formData, slides), rec); }
    catch (e) { lastErr = e; console.warn(`Speaking practice attempt ${attempt} rejected:`, e.message); }
  }
  if (!bank) throw lastErr || new Error('Practice bank did not pass validation.');
  plan.content.practice_bank = bank;
  plan.practiceReady = true;

  if (overwrite) await dataDeleteCurriculumPlan(rec.curriculum_id);
  // Listening audio is NOT generated here: it is made the first time the session is
  // used (the existing lazy path in step3.js / practice-tts) and then reused.
  return dataCreateCurriculumPlan({
    tutor_id: null, is_curriculum: true, curriculum_id: rec.curriculum_id,
    title: rec.title, session_type: 'speaking', level: rec.level, duration: formData.duration, plan
  });
}
