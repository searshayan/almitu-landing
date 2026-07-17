/* ═══════════════════════════════════════════════════════
   Almitu Pro — Demo Engine (rule-based, offline)
   Produces the SAME JSON schema as the API engines so the
   prototype runs end-to-end without a key. Content is
   templated from the tutor's inputs; connect Claude API
   for real generative quality.
   ═══════════════════════════════════════════════════════ */

function demoGenerate(formData) {
  // Unified 6-slide café skeleton for every skill / tier / duration.
  // (Legacy DEMO_GENERATORS / DEMO_GENERATORS_15 below are now unused.)
  const gen = SKELETON_GEN[formData.sessionType] || SKELETON_GEN.vocabulary;
  return gen(formData);
}

/* Two-phase split: slides render immediately for review; practice bank is
   generated later (after launch), so the tutor never waits for it. */
function demoSlides(formData) { return { slides: demoGenerate(formData).slides }; }
function demoPracticeBank(formData) { return demoGenerate(formData).practice_bank; }

/* Short per-level focus tag → makes within-tier levels (e.g. B2/C1/C2) visibly differ. */
const LEVEL_SHORT = {
  'Pre-A1': 'first words', 'A1': 'basic phrases', 'A2': 'simple sentences',
  'B1': 'connected talk', 'B2': 'detailed argument', 'C1': 'fluent nuance', 'C2': 'native-like precision'
};

/* ── shared helpers ── */

function parseVocabList(raw) {
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
}

function demoL1(word, formData) {
  if (!formData.l1Support) return '';
  return `${resolveL1Language(formData.language)} hint — via API`; // real translation comes from the API engines
}

function emojiFor(word) {
  const map = { coffee:'☕', tea:'🍵', juice:'🧃', water:'💧', croissant:'🥐', cake:'🍰', sandwich:'🥪', pizza:'🍕', menu:'📋', bill:'💰', bread:'🍞', milk:'🥛', apple:'🍎', bus:'🚌', train:'🚆', doctor:'🩺', phone:'📞', money:'💶', ticket:'🎫', work:'💼', house:'🏠', school:'🏫' };
  const w = word.toLowerCase();
  for (const k in map) if (w.includes(k)) return map[k];
  return '🔹';
}

function bankFrom(items, n) { return items.slice(0, n || items.length).map(i => i.term); }

function practiceBank(terms, formData, exampleFn) {
  const topic = formData.details.vocabTheme || formData.details.grammarTitle || formData.details.scenarioTitle || 'this session';
  const items = terms.map(t => ({
    term: t,
    meaning: `key word for "${topic}"`,
    l1: demoL1(t, formData),
    example: exampleFn(t),
    explanation: `"${t}" is used when talking about ${topic.toLowerCase()}. Example: ${exampleFn(t)}`,
    l1_explanation: formData.tier === 'foundation'
      ? `[${resolveL1Language(formData.language)} explanation — via API] "${t}" → ${topic.toLowerCase()}`
      : ''
  }));
  return { items, sentences: terms.slice(0, 8).map(exampleFn) };
}

/* ── Auto-fill (rule-based, tier-calibrated) ── */

const AUTOFILL_VOCAB = {
  foundation:  { 'café|food|drink|restaurant': 'coffee, tea, water, juice, bread, cake, menu, bill',
                 'doctor|health|body': 'doctor, nurse, head, hand, pain, medicine, appointment, help',
                 'transport|bus|train|travel': 'bus, train, ticket, stop, station, time, seat, door',
                 'shop|market|buy': 'shop, money, price, bag, cheap, open, closed, pay',
                 'work|job': 'job, work, boss, time, break, money, day, help',
                 _default: 'morning, day, home, family, friend, water, food, help' },
  development: { 'café|food|drink|restaurant': 'order, takeaway, receipt, dish, flavour, portion, recommend, charge',
                 'doctor|health|body': 'symptom, prescription, treatment, recover, infection, examine, pharmacy, dosage',
                 'transport|bus|train|travel': 'departure, arrival, delay, platform, connection, timetable, fare, route',
                 'shop|market|buy': 'discount, refund, warranty, compare, bargain, receipt, exchange, queue',
                 'work|job': 'schedule, deadline, colleague, contract, overtime, salary, shift, apply',
                 _default: 'routine, decision, improve, manage, prefer, organise, suggest, experience' },
  proficiency: { 'café|food|drink|restaurant': 'artisanal, palate, ambience, gastronomy, ethically-sourced, decadent, understated, gentrified',
                 'doctor|health|body': 'chronic, holistic, prognosis, underlying, intervention, debilitating, preventative, consultation',
                 'transport|bus|train|travel': 'congestion, infrastructure, commute, accessibility, subsidised, disruption, integrated, sustainability',
                 'shop|market|buy': 'consumerism, markup, transparency, impulse, sustainability, monopoly, provenance, disposable',
                 'work|job': 'remuneration, precarious, autonomy, burnout, meritocracy, redundancy, work-life balance, leverage',
                 _default: 'nuanced, compelling, paradoxical, scrutinise, articulate, ambivalent, intrinsic, discourse' }
};

function autofillVocabList(theme, tier) {
  const dict = AUTOFILL_VOCAB[tier] || AUTOFILL_VOCAB.foundation;
  const t = theme.toLowerCase();
  for (const pattern in dict) {
    if (pattern !== '_default' && new RegExp(pattern).test(t)) return dict[pattern];
  }
  return dict._default;
}

