/* ═══════════════════════════════════════════════════════
   Almitu — Literacy plan builder (deterministic, no AI)

   Turns a literacy curriculum record into a ready session plan — slides + a
   picture practice bank — using the curated image pack (literacyAssets.js) and
   the literacy layouts in renders.js. Pre-reading content is small and fixed,
   so it is authored, not generated: identical every time, free, vetted.

   Record shape (app/curriculum/literacy.json):
     { curriculum_id, skill: 'alphabet'|'blending'|'sightword'|'pictureword',
       level: 'LIT1'|'LIT2'|'LIT3', title, objective,
       letters: [{letter, sound, word}]   // alphabet
       words:   ['cat','hat', …]          // blending | sightword | pictureword
       theme, vowel                        // optional labels }
   ═══════════════════════════════════════════════════════ */

/* Words a session practises (example words for alphabet, else the word list). */
function _litWords(rec) {
  if (rec.skill === 'alphabet') return (rec.letters || []).map(l => l.word).filter(Boolean);
  return (rec.words || []).slice();
}

/* Per-skill teaching copy for the PPP arc. Practice runs receptive (Practice 1)
   then productive (Practice 2); Production drops scaffolding via hide* flags. */
const LITERACY_STAGE_COPY = {
  alphabet: {
    layout: 'letters',
    items: rec => (rec.letters || []).map(l => ({ letter: l.letter, sound: l.sound, word: l.word })),
    warmup: (rec, its) => `Warm up together: clap out any sounds you already know, then get ready for today's letters — ${its.map(i => i.letter).join(', ')}.`,
    teachTitle: 'New letters and sounds', teachIntro: 'Point to each letter. Say its name, then its sound — the learner repeats.',
    p1Title: 'Listen and find', p1Intro: 'Say a sound; the learner points to the letter that makes it.',
    p2Title: 'Say the sound', p2Intro: 'Go through each letter together — the learner says its sound and the example word.',
    prodTitle: 'On your own', prodIntro: 'Just the letters now. The learner says each sound with no picture to help.',
    prodFlags: { hideImage: true, hideWord: true, hideSound: true },
    reviewTitle: 'Well done!', reviewIntro: 'Go through all the letters one more time. Celebrate every correct sound.'
  },
  blending: {
    layout: 'blend', items: rec => _litWords(rec).map(w => ({ word: w })),
    warmup: rec => `Warm up with the ${rec.vowel || 'target'} sound: say each letter's sound on its own, then we'll join them into words.`,
    teachTitle: 'Build the word', teachIntro: 'Sound out each letter, then blend them together. Check the picture.',
    p1Title: 'Listen and find', p1Intro: 'Say a word; the learner points to the matching picture.',
    p2Title: 'Blend it together', p2Intro: 'Blend each word aloud together, sound by sound.',
    prodTitle: 'Read it yourself', prodIntro: 'No sound helpers now — the learner blends and reads each word, then checks the picture.',
    prodFlags: { hideChips: true },
    reviewTitle: 'Well done!', reviewIntro: 'Read all the words once more — quick and confident.'
  },
  sightword: {
    layout: 'sightwords', items: rec => _litWords(rec).map(w => ({ word: w })),
    warmup: () => `Warm up: read any words you already know, then meet today's words.`,
    teachTitle: 'New sight words', teachIntro: 'Read each word as a whole — say it, don’t sound it out.',
    p1Title: 'Find the word', p1Intro: 'Say a word; the learner points to it.',
    p2Title: 'Read together', p2Intro: 'Read each word aloud together, then the learner alone.',
    prodTitle: 'On your own', prodIntro: 'Just the words now — the learner reads each one on sight.',
    prodFlags: { hideSymbol: true },
    reviewTitle: 'Well done!', reviewIntro: 'Read all the words one more time, as fast as you can.'
  },
  pictureword: {
    layout: 'picwords', items: rec => _litWords(rec).map(w => ({ word: w })),
    warmup: rec => `Warm up: talk about ${rec.theme ? rec.theme.toLowerCase() : 'these things'}. What can you see around you?`,
    teachTitle: 'New words', teachIntro: 'Name each picture — the learner repeats.',
    p1Title: 'Show me', p1Intro: 'Say a word; the learner points to the right picture.',
    p2Title: 'Name it', p2Intro: 'Point to each picture — the learner names it.',
    prodTitle: 'On your own', prodIntro: 'No words now — the learner names each picture from the photo alone.',
    prodFlags: { hideWord: true },
    reviewTitle: 'Well done!', reviewIntro: 'Name every picture one more time.'
  }
};

