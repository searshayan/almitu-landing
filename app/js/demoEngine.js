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

/* ── Vocabulary spec helpers (emoji-free; 25-min 6-slide / 15-min 4-slide) ── */
function vCap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
const V_VERBS = ['order','pay','help','book','call','ask','wait','choose','recommend','arrive','depart','compare','apply','manage','organise','organize','suggest','prefer','look forward','check in','sign up'];
const V_ADJS = ['cheap','open','closed','fresh','busy','early','late','decadent','artisanal','chronic','sustainable','nuanced'];
function vPos(t) { const w = String(t).toLowerCase(); if (V_VERBS.includes(w)) return 'verb'; if (V_ADJS.includes(w)) return 'adjective'; if (w.trim().includes(' ')) return 'phrasal verb'; return 'noun'; }
/* Pre-A1/A1 (foundation) → simple phonetic hint; A2-C2 → IPA slot (real IPA comes from the API). */
function vPron(t, isFound) { return isFound ? ('say: ' + (phoneticFor(t) || String(t))) : ('/' + String(t) + '/'); }
function vExample(t, f) {
  if (f.isFound) return `I want the **${t}**.`;
  if (f.isDev) return `I usually choose the **${t}** because it is reliable.`;
  return `On balance, the **${t}** proved the more astute choice.`;
}
function vDef(t, theme, f) {
  if (f.isFound) return `a common ${theme.toLowerCase()} word.`;
  if (f.isDev) return `something linked to ${theme.toLowerCase()} that you use or choose day to day.`;
  return `a ${theme.toLowerCase()} term carrying a specific register and connotation in context.`;
}
function vWords(terms, fd, f) {
  const theme = fd.details.vocabTheme || 'this topic';
  return terms.map(t => ({ word: vCap(t), pron: vPron(t, f.isFound), pos: vPos(t),
    definition: vDef(t, theme, f), example: vExample(t, f), l1: f.l1on ? demoL1(t, fd) : '' }));
}
function vCollocations(terms, n) {
  const v = ['order a', 'choose the', 'ask for a', 'enjoy the', 'prefer the'];
  return terms.slice(0, n).map((t, i) => `${v[i % v.length]} ${t}`);
}
function vDialogueLines(words) {
  return words.map((w, i) => i % 2 === 0
    ? { speaker: 'Student', side: 'right', line: `Could I have the **${w}**, please?` }
    : { speaker: 'Tutor', side: 'left', line: `Of course — here is the **${w}**.` });
}
const V_BLANKS = ['Please pass the ___.', 'I would like the ___.', 'Where is the ___?', 'Can I have a ___?', 'This ___ is very good.', 'We need a ___ today.'];
function vBlankSentences(words) { return words.map((_, i) => V_BLANKS[i % V_BLANKS.length]); }
function vCanDo(fd, theme) {
  if (fd.tier === 'foundation') return [`I can name basic ${theme.toLowerCase()} words.`, 'I can ask for something using a fixed phrase.', 'I can recognise the words when I hear them.'];
  if (fd.tier === 'development') return [`I can use ${theme.toLowerCase()} words in connected sentences.`, 'I can use common collocations correctly.', 'I can explain a choice with a reason.'];
  return [`I can use ${theme.toLowerCase()} lexis with precise connotation.`, 'I can shift register deliberately.', 'I can justify my lexical choices under challenge.'];
}
function vNextStep(fd, theme) {
  const act = fd.tier === 'foundation' ? `match each word to a picture and record yourself saying the ${theme.toLowerCase()} words aloud`
    : fd.tier === 'development' ? `add today's words to your flashcard deck and write three sentences using the new collocations`
      : `complete the register and collocation drill, then write a short paragraph using the target lexis about ${theme.toLowerCase()}`;
  return `Complete your post-session activity on the platform: ${act}. Your tutor tracks your completion time and practice metrics before the next session.`;
}
function vHero(fd, theme, goal, warmup) {
  const dur = getDuration(fd.duration);
  const badges = [fd.level, `${dur.key} min`, `${parseVocabList(fd.details.targetVocab).length} words`];
  return { icon: '', label: 'Objective & Warm-up', title: theme, layout: 'hero',
    data: { heading: theme, goal, warmup, badges, duration_label: `${fd.duration}-Minute Live Micro-Session` } };
}