function demoAutofill(meta) {
  const t = meta.title;
  const name = meta.studentName;
  const tier = meta.tier;
  const place = meta.countryOfResident ? ` in ${meta.countryOfResident}` : '';
  const short = Number(meta.duration) === 15;   // tighter scope for micro sessions

  if (meta.sessionType === 'vocabulary') {
    let vocab = autofillVocabList(t, tier);
    if (short) vocab = vocab.split(',').map(w => w.trim()).filter(Boolean).slice(0, 6).join(', ');
    return {
      targetVocab: vocab,
      objective: tier === 'foundation'
        ? `${name} can say and recognise ${short ? 'a few' : 'the'} key ${t.toLowerCase()} words and use them in short fixed phrases.`
        : tier === 'development'
          ? `${name} can use ${t.toLowerCase()} vocabulary in connected sentences and common collocations about real situations.`
          : `${name} can deploy ${t.toLowerCase()} lexis with precise register and connotation in extended discussion.`,
      realWorldContext: tier === 'foundation'
        ? `${name} meets this situation in daily life${place} and needs survival phrases that work immediately.`
        : `Connected to ${name}'s weekly routine${place} — real situations where this vocabulary is actively needed.`,
      personalization: `Adapt examples to ${name}'s daily life${place}; keep references concrete and relevant, never stereotyped.`,
      notes: (short ? 'Micro session: one tight focus, minimal explanation. ' : '') + (tier === 'proficiency' ? 'Push for nuance — challenge near-synonym choices.' : 'Recycle previous session vocabulary where natural.')
    };
  }

  if (meta.sessionType === 'grammar') {
    const structures = [
      [/present perfect/i, 'Subject + have/has + past participle'],
      [/past simple|past tense/i, 'Subject + verb-ed (irregular forms vary)'],
      [/modal|could|would|should/i, 'Subject + modal verb + base form'],
      [/comparative|superlative/i, 'adjective + -er / more + adjective + than'],
      [/conditional/i, 'If + present simple, will + base form'],
      [/passive/i, 'Subject + be + past participle (+ by agent)'],
      [/future|going to/i, 'Subject + be going to + base form']
    ];
    const match = structures.find(([re]) => re.test(t));
    return {
      grammarStructure: match ? match[1] : 'Subject + target structure + complement',
      objective: tier === 'foundation'
        ? `${name} can produce the pattern in 3-4 memorized chunk sentences about daily life.`
        : tier === 'development'
          ? `${name} can form, negate and question the structure accurately in semi-structured speaking.`
          : `${name} can exploit the structure for stylistic effect and explain its nuance against alternatives.`,
      exampleSentences: tier === 'foundation'
        ? 'I have a question. She has a book.'
        : tier === 'development'
          ? 'I have lived here for two years. Have you ever tried this before?'
          : 'Had it not been for the delay, the outcome might have differed entirely.',
      commonErrors: `Typical ${meta.language}-speaker interference: word order transfer and dropped auxiliaries.`,
      notes: 'Correct gently during fluency work; correct precisely during accuracy work.'
    };
  }

  // communication
  const exprByTier = {
    foundation: 'Hello, I need help, How much is it?, Can you repeat, please?, Thank you, Goodbye',
    development: "I'd like to ask about, Could you explain, Is it possible to, I'm afraid that doesn't work for me, Could you suggest an alternative?",
    proficiency: 'I take your point and yet, That rather depends on, With respect I see it differently, Perhaps we could agree on, To draw the threads together'
  };
  const actByTier = { foundation: 'Role-play', development: 'Role-play', proficiency: 'Negotiation' };
  return {
    objective: tier === 'foundation'
      ? `${name} can handle "${t}" using fixed phrases, understanding slow clear speech.`
      : tier === 'development'
        ? `${name} can manage "${t}" including one unexpected complication, keeping the exchange polite.`
        : `${name} can navigate "${t}" with register control, strategic hedging and a persuasive arc.`,
    targetExpressions: exprByTier[tier],
    speakingActivity: actByTier[tier],
    roles: `${name} = themselves; Tutor = the other party in "${t}"`,
    culturalNotes: `Ground the scenario${place || ' in the learner\'s locale'}; flag politeness conventions that differ from ${meta.language}-speaking culture.`,
    notes: (short ? 'Micro session: one production task, protect speaking time. ' : '') + (tier === 'proficiency' ? 'Do not simplify language — authentic pace and pushback.' : 'Keep success rate high; recast rather than interrupt.')
  };
}

function heroSlide(icon, title, goal, canDo, formData, label) {
  const dur = getDuration(formData.duration);
  const badges = [
    `👤 ${formData.studentName}`,
    `🌐 ${formData.language}`,
    `📊 ${formData.level} · ${LEVEL_SHORT[formData.level] || ''}`,
    `⏱️ ${dur.key} min`,
    `${getTier(formData.tier).label} tier`
  ];
  if (formData.countryOfResident) badges.splice(2, 0, `📍 ${formData.countryOfResident}`);
  return { icon, label: label || 'Objective', title, layout: 'hero',
    data: { emoji: icon, heading: title, goal, can_do: canDo, badges } };
}

function reviewSlide(items, footer) {
  return { icon: '✅', label: 'Review', title: 'Review & Homework', layout: 'checklist',
    data: { intro: 'What we covered today:', style: 'check',
      items: items.map(t => ({ text: t, hint: '' })), footer } };
}

/* ── 3 demo generators (each branches by tier → 9 render paths) ── */