/* Slides — the full PPP arc: Preparation → Presentation → Practice (receptive,
   then productive) → Production (low support) → Review. Deterministic. */
function buildLiteracyContent(rec) {
  const c = LITERACY_STAGE_COPY[rec.skill] || LITERACY_STAGE_COPY.pictureword;
  const items = c.items(rec);
  const layout = c.layout;
  const teachTitle = rec.skill === 'pictureword' ? (rec.theme || c.teachTitle) : c.teachTitle;

  const slides = [
    { layout: 'hero', stage: 'Preparation', title: rec.title, icon: '', label: 'Preparation · Warm-up',
      data: { heading: rec.title, goal: rec.objective || '', duration_label: 'Literacy session', warmup: c.warmup(rec, items) } },
    { layout, stage: 'Presentation', title: teachTitle, icon: '', label: 'Presentation · Teach',
      data: { intro: c.teachIntro, items } },
    { layout, stage: 'Practice 1', title: c.p1Title, icon: '', label: 'Practice · Listen & find',
      data: { intro: c.p1Intro, items } },
    { layout, stage: 'Practice 2', title: c.p2Title, icon: '', label: 'Practice · Say it',
      data: { intro: c.p2Intro, items } },
    { layout, stage: 'Production', title: c.prodTitle, icon: '', label: 'Production · On your own',
      data: Object.assign({ intro: c.prodIntro, items }, c.prodFlags) },
    { layout, stage: 'Review', title: c.reviewTitle, icon: '', label: 'Review · Well done',
      data: { intro: c.reviewIntro, items } }
  ];
  return { slides };
}

/* Practice bank — one item per word, carrying its pack image so the picture
   activities (flashcards, matching) can show it. term is required by getBank(). */
function buildLiteracyPractice(rec) {
  const prefer = rec.skill === 'sightword' ? 'symbol' : 'photo';
  const items = _litWords(rec).map(w => {
    const img = (typeof literacyImage === 'function') ? literacyImage(w, prefer) : null;
    return { term: w, meaning: '', image: img ? { file: img.file, type: img.type } : null };
  });
  return { items, sentences: [] };
}

/* Assemble the full plan object, same shape generateCurriculumSession() stores,
   so it flows through the curriculum browser, Present mode and student practice
   unchanged. Deterministic: no API call, no fingerprinting of AI inputs. */
function buildLiteracyPlan(rec) {
  const content = buildLiteracyContent(rec);
  content.practice_bank = buildLiteracyPractice(rec);
  const ctx = { tier: 'literacy', l1Support: true, language: '' };
  const slides = renderAllSlides(content, ctx);
  return {
    meta: {
      title: rec.title, student: 'the student', language: '', countryOfResident: '',
      level: rec.level, tier: 'literacy', duration: 25, sessionType: rec.skill,
      renderId: 'LIT', curriculumId: rec.curriculum_id
    },
    formData: { studentName: 'the student', language: '', countryOfResident: '',
      l1Support: true, level: rec.level, tier: 'literacy', sessionType: rec.skill, duration: 25, details: {} },
    fingerprint: 'literacy-' + rec.curriculum_id,
    content, slides,
    engineUsed: 'Literacy (authored)',
    practiceReady: true, practiceGenerating: false
  };
}