const SKELETON_GEN = {

  vocabulary(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const theme = d.vocabTheme || 'New words';
    const isPreA1 = fd.level === 'Pre-A1';
    // Use EXACTLY the tutor's target vocabulary — every item, no fixed cap,
    // for BOTH durations (the word list must match the Target Vocabulary field).
    let terms = parseVocabList(d.targetVocab);
    if (!terms.length) terms = ['word'];
    const ex = t => vExample(t, f).replace(/\*\*/g, '');
    const goal = f.isFound ? `Learn ${terms.length} core ${theme.toLowerCase()} words and use them right away.`
      : f.isDev ? `Learn ${terms.length} ${theme.toLowerCase()} words and use them in real, connected sentences.`
        : `Master ${terms.length} precise ${theme.toLowerCase()} items and deploy them with register and nuance.`;
    const warmup = f.isFound ? `Which ${theme.toLowerCase()} words do you already know?`
      : f.isDev ? `When did you last deal with ${theme.toLowerCase()}? What happened?`
        : `What makes some ${theme.toLowerCase()} choices better than others, in your view?`;

    if (f.short) {
      // ── 15-minute · 4 slides ──
      const collN = isPreA1 ? 2 : 3;
      const slides = [
        vHero(fd, theme, goal, warmup),
        { icon: '', label: 'New Words & Collocations', title: `New Words — ${theme}`, layout: 'wordlist',
          data: { intro: 'A tight set to master fast.', words: vWords(terms, fd, f), collocations: vCollocations(terms, collN) } },
        { icon: '', label: 'Integrated Practice', title: `${theme} in Use`, layout: 'integrated',
          data: { instruction: 'Read the dialogue and text aloud with your tutor.',
            dialogue: { setting: (d.realWorldContext || `Talking about ${theme.toLowerCase()}${f.place}.`).trim(),
              lines: vDialogueLines(terms.slice(0, Math.min(4, terms.length))) },
            passage: { paragraphs: [terms.map(t => `You see the **${t}** here.`).join(' ')] },
            notes: `Comprehension: check the student can retell the situation. Pronunciation: focus on "${terms[0] || 'the target words'}".` } },
        { icon: '', label: 'Application & Review', title: 'Application & Review', layout: 'applyreview',
          data: { application: { instruction: 'Complete each sentence using the target words.',
              bank: terms, prompts: vBlankSentences(terms),
              answers: terms.map(t => ({ answer: t, feedback: `Correct — "${t}" fits here.` })),
              notes: 'Elicit a full sentence for each answer; adjust difficulty to the learner.' },
            review: { can_do: vCanDo(fd, theme)[0], next_step: vNextStep(fd, theme) } } }
      ];
      return { slides, practice_bank: practiceBank(terms, fd, ex) };
    }

    // ── 25-minute · 6 slides (all target words recycled across every slide) ──
    const collN = f.isFound ? 3 : 5;
    const passage = f.isFound ? [terms.map(t => `I see the **${t}** every day.`).join(' ')]
      : [terms.slice(0, Math.ceil(terms.length / 2)).map(t => `The **${t}** is part of it.`).join(' '),
         terms.slice(Math.ceil(terms.length / 2)).map(t => `Later, the **${t}** matters too.`).join(' ')];
    const slides = [
      vHero(fd, theme, goal, warmup),
      { icon: '', label: 'New Words', title: `New Words — ${theme}`, layout: 'wordlist',
        data: { intro: 'One clear meaning and example each.', words: vWords(terms, fd, f), collocations: vCollocations(terms, collN) } },
      { icon: '', label: 'Dialogue Practice', title: `Dialogue — ${theme}`, layout: 'dialogue',
        data: { instruction: 'Read the dialogue aloud with your tutor.',
          setting: (d.realWorldContext || `A short exchange about ${theme.toLowerCase()}${f.place}.`).trim(),
          lines: vDialogueLines(terms),
          notes: `Comprehension: ask what each speaker wants and why. Pronunciation: check word stress on "${terms[0] || 'the target words'}".` } },
      { icon: '', label: 'Short Story / Article', title: `Reading — ${theme}`, layout: 'text',
        data: { instruction: 'Read the passage aloud with your tutor.', paragraphs: passage,
          note: 'Read for meaning first, then find each target word in context.' } },
      { icon: '', label: 'Fill in the Blanks & Sentence Building', title: 'Practice', layout: 'practice',
        data: { partA: { instruction: 'Fill in the blanks with the correct words from the Word Bank to complete the sentences.',
            bank: terms, sentences: vBlankSentences(terms),
            answers: terms.map(t => ({ answer: t, feedback: `Correct — "${t}" fits here.` })) },
          partB: { instruction: 'Create sentences using the following words.', words: terms,
            notes: 'Elicit a full sentence for each word; ask a follow-up question to extend it; simplify or stretch the context to match the learner.' } } },
      { icon: '', label: 'Review & Next Step', title: 'Review & Next Step', layout: 'checklist',
        data: { intro: 'Great work today — here is what you can now do:', style: 'check',
          items: vCanDo(fd, theme).map(t => ({ text: t, hint: '' })), footer: vNextStep(fd, theme) } }
    ];
    return { slides, practice_bank: practiceBank(terms, fd, ex) };
  },

  grammar(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const title = d.grammarTitle || 'Grammar focus';
    const structure = d.grammarStructure || 'Subject + target structure + complement';
    const userEx = String(d.exampleSentences || '').split(/(?<=[.!?])\s+|\n/).map(s => s.trim()).filter(Boolean).map(s => /[.!?]$/.test(s) ? s : s + '.');
    // Positive / Negative / Question model sentences (tutor's own if given, else tier fallback).
    const formEx = userEx.length >= 3 ? userEx.slice(0, 3)
      : f.isFound ? ['I have a book.', 'I do not have a pen.', 'Do you have a book?']
        : f.isDev ? ['I have lived here for two years.', 'I have not finished it yet.', 'Have you ever tried this?']
          : ['Seldom have I encountered such resolve.', 'Not once has the outcome varied.', 'Had you weighed the alternative first?'];
    const ex = t => formEx[0];
    const dur = getDuration(fd.duration);
    const goal = f.isFound ? `Use ${title.toLowerCase()} in a few short sentences about you.`
      : f.isDev ? `Form, negate and question ${title.toLowerCase()} to talk about real experiences.`
        : `Deploy ${title.toLowerCase()} with precision, nuance and appropriate register.`;
    const warmup = f.isFound ? 'Can you say one true sentence about yourself right now?'
      : f.isDev ? 'What have you done so far this week?'
        : `Where does ${title.toLowerCase()} shift the emphasis of what you want to say?`;
    const l1note = f.l1on ? `${resolveL1Language(fd.language)} note on this pattern — via API` : '';
    const errNote = String(d.commonErrors || '').trim() || (f.isFound ? 'Keep the pattern fixed — do not change the ending.' : 'Watch the form: this is where learners often slip.');

    const hero = { icon: '', label: 'Objective & Warm-up', title, layout: 'hero',
      data: { heading: title, goal, warmup, badges: [fd.level, `${dur.key} min`, 'Grammar'], duration_label: `${fd.duration}-Minute Live Micro-Session` } };
    const formSlide = { icon: '', label: 'Form & Use', title: `Form & Use — ${title}`, layout: 'form',
      data: { formula: structure,
        forms: [ { label: 'Positive', example: formEx[0] }, { label: 'Negative', example: formEx[1] }, { label: 'Question', example: formEx[2] } ],
        use: f.isFound ? 'you talk about simple, true facts.' : f.isDev ? 'you connect a past action to now, or talk about experience.' : 'you want to foreground stance, emphasis or nuance.',
        examples: formEx.slice(0, 2), l1: l1note, note: errNote } };

    const dialogueLines = (() => {
      const lines = [ { speaker: 'Tutor', side: 'left', line: 'Tell me a little about your week.' },
        { speaker: 'Student', side: 'right', line: `**${formEx[0]}**` },
        { speaker: 'Tutor', side: 'left', line: 'And is there anything you have not done yet?' },
        { speaker: 'Student', side: 'right', line: `**${formEx[1]}**` } ];
      return f.short ? lines.slice(0, 3) : lines;
    })();
    const passage = [ `Here is ${title.toLowerCase()} in everyday use. **${formEx[0]}** We hear sentences like this all the time.`,
      `We can also make it negative or turn it into a question: **${formEx[1]}** **${formEx[2]}**` ];
    const errorPairs = (() => {
      const raw = String(d.commonErrors || '').trim();
      const pairs = [];
      if (raw) pairs.push({ good: 'Use the correct target form.', bad: raw, note: 'A frequent slip — fix the form.' });
      pairs.push({ good: 'I have seen that film.', bad: 'I have saw that film.', note: 'Use the past participle, not the past simple.' });
      pairs.push({ good: 'She has lived here since 2020.', bad: 'She has lived here for 2020.', note: 'Use "since" with a point in time.' });
      return pairs.slice(0, 3);
    })();
    const gapBank = structure.split(/[+/]/).map(x => x.trim()).filter(Boolean);
    const gapSentences = formEx.map(e => e.replace(/\b([A-Za-z]{3,})\b/, '___'));
    const buildPrompts = f.isFound ? ['about you', 'about your family', 'a question']
      : f.isDev ? ['about your weekend', 'about a past experience', 'a question for your tutor', 'a negative sentence']
        : ['to make a concession', 'to emphasise a point', 'to hedge a claim', 'to open an argument'];
    const canDo = f.isFound ? ['I can say a few true sentences with the pattern.', 'I can keep the form correct.', 'I can answer a simple question with it.']
      : f.isDev ? [`I can form, negate and question ${title.toLowerCase()}.`, 'I can describe real experiences with it.', 'I can correct my own common mistake.']
        : [`I can deploy ${title.toLowerCase()} for stance and nuance.`, 'I can shift register deliberately.', 'I can sustain a precise, extended turn.'];
    const nextStep = `Complete your post-session activity on the platform: ${f.isFound ? `say five true sentences using "${structure}" and record them` : f.isDev ? `write five sentences using ${title.toLowerCase()} about your week, including one question` : `write a short paragraph that uses ${title.toLowerCase()} at least three times for deliberate effect`}. Your tutor tracks your completion time and practice metrics before the next session.`;

    if (f.short) {
      // ── 15-minute · 4 slides ──
      const slides = [
        hero,
        formSlide,
        { icon: '', label: 'In Context', title: `${title} in Use`, layout: 'integrated',
          data: { instruction: 'Read the dialogue and text aloud with your tutor.',
            dialogue: { setting: (d.objective || `Talking about real life${f.place}.`).trim(), lines: dialogueLines },
            passage: { paragraphs: [passage[0]] } } },
        { icon: '', label: 'Practice & Review', title: 'Practice & Review', layout: 'applyreview',
          data: { application: { instruction: 'Complete each sentence with the correct form.', bank: f.isFound ? gapBank : undefined, prompts: gapSentences.slice(0, f.isFound ? 2 : 3) },
            review: { can_do: canDo[0], next_step: nextStep } } }
      ];
      return { slides, practice_bank: practiceBank(formEx, fd, ex) };
    }

    // ── 25-minute · 7 slides ──
    const slides = [
      hero,
      formSlide,
      { icon: '', label: 'In Context — Dialogue', title: `Dialogue — ${title}`, layout: 'dialogue',
        data: { instruction: 'Read the dialogue aloud with your tutor.', setting: (d.objective || `A short exchange${f.place}.`).trim(), lines: dialogueLines } },
      { icon: '', label: 'In Context — Passage', title: `Reading — ${title}`, layout: 'text',
        data: { instruction: 'Read the passage aloud with your tutor.', paragraphs: passage, note: '' } },
      { icon: '', label: 'Watch Out — Correct vs Incorrect', title: 'Correct vs Incorrect', layout: 'compare',
        data: { intro: 'Spot the difference, then say the correct version aloud.', pairs: errorPairs } },
      { icon: '', label: 'Practice', title: 'Practice', layout: 'practice',
        data: { partA: { instruction: 'Complete each sentence with the correct form.', bank: gapBank, sentences: gapSentences },
          partB: { instruction: 'Create sentences using the following words.', words: buildPrompts } } },
      { icon: '', label: 'Review & Next Step', title: 'Review & Next Step', layout: 'checklist',
        data: { intro: 'Great work — here is what you can now do:', style: 'check', items: canDo.map(t => ({ text: t, hint: '' })), footer: nextStep } }
    ];
    return { slides, practice_bank: practiceBank(formEx, fd, ex) };
  },

  communication(fd) {
    const d = fd.details; const f = tierFlags(fd);
    const title = d.scenarioTitle || 'Real conversation';
    const activity = d.speakingActivity || 'Role-play';
    const exprs = parseVocabList(d.targetExpressions);
    const cap = f.short ? (fd.level === 'Pre-A1' ? 4 : 6) : 8;
    const items = (exprs.length ? exprs : ['Hello', 'Could I have…?', 'Could you repeat that?', 'How much is it?', "I'd like to…", 'Thank you']).slice(0, cap);
    const ex = t => t;
    const dur = getDuration(fd.duration);
    const goal = f.isFound ? `Handle "${title.toLowerCase()}" using a few fixed phrases.`
      : f.isDev ? `Manage "${title.toLowerCase()}" — make requests, give reasons and handle a complication.`
        : `Navigate "${title.toLowerCase()}" with register control, hedging and a persuasive arc.`;
    const warmup = f.isFound ? 'Have you been in this situation before?'
      : f.isDev ? `When did you last deal with a situation like "${title.toLowerCase()}"? What happened?`
        : `What makes someone effective in "${title.toLowerCase()}"?`;
    const use = f.isFound ? 'use it exactly' : f.isDev ? 'add a reason' : 'a discourse move';

    // Distribute the expressions across communicative functions.
    const funcs = f.isFound ? ['Start', 'Ask', 'Finish']
      : f.isDev ? ['Opening', 'Requesting', 'Responding', 'Closing']
        : ['Opening', 'Making your case', 'Handling pushback', 'Closing'];
    const groups = funcs.map(fn => ({ function: fn, items: [] }));
    items.forEach((it, i) => groups[i % groups.length].items.push({ phrase: `"${it}"`, use, l1: f.l1on ? demoL1(it, fd) : '' }));
    const toolkitGroups = groups.filter(g => g.items.length);

    const hero = { icon: '', label: 'Objective & Warm-up', title, layout: 'hero',
      data: { heading: title, goal, warmup, badges: [fd.level, `${dur.key} min`, activity], duration_label: `${fd.duration}-Minute Live Micro-Session` } };
    const toolkit = { icon: '', label: 'Language Toolkit', title: `Toolkit — ${title}`, layout: 'toolkit',
      data: { intro: 'Expressions grouped by what they do.', groups: toolkitGroups } };
    const dialogueLines = (() => {
      const lines = [ { speaker: 'Tutor', side: 'left', line: 'Hello — how can I help you today?' },
        { speaker: 'Student', side: 'right', line: `**${items[0] || 'Hello.'}**` },
        { speaker: 'Tutor', side: 'left', line: 'Of course. Is there anything else?' },
        { speaker: 'Student', side: 'right', line: `**${items[1] || 'Thank you.'}**` },
        { speaker: 'Tutor', side: 'left', line: 'All done. Have a good day!' },
        { speaker: 'Student', side: 'right', line: `**${items[items.length - 1] || 'Goodbye.'}**` } ];
      return f.short ? lines.slice(0, 4) : lines;
    })();
    const dialogue = { icon: '', label: 'Model Dialogue', title: `Dialogue — ${title}`, layout: 'dialogue',
      data: { instruction: 'Read the dialogue aloud with your tutor.', setting: (d.roles || `Your tutor plays the other person${f.place}.`).trim(), lines: dialogueLines } };
    const cultural = String(d.culturalNotes || '').trim();
    const registerPairs = (() => {
      const pairs = [];
      if (cultural) pairs.push({ good: 'A version that fits the local norms.', bad: `A version that ignores: ${cultural}`, note: 'Match the politeness expected here.' });
      pairs.push({ good: 'Could you help me, please?', bad: 'Give me that.', note: 'Use "could" and "please" to sound polite, not demanding.' });
      pairs.push({ good: "I'm afraid I can't make it.", bad: "No. I don't want to.", note: 'Soften a refusal to keep it polite.' });
      return pairs.slice(0, 3);
    })();
    const register = { icon: '', label: 'Register & Delivery', title: 'Register & Delivery', layout: 'compare',
      data: { intro: 'Same message, different tone — choose the appropriate one.', pairs: registerPairs } };
    const controlled = { icon: '', label: 'Controlled Practice', title: 'Match the Expression', layout: 'bankmatch',
      data: { intro: 'Which expression fits each moment?', bank: items,
        prompts: [ { q: 'You start the conversation → ___', a: items[0] || '' },
          { q: 'You ask for something → ___', a: items[1] || '' },
          { q: "You didn't catch it — you ask them to repeat → ___", a: items[2] || '' },
          { q: 'You give a reason → ___', a: items[3] || '' },
          { q: 'You finish politely → ___', a: items[items.length - 1] || '' } ].slice(0, f.short ? 3 : Math.min(5, items.length)) } };
    // Activity-specific speaking task (one of the seven), scaffolded by tier.
    const ACTIVITY_TASK = {
      'Role-play': { steps: ['Greet and open the conversation.', 'Make your request or suggestion and give a reason.', 'Handle one complication the other person raises.', 'Agree an outcome and close politely.'],
        criteria: ['Use at least two Toolkit expressions.', 'Handle the complication and reach an outcome.'] },
      'Guided Discussion': { steps: ['Open the topic and give your first view.', 'Support it with a reason or example.', 'Respond to a different point of view.', 'Move the discussion toward a shared conclusion.'],
        criteria: ['Give a clear opinion with a reason.', 'Respond to at least one other view.'] },
      'Interview': { steps: ['Greet and settle into the interview.', 'Answer a question with a specific example.', 'Ask a relevant question of your own.', 'Close and thank the interviewer.'],
        criteria: ['Answer with a concrete example.', 'Ask at least one relevant question.'] },
      'Debate': { steps: ['State your position clearly.', 'Support it with your strongest argument.', 'Rebut the opposing point.', 'Summarise and restate your case.'],
        criteria: ['Make one well-supported argument.', 'Rebut at least one counter-point.'] },
      'Presentation': { steps: ['Open and preview what you will cover.', 'Present your main points clearly.', 'Highlight the key takeaway.', 'Invite and handle a question.'],
        criteria: ['Signpost the structure clearly.', 'Deliver a clear key message.'] },
      'Negotiation': { steps: ['Open and state your goal.', 'Make a clear proposal.', 'Trade a concession for a condition.', 'Confirm the agreement.'],
        criteria: ['Make a proposal and one conditional concession.', 'Reach or clarify an agreement.'] },
      'Problem-solving': { steps: ['Define the problem together.', 'Suggest options and weigh them.', 'Agree on the best option.', 'Plan the first next step.'],
        criteria: ['Weigh at least two options.', 'Agree a concrete next step.'] }
    };
    const at = ACTIVITY_TASK[activity] || ACTIVITY_TASK['Role-play'];
    const steps = f.isFound ? at.steps.slice(0, 3) : at.steps;
    const criteria = f.isFound ? [at.criteria[0], 'Stay polite throughout.'] : at.criteria;
    const rolesRaw = (d.roles || 'Your tutor plays the other person').trim();
    const rolesText = /[.?!]$/.test(rolesRaw) ? rolesRaw : rolesRaw + '.';
    const scenario = `${title}. ${rolesText}${f.place ? ` Set it${f.place}.` : ''}`.trim();
    const canDo = f.isFound ? [`I can handle "${title.toLowerCase()}" with fixed phrases.`, 'I can stay polite.', 'I can start and end the exchange.']
      : f.isDev ? [`I can manage "${title.toLowerCase()}", including one complication.`, 'I can give reasons for what I say.', 'I can keep an appropriate, polite tone.']
        : [`I can navigate "${title.toLowerCase()}" with register control.`, 'I can hedge, concede and rebut.', 'I can drive the exchange to a clear outcome.'];
    const nextStep = `Complete your post-session activity on the platform: ${f.isFound ? 'record yourself doing the dialogue once' : f.isDev ? 'use one expression in a real conversation this week and note how it went' : `prepare and record a 1-2 minute ${activity.toLowerCase()} turn for this scenario`}. Your tutor tracks your completion time and practice metrics before the next session.`;

    if (f.short) {
      // ── 15-minute · 4 slides ──
      const slides = [ hero, toolkit, dialogue,
        { icon: '', label: 'Speak & Review', title: `${activity} — Your Turn`, layout: 'task',
          data: { scenario, steps, tip: 'Use the expressions from the Toolkit (Slide 2).', criteria, can_do: canDo[0], next_step: nextStep } } ];
      return { slides, practice_bank: practiceBank(items, fd, ex) };
    }

    // ── 25-minute · 7 slides ──
    const slides = [ hero, toolkit, dialogue, register, controlled,
      { icon: '', label: 'Your Turn — Speaking Task', title: `${activity} — Your Turn`, layout: 'task',
        data: { scenario, steps, tip: 'Use the expressions from the Toolkit (Slide 2).', criteria } },
      { icon: '', label: 'Review & Next Step', title: 'Review & Next Step', layout: 'checklist',
        data: { intro: 'Great speaking today — here is what you can now do:', style: 'check', items: canDo.map(t => ({ text: t, hint: '' })), footer: nextStep } } ];
    return { slides, practice_bank: practiceBank(items, fd, ex) };
  }
};