const DEMO_GENERATORS = {

  vocabulary(fd) {
    const d = fd.details;
    const terms = parseVocabList(d.targetVocab);
    const theme = d.vocabTheme || 'New words';
    const ex = t => `I would like the ${t}, please.`;
    const slides = [];

    slides.push(heroSlide('🎯', theme, d.objective || `Learn and use ${terms.length} new words`, `I can use new ${theme.toLowerCase()} words`, fd));

    if (fd.tier === 'foundation') {
      slides.push({ icon: '🃏', label: 'New Words', title: `New Words — ${theme}`, layout: 'cards',
        data: { intro: 'Listen, point, and repeat each word.', cols: 3,
          items: terms.map(t => ({ emoji: emojiFor(t), top: t, mid: demoL1(t, fd), bottom: `the ${t}` })) } });
      slides.push({ icon: '🗣️', label: 'Say It', title: 'Listen & Repeat', layout: 'rows',
        data: { intro: 'Say each chunk three times.', rows: terms.slice(0, 6).map(t => ({ main: `"I want the ${t}, please."`, sub: demoL1(t, fd), note: 'Say it slowly, then faster' })) } });
      slides.push({ icon: '🧩', label: 'Word Bank', title: 'Match the Words', layout: 'bankmatch',
        data: { intro: 'Find the right word from the bank.', bank: bankFrom(terms.map(t => ({term:t}))),
          prompts: terms.slice(0, 6).map(t => ({ q: `${emojiFor(t)} This one is the ___`, a: t })) } });
      slides.push({ icon: '🎤', label: 'Speak', title: 'Your Turn — Speak', layout: 'task',
        data: { scenario: d.realWorldContext || `You need these words: ${theme.toLowerCase()}.`,
          steps: [`Point to a picture and say: "This is the ___"`, `Ask your tutor: "I want the ___, please."`, `Answer: "Here is the ___. Thank you!"`],
          tip: 'Use the word bank from the last slide if you need help.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '📖', label: 'In Context', title: 'Read — Words in Context', layout: 'text',
        data: { paragraphs: [`${fd.studentName} thinks about ${theme.toLowerCase()} every day. ${terms.slice(0, Math.ceil(terms.length/2)).map(t => `The **${t}** is part of the routine.`).join(' ')}`,
            `${terms.slice(Math.ceil(terms.length/2)).map(t => `Sometimes a **${t}** makes the day better.`).join(' ')}`],
          source_label: '', note: `Find all ${terms.length} target words in bold.` } });
      slides.push({ icon: '🔍', label: 'Work It Out', title: 'Meaning from Context', layout: 'rows',
        data: { intro: 'No dictionary! Use the text to work out each meaning.',
          rows: terms.slice(0, 6).map(t => ({ main: `What does **${t}** mean here?`, sub: `"…the ${t} is part of the routine…"`, note: '' })) } });
      slides.push({ icon: '🧬', label: 'Collocations', title: 'Collocations & Word Families', layout: 'table',
        data: { intro: '', headers: ['Word', 'Common Collocations', 'Word Family'],
          rows: terms.slice(0, 6).map(t => [t, `a fresh ${t} · order a ${t}`, `${t} (n.)`]) } });
      slides.push({ icon: '✍️', label: 'Guided Writing', title: 'Guided Writing', layout: 'rows',
        data: { intro: 'Finish each sentence about your real life.',
          rows: terms.slice(0, 5).map(t => ({ main: `I usually choose the ${t} when …`, sub: 'finish the sentence about your life', note: '' })) } });
    } else {
      slides.push({ icon: '📰', label: 'Authentic Text', title: 'Authentic Text', layout: 'text',
        data: { paragraphs: [`The neighbourhood has changed beyond recognition. Where a modest ${terms[0] || 'café'} once stood, you now find artisanal everything — each **${terms[1] || 'menu'}** curated to within an inch of its life. Critics dismiss it as gentrified theatre; regulars insist the **${terms[2] || 'coffee'}** alone justifies the prices.`],
          source_label: `Opinion column — "${d.realWorldContext || theme}"`, note: 'Notice the register and the writer\'s stance toward each bolded item.' } });
      slides.push({ icon: '🎭', label: 'Register & Nuance', title: 'Register & Nuance', layout: 'table',
        data: { intro: '', headers: ['Item', 'Register', 'Nuance / Connotation', 'Natural Example'],
          rows: terms.slice(0, 6).map(t => [t, 'neutral', `unmarked; context decides tone`, `The ${t} fell short of expectations.`]) } });
      slides.push({ icon: '🧠', label: 'Critical Analysis', title: 'Critical Analysis', layout: 'checklist',
        data: { intro: 'Defend your reading of the text.', style: 'numbered',
          items: [
            { text: `Why might the writer foreground "${terms[0] || theme}" rather than its alternatives?`, hint: '' },
            { text: 'Where does the register shift, and what effect does that create?', hint: '' },
            { text: `Rewrite one sentence in a more formal register — what is lost?`, hint: '' },
            { text: 'Whose perspective is missing from this account?', hint: '' }
          ], footer: '' } });
      slides.push({ icon: '🚀', label: 'Production', title: 'Extended Production', layout: 'task',
        data: { scenario: d.objective || `Produce a 2-minute spoken response engaging with the text's claims about ${theme.toLowerCase()}.`,
          steps: ['Take a clear stance toward the writer\'s position', `Deploy at least five target items with precision: ${terms.slice(0,5).join(', ')}`, 'Anticipate and rebut one counter-argument', 'Close with a register-appropriate flourish'],
          tip: '', criteria: ['Lexical precision over quantity', 'Consistent register', 'Clear argumentative arc'] } });
    }

    slides.push(fd.tier === 'proficiency'
      ? { icon: '🪞', label: 'Self-Assessment', title: 'Self-Assessment', layout: 'checklist',
          data: { intro: 'Rate yourself honestly.', style: 'check',
            items: [
              { text: `I can use ${theme.toLowerCase()} lexis with precise connotation`, hint: '' },
              { text: 'I can shift register deliberately', hint: '' },
              { text: 'I can justify lexical choices under challenge', hint: '' }
            ], footer: `Reflection: which item from today will you deploy in real conversation this week — and where?` } }
      : reviewSlide(terms.slice(0, 6).map(t => `New word: ${t}`),
          fd.tier === 'foundation' ? `Say the ${Math.min(terms.length,6)} new words out loud at home. Point at real things and name them in English!`
          : `Write 3 sentences using new collocations from today (e.g. "order a ${terms[0] || 'coffee'}").`));

    return { slides, practice_bank: practiceBank(terms, fd, ex) };
  },

  grammar(fd) {
    const d = fd.details;
    const title = d.grammarTitle || 'Grammar focus';
    const structure = d.grammarStructure || 'Pattern';
    const userExamples = String(d.exampleSentences || '').split(/[.\n]/).map(s => s.trim()).filter(Boolean).map(s => s + '.');
    const baseEx = userExamples.length ? userExamples : [`This is how we use it.`, `The pattern helps us speak clearly.`];
    const terms = [structure].concat(userExamples.slice(0, 5));
    const ex = t => baseEx[0] || `We practice: ${t}.`;
    const slides = [];

    slides.push(heroSlide('🎯', title, d.objective || `Use the pattern: ${structure}`, `I can use ${title.toLowerCase()}`, fd));

    if (fd.tier === 'foundation') {
      slides.push({ icon: '🧱', label: 'The Pattern', title: 'The Pattern — Learn It as Chunks', layout: 'cards',
        data: { intro: structure, cols: 2,
          items: baseEx.slice(0, 4).map(e => ({ emoji: '🧱', top: e, mid: fd.l1Support ? `${fd.language}: ◌` : '', bottom: 'say it as one piece' })) } });
      slides.push({ icon: '👀', label: 'Spot It', title: 'Correct or Not?', layout: 'compare',
        data: { intro: 'Which one sounds right?', pairs: [
          { good: baseEx[0] || 'I have a book.', bad: (d.commonErrors || 'Common error here.'), note: 'Remember the pattern: ' + structure },
          { good: baseEx[1] || baseEx[0] || 'She has a pen.', bad: 'Pattern broken here.', note: 'Keep the word order' }
        ] } });
      slides.push({ icon: '🧩', label: 'Practice', title: 'Complete the Sentences', layout: 'bankmatch',
        data: { intro: 'Use the bank to complete each one.', bank: structure.split(/[+/]/).map(s => s.trim()).filter(Boolean),
          prompts: baseEx.slice(0, 4).map(e => ({ q: e.replace(/\b(\w{3,})\b/, '___'), a: '' })) } });
      slides.push({ icon: '🎤', label: 'Speak', title: 'Say It About You', layout: 'task',
        data: { scenario: 'Use the pattern to talk about yourself.', steps: [`Say: "${baseEx[0] || structure}" — then change one word`, 'Make it about your family', 'Make it about your day'], tip: 'Small changes — keep the pattern the same.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '📖', label: 'In Context', title: 'The Structure in Context', layout: 'text',
        data: { paragraphs: [`Read about ${fd.studentName}'s week. ${baseEx.slice(0, 3).map(e => `**${e}**`).join(' ')} Notice when and why the structure appears.`],
          source_label: '', note: `Target structure: ${structure}` } });
      slides.push({ icon: '🔬', label: 'Find the Rule', title: 'Find the Rule Together', layout: 'table',
        data: { intro: 'Complete this with your tutor — what is the form, and when do we use it?', headers: ['Form', 'Use', 'Example from the text'],
          rows: [[structure, d.objective || 'When we talk about this situation', baseEx[0] || '—'], ['Negative form?', 'When it is not true', '…'], ['Question form?', 'To ask someone', '…']] } });
      slides.push({ icon: '🔁', label: 'Transform', title: 'Transform the Sentences', layout: 'rows',
        data: { intro: 'No word bank — change each sentence as instructed.',
          rows: baseEx.slice(0, 4).map((e, i) => ({ main: e, sub: ['Make it negative', 'Make it a question', 'Change the subject to "they"', 'Put it in the past'][i % 4], note: '' })) } });
      slides.push({ icon: '✍️', label: 'Your Sentences', title: 'Your Sentences', layout: 'rows',
        data: { intro: 'Finish each starter truthfully — use the structure.',
          rows: ['This year, I …', 'My family …', 'In my country, people …', 'Next week, I …'].map(s => ({ main: s, sub: `use: ${structure}`, note: '' })) } });
    } else {
      slides.push({ icon: '📰', label: 'Authentic Use', title: 'The Structure Doing Real Work', layout: 'text',
        data: { paragraphs: [`Consider how skilled writers exploit ${title.toLowerCase()}. ${baseEx.slice(0, 2).map(e => `**${e}**`).join(' ')} The choice is rhetorical, not merely grammatical: it positions the reader, manages emphasis, and signals register.`],
          source_label: `Style guide commentary — ${title}`, note: 'Ask: what would be LOST if each bolded instance were rewritten without the structure?' } });
      slides.push({ icon: '⚖️', label: 'Nuance', title: 'Nuance & Alternatives', layout: 'table',
        data: { intro: '', headers: ['Version A', 'Version B', 'What Changes'],
          rows: [[baseEx[0] || structure, 'A simpler paraphrase', 'Emphasis and register shift'], ['Formal variant', 'Conversational variant', 'Distance vs. intimacy'], ['With the structure', 'Without it', 'Information packaging']] } });
      slides.push({ icon: '🧠', label: 'Critical Tasks', title: 'Critical Tasks', layout: 'checklist',
        data: { intro: 'No answers provided — argue your position.', style: 'numbered',
          items: [
            { text: `Reformulate: "${(d.commonErrors || 'a weak sentence')}" — improve it using ${structure}`, hint: '' },
            { text: 'When would using this structure be the WRONG choice? Construct the case.', hint: '' },
            { text: 'Identify the most sophisticated use in the text and justify your selection.', hint: '' }
          ], footer: '' } });
      slides.push({ icon: '🚀', label: 'Production', title: 'Extended Production', layout: 'task',
        data: { scenario: d.objective || `Produce an extended piece where ${title.toLowerCase()} carries genuine stylistic weight.`,
          steps: ['Draft 5-7 sentences on a topic of your choice', 'Deploy the structure at least three times, each with different effect', 'Read aloud; defend each usage'],
          tip: '', criteria: ['Accuracy under pressure', 'Range of contexts', 'Stylistic intentionality'] } });
    }

    slides.push(fd.tier === 'proficiency'
      ? { icon: '🪞', label: 'Self-Assessment', title: 'Self-Assessment', layout: 'checklist',
          data: { intro: '', style: 'check', items: [
            { text: `I control ${title.toLowerCase()} in spontaneous speech`, hint: '' },
            { text: 'I can articulate when and why to choose it', hint: '' },
            { text: 'I notice it in authentic input', hint: '' }
          ], footer: 'Reflection: record yourself using the structure tomorrow — where did it feel natural?' } }
      : reviewSlide([`Pattern: ${structure}`, ...(baseEx.slice(0, 2).map(e => `Example: ${e}`))],
          fd.tier === 'foundation' ? 'Say your three pattern sentences out loud tonight. Same pattern, your words!'
          : `Write 5 sentences with ${structure} about your week. Bring them next session.`));

    return { slides, practice_bank: practiceBank(baseEx.slice(0, 6).length ? baseEx.slice(0, 6) : [structure], fd, ex) };
  },

  communication(fd) {
    const d = fd.details;
    const title = d.scenarioTitle || 'Real-life conversation';
    const exprs = parseVocabList(d.targetExpressions);
    const activity = d.speakingActivity || 'Role-play';
    const ex = t => `${t} — try it in the role-play.`;
    const slides = [];

    slides.push(heroSlide('🎯', title, d.objective || `Handle this situation: ${title}`, `I can ${(d.objective || title).toLowerCase().slice(0, 60)}`, fd));

    if (fd.tier === 'foundation') {
      slides.push({ icon: '🃏', label: 'Key Phrases', title: 'Key Phrases', layout: 'cards',
        data: { intro: 'Learn these as whole pieces.', cols: 2,
          items: exprs.slice(0, 6).map(e => ({ emoji: '💬', top: `"${e}"`, mid: fd.l1Support ? `${fd.language}: ◌` : '', bottom: 'use it exactly like this' })) } });
      slides.push({ icon: '🎭', label: 'Model Dialogue', title: 'Watch & Listen', layout: 'dialogue',
        data: { setting: title, lines: [
          { speaker: 'Tutor', side: 'left', line: 'Hello! How can I help?' },
          { speaker: fd.studentName, side: 'right', line: exprs[0] || 'Hello, I need help.' },
          { speaker: 'Tutor', side: 'left', line: 'Of course. One moment.' },
          { speaker: fd.studentName, side: 'right', line: exprs[1] || 'Thank you.' },
          { speaker: 'Tutor', side: 'left', line: 'Here you are!' },
          { speaker: fd.studentName, side: 'right', line: exprs[2] || 'Thank you. Goodbye!' }
        ] } });
      slides.push({ icon: '🔁', label: 'Drill', title: 'Quick Practice', layout: 'bankmatch',
        data: { intro: 'Which phrase fits each moment? Use the bank.', bank: exprs.slice(0, 6),
          prompts: [
            { q: 'You start the conversation → ___', a: exprs[0] || '' },
            { q: 'You ask for what you need → ___', a: exprs[1] || '' },
            { q: 'You say thank you and finish → ___', a: exprs[2] || '' }
          ] } });
      slides.push({ icon: '🎬', label: 'Role-Play', title: `${activity} — With Full Support`, layout: 'task',
        data: { scenario: `${title}. ${d.roles || `You are yourself; your tutor plays the other person.`}`,
          steps: ['Start: use phrase 1 from your cards', 'Middle: ask using phrase 2 — your tutor will answer slowly', 'End: thank them with phrase 3'],
          tip: 'The phrases are on slide 2 — your tutor will point if you need them.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '🗺️', label: 'The Situation', title: 'The Situation', layout: 'text',
        data: { paragraphs: [`${title}. ${d.culturalNotes ? d.culturalNotes + ' ' : ''}${d.objective || ''} You will need to manage the conversation politely and deal with at least one surprise.`],
          source_label: '', note: `Listen for these in the model: ${exprs.slice(0, 4).join(' · ')}` } });
      slides.push({ icon: '🎭', label: 'Model Dialogue', title: 'Model Dialogue — With a Complication', layout: 'dialogue',
        data: { setting: title, lines: [
          { speaker: 'Other person', side: 'left', line: 'Good morning, how can I help you?' },
          { speaker: fd.studentName, side: 'right', line: exprs[0] || 'Good morning, I have a question.' },
          { speaker: 'Other person', side: 'left', line: 'I see — unfortunately that is not possible today.' },
          { speaker: fd.studentName, side: 'right', line: exprs[1] || 'Oh. Could you suggest an alternative?' },
          { speaker: 'Other person', side: 'left', line: 'We could offer you Thursday instead.' },
          { speaker: fd.studentName, side: 'right', line: exprs[2] || 'Thursday works. Thank you for your help.' }
        ] } });
      slides.push({ icon: '🧰', label: 'Language Toolkit', title: 'Language Toolkit', layout: 'table',
        data: { intro: 'Your expressions grouped by what they DO.', headers: ['Function', 'Expressions'],
          rows: [['Opening / asking', exprs.slice(0, 2).join(' · ') || '—'], ['Handling problems', exprs.slice(2, 4).join(' · ') || 'Could you suggest an alternative?'], ['Closing politely', exprs.slice(4, 6).join(' · ') || 'Thank you for your help.']] } });
      slides.push({ icon: '🎬', label: 'Role-Play', title: `${activity} — With a Twist`, layout: 'task',
        data: { scenario: `${title}. ${d.roles || 'Your tutor plays the other role.'} TWIST: your first request will be refused — negotiate an alternative.`,
          steps: ['Open the conversation naturally', 'Make your request', 'Handle the refusal without breaking down the conversation', 'Confirm the outcome and close politely'],
          tip: '', criteria: ['Used at least 4 target expressions', 'Handled the twist', 'Polite register throughout'] } });
    } else {
      slides.push({ icon: '📰', label: 'Stimulus', title: 'Stimulus', layout: 'text',
        data: { paragraphs: [`"${title}" — the situations that test real proficiency are rarely scripted. ${d.objective || ''} ${d.culturalNotes || ''} Today's stimulus places you in exactly such a situation: the stakes are real, the other party has their own agenda, and register management will decide the outcome.`],
          source_label: `Scenario brief — ${activity}`, note: '' } });
      slides.push({ icon: '🎛️', label: 'Discourse Strategies', title: 'Discourse Strategies', layout: 'table',
        data: { intro: '', headers: ['Situation', 'Strategy', 'Natural Exponent'],
          rows: [
            ['You disagree but need goodwill', 'Concession before counter', exprs[0] || '"I take your point, and yet…"'],
            ['You need time to think', 'Strategic hedging', exprs[1] || '"That rather depends on…"'],
            ['The other side stalls', 'Polite pressure', exprs[2] || '"Perhaps we could agree at least on…"'],
            ['Closing the exchange', 'Synthesis + next step', exprs[3] || '"So, to draw the threads together…"']
          ] } });
      slides.push({ icon: '🧠', label: 'Critical Discussion', title: 'Critical Discussion', layout: 'checklist',
        data: { intro: 'Take a stance and defend it.', style: 'numbered',
          items: [
            { text: 'What does the other party in this scenario actually want — and what will they settle for?', hint: '' },
            { text: 'Which register would be a strategic ERROR here, and why?', hint: '' },
            { text: 'Where is the line between persuasion and manipulation in this situation?', hint: '' },
            { text: `How would this exchange differ in ${fd.language}-speaking culture?`, hint: '' }
          ], footer: '' } });
      slides.push({ icon: '🚀', label: 'Extended Task', title: `Extended ${activity}`, layout: 'task',
        data: { scenario: `${title} — full scale. ${d.roles || 'Your tutor takes the opposing role and will not make it easy.'}`,
          steps: ['2 min: silent preparation — map your position and fallbacks', '6-8 min: the exchange itself, no restarts', '2 min: immediate self-debrief — what shifted and why'],
          tip: '', criteria: ['Register control under pressure', 'Discourse management (turns, repairs, transitions)', 'Persuasive architecture', 'Lexical precision'] } });
    }

    slides.push(fd.tier === 'proficiency'
      ? { icon: '🪞', label: 'Self & Peer Review', title: 'Self & Peer Review', layout: 'checklist',
          data: { intro: '', style: 'check', items: [
            { text: 'I held my register even when challenged', hint: '' },
            { text: 'I repaired breakdowns without losing momentum', hint: '' },
            { text: 'My strongest move was deliberate, not lucky', hint: '' }
          ], footer: 'Ask your tutor: "Which single moment would you have played differently — and how?"' } }
      : reviewSlide(exprs.slice(0, 5).map(e => `Phrase: "${e}"`),
          fd.tier === 'foundation' ? 'Practice the dialogue from slide 3 out loud twice before next session.'
          : `Real-world mission: find one chance this week to use "${exprs[0] || 'a target phrase'}" in real life. Report back!`));

    return { slides, practice_bank: practiceBank(exprs.length ? exprs : [title], fd, ex) };
  }
};

/* ── 15-MINUTE demo generators (distinct 5-beat micro architecture) ──
   Launch → Teach (one move) → Retrieve/Shape → Produce (one task) → Feedback. */
const DEMO_GENERATORS_15 = {

  vocabulary(fd) {
    const d = fd.details;
    const terms = parseVocabList(d.targetVocab).slice(0, 8);
    const theme = d.vocabTheme || 'New words';
    const ex = t => `I would like the ${t}, please.`;
    const slides = [];
    slides.push(heroSlide('🚀', theme, d.objective || `Use ${terms.length} words for ${theme.toLowerCase()} — one focus.`, `I can use ${theme.toLowerCase()} words`, fd, 'Launch'));
    if (fd.tier === 'foundation') {
      slides.push({ icon: '🃏', label: 'Teach', title: `Key Words — ${theme}`, layout: 'cards',
        data: { intro: 'Listen and repeat each word once.', cols: 3, items: terms.map(t => ({ emoji: emojiFor(t), top: t, mid: demoL1(t, fd), bottom: `the ${t}` })) } });
      slides.push({ icon: '🧩', label: 'Retrieve', title: 'Quick Match', layout: 'bankmatch',
        data: { intro: 'Point to the right word.', bank: bankFrom(terms.map(t => ({ term: t })), 6), prompts: terms.slice(0, 5).map(t => ({ q: `${emojiFor(t)} This is the ___`, a: t })) } });
      slides.push({ icon: '🎤', label: 'Produce', title: 'Say It', layout: 'task',
        data: { scenario: d.realWorldContext || `Use these ${theme.toLowerCase()} words now.`, steps: [`Ask: "Could I have the ___, please?"`, `Answer: "Here is the ___."`, `Say: "Thank you!"`], tip: 'Use the word bank if you need it.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '📖', label: 'Teach', title: 'Words in Context', layout: 'text',
        data: { paragraphs: [`${terms.slice(0, 6).map(t => `the **${t}**`).join(', ')} — all part of ${theme.toLowerCase()} in a normal day.`], source_label: '', note: 'Work out each bold word from context.' } });
      slides.push({ icon: '🔍', label: 'Shape', title: 'Meaning from Context', layout: 'rows',
        data: { intro: 'No dictionary — use the text.', rows: terms.slice(0, 5).map(t => ({ main: `What does **${t}** mean here?`, sub: '', note: '' })) } });
      slides.push({ icon: '✍️', label: 'Produce', title: 'Your Sentences', layout: 'rows',
        data: { intro: 'Finish about your life.', rows: terms.slice(0, 3).map(t => ({ main: `I use "${t}" when …`, sub: 'complete the sentence', note: '' })) } });
    } else {
      slides.push({ icon: '📰', label: 'Teach', title: 'Authentic Snippet', layout: 'text',
        data: { paragraphs: [`Each **${terms[0] || 'term'}** and **${terms[1] || 'phrase'}** is chosen for effect here — register does the work, not just meaning.`], source_label: `Short extract — ${theme}`, note: 'Notice connotation.' } });
      slides.push({ icon: '🎭', label: 'Shape', title: 'Register & Nuance', layout: 'table',
        data: { intro: '', headers: ['Item', 'Register', 'Nuance'], rows: terms.slice(0, 5).map(t => [t, 'neutral', 'context decides tone']) } });
      slides.push({ icon: '🚀', label: 'Produce', title: '2-Minute Response', layout: 'task',
        data: { scenario: d.objective || `Give a 2-minute spoken take using ${terms.slice(0, 4).join(', ')}.`, steps: ['State your stance', 'Use ≥3 target items precisely', 'Close with a nuanced point'], tip: '', criteria: ['Precision over quantity', 'Consistent register'] } });
    }
    slides.push({ icon: '✅', label: 'Feedback', title: 'One-Point Feedback', layout: 'checklist',
      data: { intro: 'Quick check before we finish:', style: 'check',
        items: [{ text: `You used ${Math.min(terms.length, 5)} target words`, hint: '' }, { text: 'One thing to sharpen next time', hint: 'tutor names a single focus' }],
        footer: fd.tier === 'foundation' ? 'Homework: say the words aloud once tonight.' : 'Homework: write 2 sentences with today\'s words.' } });
    return { slides, practice_bank: practiceBank(terms, fd, ex) };
  },

  grammar(fd) {
    const d = fd.details;
    const title = d.grammarTitle || 'Grammar focus';
    const structure = d.grammarStructure || 'target structure';
    const userEx = String(d.exampleSentences || '').split(/[.\n]/).map(s => s.trim()).filter(Boolean).map(s => s + '.');
    const base = userEx.length ? userEx : ['I have a question.', 'She has a book.'];
    const ex = t => base[0] || `We use: ${t}.`;
    const slides = [];
    slides.push(heroSlide('🚀', title, d.objective || `Use ${structure} — one teaching move.`, `I can use ${title.toLowerCase()}`, fd, 'Launch'));
    if (fd.tier === 'foundation') {
      slides.push({ icon: '🧱', label: 'Teach', title: 'The Pattern', layout: 'cards',
        data: { intro: structure, cols: 2, items: base.slice(0, 3).map(e => ({ emoji: '🧱', top: e, mid: fd.l1Support ? demoL1(e, fd) : '', bottom: 'say as one piece' })) } });
      slides.push({ icon: '🧩', label: 'Retrieve', title: 'Complete It', layout: 'bankmatch',
        data: { intro: 'Use the bank.', bank: structure.split(/[+/]/).map(s => s.trim()).filter(Boolean), prompts: base.slice(0, 4).map(e => ({ q: e.replace(/\b(\w{3,})\b/, '___'), a: '' })) } });
      slides.push({ icon: '🎤', label: 'Produce', title: 'Say It About You', layout: 'task',
        data: { scenario: 'Use the pattern about yourself.', steps: [`Say: "${base[0]}"`, 'Change one word', 'Make it about your family'], tip: 'Keep the pattern the same.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '📖', label: 'Teach', title: 'In Context', layout: 'text',
        data: { paragraphs: [`${base.slice(0, 3).map(e => `**${e}**`).join(' ')} Notice when we use ${structure}.`], source_label: '', note: `Target: ${structure}` } });
      slides.push({ icon: '🔁', label: 'Shape', title: 'Transform', layout: 'rows',
        data: { intro: 'No bank — change each one.', rows: base.slice(0, 4).map((e, i) => ({ main: e, sub: ['make it negative', 'a question', 'about the past', 'about "they"'][i % 4], note: '' })) } });
      slides.push({ icon: '✍️', label: 'Produce', title: 'Your Sentences', layout: 'rows',
        data: { intro: 'True sentences with the structure.', rows: ['This week I …', 'My family …', 'Next month I …'].map(sN => ({ main: sN, sub: `use: ${structure}`, note: '' })) } });
    } else {
      slides.push({ icon: '📰', label: 'Teach', title: 'Authentic Use', layout: 'text',
        data: { paragraphs: [`${base.slice(0, 2).map(e => `**${e}**`).join(' ')} Here the structure is a stylistic choice, not just grammar.`], source_label: `Style note — ${title}`, note: 'What is lost without it?' } });
      slides.push({ icon: '⚖️', label: 'Shape', title: 'Nuance', layout: 'table',
        data: { intro: '', headers: ['Version A', 'Version B', 'What Changes'], rows: [[base[0] || structure, 'a plainer paraphrase', 'emphasis & register'], ['formal variant', 'casual variant', 'distance & tone']] } });
      slides.push({ icon: '🚀', label: 'Produce', title: 'Extended Use', layout: 'task',
        data: { scenario: d.objective || `Speak for 2 minutes using ${structure} at least three times.`, steps: ['Pick a topic', 'Deploy the structure 3× with different effect', 'Justify one choice'], tip: '', criteria: ['Accuracy under pressure', 'Stylistic intent'] } });
    }
    slides.push({ icon: '✅', label: 'Feedback', title: 'One-Point Feedback', layout: 'checklist',
      data: { intro: 'Quick check:', style: 'check', items: [{ text: `You produced ${structure}`, hint: '' }, { text: 'One fix for next time', hint: '' }],
        footer: fd.tier === 'foundation' ? 'Homework: say 2 pattern sentences tonight.' : 'Homework: write 3 sentences using the structure.' } });
    return { slides, practice_bank: practiceBank(base.slice(0, 6), fd, ex) };
  },

  communication(fd) {
    const d = fd.details;
    const title = d.scenarioTitle || 'Real conversation';
    const exprs = parseVocabList(d.targetExpressions);
    const activity = d.speakingActivity || 'Role-play';
    const ex = t => `${t} — use it in the role-play.`;
    const slides = [];
    slides.push(heroSlide('🚀', title, d.objective || `Handle "${title}" — one production task.`, `I can handle ${title.toLowerCase()}`, fd, 'Launch'));
    if (fd.tier === 'foundation') {
      slides.push({ icon: '🃏', label: 'Teach', title: 'Key Phrases', layout: 'cards',
        data: { intro: 'Learn as whole pieces.', cols: 2, items: exprs.slice(0, 4).map(e => ({ emoji: '💬', top: `"${e}"`, mid: fd.l1Support ? demoL1(e, fd) : '', bottom: 'use exactly' })) } });
      slides.push({ icon: '🎭', label: 'Model', title: 'Short Model', layout: 'dialogue',
        data: { setting: title, lines: [
          { speaker: 'Tutor', side: 'left', line: 'Hello! How can I help?' },
          { speaker: fd.studentName, side: 'right', line: exprs[0] || 'Hello, I need help.' },
          { speaker: 'Tutor', side: 'left', line: 'Of course. Here you are.' },
          { speaker: fd.studentName, side: 'right', line: exprs[1] || 'Thank you. Goodbye!' }
        ] } });
      slides.push({ icon: '🎬', label: 'Produce', title: `${activity}`, layout: 'task',
        data: { scenario: `${title}. ${d.roles || 'Tutor plays the other person.'}`, steps: ['Start with phrase 1', 'Ask with phrase 2', 'Thank and finish'], tip: 'Phrases are on slide 2.', criteria: [] } });
    } else if (fd.tier === 'development') {
      slides.push({ icon: '🗺️', label: 'Teach', title: 'The Situation', layout: 'text',
        data: { paragraphs: [`${title}. ${d.objective || ''} Deal with one surprise politely.`], source_label: '', note: `Use: ${exprs.slice(0, 4).join(' · ')}` } });
      slides.push({ icon: '🎭', label: 'Model', title: 'Model — With a Twist', layout: 'dialogue',
        data: { setting: title, lines: [
          { speaker: 'Other', side: 'left', line: 'How can I help you?' },
          { speaker: fd.studentName, side: 'right', line: exprs[0] || 'I have a question.' },
          { speaker: 'Other', side: 'left', line: 'Sorry, that is not possible today.' },
          { speaker: fd.studentName, side: 'right', line: exprs[1] || 'Could you suggest an alternative?' }
        ] } });
      slides.push({ icon: '🎬', label: 'Produce', title: `${activity} — Twist`, layout: 'task',
        data: { scenario: `${title}. Your first request is refused — negotiate an alternative.`, steps: ['Open naturally', 'Make your request', 'Handle the refusal', 'Confirm & close'], tip: '', criteria: ['Used ≥3 expressions', 'Handled the twist'] } });
    } else {
      slides.push({ icon: '📰', label: 'Teach', title: 'Stimulus', layout: 'text',
        data: { paragraphs: [`"${title}" — real stakes and an opposing agenda. ${d.objective || ''} Register will decide the outcome.`], source_label: `Brief — ${activity}`, note: '' } });
      slides.push({ icon: '🎛️', label: 'Shape', title: 'Discourse Moves', layout: 'table',
        data: { intro: '', headers: ['Situation', 'Strategy', 'Exponent'], rows: [
          ['Disagree, keep goodwill', 'Concede then counter', exprs[0] || '"I take your point, and yet…"'],
          ['Need thinking time', 'Hedge', exprs[1] || '"That rather depends…"'],
          ['They stall', 'Polite pressure', exprs[2] || '"Perhaps we could agree on…"']
        ] } });
      slides.push({ icon: '🚀', label: 'Produce', title: `Extended ${activity}`, layout: 'task',
        data: { scenario: `${title} — full scale. Your tutor opposes you and won't make it easy.`, steps: ['1 min prep', '5-6 min exchange, no restarts', '30s self-debrief'], tip: '', criteria: ['Register control', 'Discourse management', 'Persuasive arc'] } });
    }
    slides.push({ icon: '✅', label: 'Feedback', title: 'One-Point Feedback', layout: 'checklist',
      data: { intro: 'Quick check:', style: 'check', items: [{ text: `You used ${Math.min(exprs.length, 4)} target phrases`, hint: '' }, { text: 'One improvement', hint: '' }],
        footer: fd.tier === 'foundation' ? 'Homework: practise the dialogue once at home.' : `Homework: use "${exprs[0] || 'a target phrase'}" in real life this week.` } });
    return { slides, practice_bank: practiceBank(exprs.length ? exprs : [title], fd, ex) };
  }
};

/* ═══════════════════════════════════════════════════════
   UNIFIED SKELETON GENERATORS (active)
   One fixed 6-slide café shell per skill, for EVERY tier and BOTH
   durations. Content depth, scaffolding, L1 lines, phonetics and
   density vary by tier / level / duration / L1 support.
   ═══════════════════════════════════════════════════════ */

const PHONETIC = { coffee: 'KAW-fee', tea: 'tee', water: 'WAW-ter', juice: 'joos', bread: 'bred', cake: 'kayk', menu: 'MEN-yoo', bill: 'bil', milk: 'milk', sugar: 'SHU-gar', please: 'pleez', donut: 'DOH-nut', muffin: 'MUF-in', bagel: 'BAY-gul' };
function phoneticFor(w) { return PHONETIC[String(w).toLowerCase()] || ''; }

function tierFlags(fd) {
  return {
    isFound: fd.tier === 'foundation', isDev: fd.tier === 'development', isProf: fd.tier === 'proficiency',
    l1on: fd.l1Support && fd.tier !== 'proficiency',
    short: Number(fd.duration) === 15,
    place: fd.countryOfResident ? ` in ${fd.countryOfResident}` : ''
  };
}

function vocClue(term, fd) {
  const e = emojiFor(term);
  if (fd.tier === 'foundation') return `${e} What is this? → ___`;
  if (fd.tier === 'development') return `${e} You order or use this — which word? → ___`;
  return `${e} Choose the most precise word here → ___`;
}

function vocReview(fd, items, l1on) {
  const words = items.slice(0, 6).join(', ');
  if (fd.tier === 'foundation') return [{ text: `I know these words: ${words}.`, hint: l1on ? `${resolveL1Language(fd.language)} shown on the cards` : '' }, { text: 'I can say "I want a ___, please."', hint: '' }];
  if (fd.tier === 'development') return [{ text: `I can use: ${words}.`, hint: '' }, { text: 'I can describe a real situation and explain a choice.', hint: '' }];
  return [{ text: 'I can use precise, evaluative language on this topic.', hint: '' }, { text: 'I can compare options and justify my preference.', hint: '' }];
}

function vocSteps(fd, items) {
  const f = tierFlags(fd);
  if (f.isFound) { const s = ['Say hello to the server.', `Order: "I want a ${items[0] || 'coffee'}, please."`, 'Ask: "How much is it?"', 'Say "Thank you."']; return f.short ? s.slice(0, 3) : s; }
  if (f.isDev) { const s = ['Greet and start the conversation.', `Order using two items: ${items.slice(0, 2).join(', ')}.`, 'Explain one choice ("… because …").', 'Ask the price and confirm.', 'Close politely.']; return f.short ? s.slice(0, 4) : s; }
  const s = ['Open and set your goal.', `Use precise lexis (${items.slice(0, 3).join(', ')}) to make your case.`, 'Give one reason and respond to a counter-point.', 'Summarize and close.']; return f.short ? s.slice(0, 3) : s;
}

function vocCriteria(fd) {
  if (fd.tier === 'foundation') return ['Say "I want a ___, please." at least once.', 'Ask "How much is it?"'];
  if (fd.tier === 'development') return ['Explain one choice with "because".', 'Ask the price and confirm your order.'];
  return ['Present one reason.', 'Respond to one counter-argument.', 'Summarize your position.'];
}

function vocHomework(fd, theme) {
  if (fd.tier === 'foundation') return 'At home, point to real objects and say the English word. Then order one item: "I want a ___, please."';
  if (fd.tier === 'development') return `Write or record a short 3-4 sentence message about ${theme.toLowerCase()} using today's words.`;
  return `Prepare a 1-minute spoken opinion comparing two options related to ${theme.toLowerCase()}, ready for next session.`;
}

const SKELETON_GEN = {

  vocabulary(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const theme = d.vocabTheme || 'New words';
    let terms = parseVocabList(d.targetVocab);
    terms = terms.slice(0, f.short ? 8 : (f.isProf ? 8 : 12));
    const ex = t => f.isFound ? `I want a ${t}.` : f.isDev ? `I ordered a ${t} yesterday.` : `The ${t} was worth every cent.`;
    const goal = f.isFound ? `Learn ${theme.toLowerCase()} words and ask for what you want.`
      : f.isDev ? `Use ${theme.toLowerCase()} words to talk about a real situation and make choices.`
        : `Use precise ${theme.toLowerCase()} lexis to discuss and evaluate a real issue.`;
    const slides = [
      heroSlide('🎯', theme, goal, `I can name ${theme.toLowerCase()} items and say what I want.`, fd, 'Objective'),
      { icon: '🃏', label: 'New Words', title: `New Words — ${theme}`, layout: 'cards',
        data: { intro: f.short ? 'A small set to master today.' : 'One clear meaning each.', cols: 3,
          items: terms.map(t => ({ emoji: emojiFor(t), top: t, mid: f.l1on ? demoL1(t, fd) : '', bottom: ex(t) })) } },
      { icon: '🗣️', label: 'Listen & Repeat', title: 'Listen & Repeat', layout: 'rows',
        data: { intro: 'Say each line. Slow, then natural.',
          rows: terms.slice(0, f.short ? 4 : 6).map(t => ({
            main: f.isFound ? `I want a ${t}, please.` : f.isDev ? `First a ${t}, then something else.` : `I'd rather have the ${t}, honestly.`,
            sub: f.l1on ? demoL1(t, fd) : '', note: f.isFound ? phoneticFor(t) : '' })) } },
      { icon: '🧩', label: 'Word Bank', title: 'Word Bank', layout: 'bankmatch',
        data: { intro: 'Choose the right word from the bank.', bank: terms,
          prompts: terms.slice(0, f.short ? 5 : 7).map(t => ({ q: vocClue(t, fd), a: t })) } },
      { icon: '🎤', label: 'Scenario / Speak', title: `Speak — ${theme}`, layout: 'task',
        data: { scenario: (d.realWorldContext || `You are ordering ${theme.toLowerCase()}${f.place}.`).trim(),
          steps: vocSteps(fd, terms), tip: 'Use the Word Bank from Slide 4.', criteria: vocCriteria(fd) } },
      { icon: '✅', label: 'Review & Homework', title: 'Review & Homework', layout: 'checklist',
        data: { intro: 'What you can do now:', style: 'check', items: vocReview(fd, terms, f.l1on), footer: vocHomework(fd, theme) } }
    ];
    return { slides, practice_bank: practiceBank(terms, fd, ex) };
  },

  grammar(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const title = d.grammarTitle || 'Grammar focus';
    const structure = d.grammarStructure || 'target structure';
    const userEx = String(d.exampleSentences || '').split(/[.\n]/).map(s => s.trim()).filter(Boolean).map(s => s + '.');
    const base = userEx.length ? userEx : (f.isFound ? ['I have a book.', 'She has a pen.'] : f.isDev ? ['I have lived here for two years.', 'Have you ever tried this?'] : ['Had it not been for the delay, we would have arrived on time.']);
    const ex = t => base[0] || `We use ${structure}.`;
    const goal = f.isFound ? 'Use the pattern in a few short sentences about you.'
      : f.isDev ? `Describe your experiences using ${title.toLowerCase()}.`
        : `Use ${title.toLowerCase()} to argue and qualify a position.`;
    const slides = [
      heroSlide('🎯', title, goal, `I can use ${title.toLowerCase()} in ${f.isFound ? '2-4 short sentences' : f.isDev ? '3-5 connected sentences' : 'extended, precise discourse'}.`, fd, 'Objective'),
      { icon: '📐', label: 'Grammar Focus', title: 'Grammar Focus', layout: 'rows',
        data: { intro: `Pattern: ${structure}`,
          rows: base.slice(0, f.short ? 3 : 5).map((e, i) => ({ main: e, sub: f.l1on ? `${resolveL1Language(fd.language)} gloss — via API` : '', note: i === 0 ? (f.isFound ? 'One fixed pattern — keep it the same.' : 'Notice the form.') : '' })) } },
      { icon: '🔁', label: 'Form Practice', title: 'Form Practice', layout: 'rows',
        data: { intro: 'Repeat, and change one part each time.',
          rows: (f.isFound ? ['I ___ …', 'You ___ …', 'We ___ …'] : ['Positive: …', 'Negative: …', 'Question: …', 'Past: …']).slice(0, f.short ? 3 : 4).map(s => ({ main: `${s}  (${structure})`, sub: '', note: '' })) } },
      { icon: '🧩', label: 'Controlled Practice', title: 'Controlled Practice', layout: 'bankmatch',
        data: { intro: 'Complete each sentence with the correct form.', bank: structure.split(/[+/]/).map(x => x.trim()).filter(Boolean),
          prompts: base.slice(0, f.short ? 4 : 6).map(e => ({ q: e.replace(/\b(\w{3,})\b/, '___'), a: '' })) } },
      { icon: '🎤', label: 'Scenario / Speak', title: 'Scenario / Speak', layout: 'task',
        data: { scenario: (d.objective || `Talk about a real situation${f.place} using ${title.toLowerCase()}.`).trim(),
          steps: (f.isFound ? ['Say one true sentence with the pattern.', 'Change one word and say it again.', 'Say a sentence about your family.']
            : f.isDev ? ['Describe a real experience using the structure.', 'Add one detail or reason.', 'Ask a question with the structure.', 'Respond and extend.']
              : ['State a position.', 'Qualify it with the target structure.', 'Rebut a counter-point.', 'Summarize.']).slice(0, f.short ? 3 : (f.isFound ? 3 : 4)),
          tip: `Use the pattern: ${structure}.`,
          criteria: f.isFound ? ['Say 2 correct sentences with the pattern.'] : f.isDev ? ['Use the structure at least 3 times.', 'Give one reason.'] : ['Use the structure with precision and appropriate register.', 'Sustain an extended turn.'] } },
      { icon: '✅', label: 'Review & Homework', title: 'Review & Homework', layout: 'checklist',
        data: { intro: 'What you can do now:', style: 'check',
          items: f.isFound ? [{ text: `I can use: ${structure}.`, hint: '' }, { text: 'I can make 2-3 short sentences.', hint: '' }]
            : f.isDev ? [{ text: `I can form, negate and question ${title.toLowerCase()}.`, hint: '' }, { text: 'I can describe my experiences.', hint: '' }]
              : [{ text: `I can deploy ${title.toLowerCase()} for stance and nuance.`, hint: '' }, { text: 'I can sustain a precise argument.', hint: '' }],
          footer: f.isFound ? `Homework: say 2 sentences with "${structure}" at home.` : f.isDev ? `Homework: write 5 sentences using ${title.toLowerCase()} about your week.` : `Homework: prepare a short argument that uses ${title.toLowerCase()} at least three times.` } }
    ];
    return { slides, practice_bank: practiceBank(base.slice(0, 6), fd, ex) };
  },

  communication(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const title = d.scenarioTitle || 'Real conversation';
    const exprs = parseVocabList(d.targetExpressions);
    const activity = d.speakingActivity || 'Role-play';
    const items = (exprs.length ? exprs : ['Hello', 'Can I have…?', 'How much is it?', 'Thank you']).slice(0, f.short ? 4 : 8);
    const ex = t => `${t}`;
    const goal = f.isFound ? `Perform one basic exchange${f.place}.`
      : f.isDev ? 'Make and respond to suggestions and reach a decision.'
        : 'Present a position, handle counter-arguments, and conclude.';
    const slides = [
      heroSlide('🎯', title, goal, `I can ${(d.objective || title).toLowerCase().slice(0, 60)}.`, fd, 'Objective'),
      { icon: '💬', label: 'Key Phrases', title: 'Key Phrases', layout: 'cards',
        data: { intro: 'Learn these functional phrases.', cols: 2,
          items: items.map(e => ({ emoji: '💬', top: `"${e}"`, mid: f.l1on ? demoL1(e, fd) : '', bottom: f.isFound ? 'use it exactly' : f.isDev ? 'add a reason' : 'discourse move' })) } },
      { icon: '🗣️', label: 'Practice Lines', title: 'Practice Lines', layout: 'rows',
        data: { intro: 'Repeat each line clearly and politely.',
          rows: items.slice(0, f.short ? 4 : 6).map(e => ({ main: `"${e}"`, sub: f.l1on ? demoL1(e, fd) : '', note: '' })) } },
      { icon: '🧩', label: 'Controlled Practice', title: 'Controlled Practice', layout: 'bankmatch',
        data: { intro: 'Match a phrase to each situation.', bank: items,
          prompts: [
            { q: 'You start the conversation → ___', a: items[0] || '' },
            { q: 'You ask for something → ___', a: items[1] || '' },
            { q: 'You ask the price → ___', a: items[2] || '' },
            { q: 'You finish politely → ___', a: items[3] || '' }
          ].slice(0, f.short ? 3 : 4) } },
      { icon: '🎤', label: 'Scenario / Speak', title: `${activity}`, layout: 'task',
        data: { scenario: `${title}. ${d.roles || 'Your tutor plays the other person.'}${f.place ? ` Set it${f.place}.` : ''}`.trim(),
          steps: (f.isFound ? ['Greet and start.', 'Make your request with a phrase.', 'Thank them and finish.']
            : f.isDev ? ['Open the conversation.', 'Make a suggestion; give a reason.', 'Handle a small problem or refusal.', 'Agree on an outcome and close.']
              : ['State your position.', 'Support it with one strong reason.', 'Respond to a counter-argument.', 'Summarize and conclude.']).slice(0, f.short ? 3 : (f.isFound ? 3 : 4)),
          tip: 'Use the Key Phrases from Slide 2.',
          criteria: f.isFound ? ['Use one phrase correctly.', 'Say "Thank you."'] : f.isDev ? ['Make a suggestion and give a reason.', 'Reach a joint decision.'] : ['Present a reason.', 'Respond to a counter-argument.', 'Summarize your position.'] } },
      { icon: '✅', label: 'Review & Homework', title: 'Review & Homework', layout: 'checklist',
        data: { intro: 'What you can do now:', style: 'check',
          items: items.slice(0, 4).map(e => ({ text: `I can say "${e}".`, hint: '' })),
          footer: f.isFound ? 'Homework: practise the dialogue once at home.' : f.isDev ? 'Homework: use one phrase in a real conversation this week.' : "Homework: prepare a 1-minute argument for next session's debate." } }
    ];
    return { slides, practice_bank: practiceBank(items, fd, ex) };
  }
};
