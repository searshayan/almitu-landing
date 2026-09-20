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

/* Slides — an objective slide, then the one picture-first activity slide. */
function buildLiteracyContent(rec) {
  const slides = [{
    layout: 'hero', title: rec.title, icon: '',
    data: { heading: rec.title, goal: rec.objective || '', duration_label: 'Literacy session' }
  }];

  if (rec.skill === 'alphabet') {
    slides.push({ layout: 'letters', title: 'Letters & sounds', icon: '',
      data: { intro: 'Say the letter name, then its sound.',
        items: (rec.letters || []).map(l => ({ letter: l.letter, sound: l.sound, word: l.word })) } });
  } else if (rec.skill === 'blending') {
    slides.push({ layout: 'blend', title: 'Build the word', icon: '',
      data: { intro: 'Sound out each letter, then blend them together.',
        items: _litWords(rec).map(w => ({ word: w })) } });
  } else if (rec.skill === 'sightword') {
    slides.push({ layout: 'sightwords', title: 'Sight words', icon: '',
      data: { intro: 'Read each word — say it as a whole.',
        items: _litWords(rec).map(w => ({ word: w })) } });
  } else { // pictureword
    slides.push({ layout: 'picwords', title: rec.theme || 'Name the picture', icon: '',
      data: { intro: 'Name each picture.', items: _litWords(rec).map(w => ({ word: w })) } });
  }
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
      level: rec.level, tier: 'literacy', duration: 15, sessionType: rec.skill,
      renderId: 'LIT', curriculumId: rec.curriculum_id
    },
    formData: { studentName: 'the student', language: '', countryOfResident: '',
      l1Support: true, level: rec.level, tier: 'literacy', sessionType: rec.skill, duration: 15, details: {} },
    fingerprint: 'literacy-' + rec.curriculum_id,
    content, slides,
    engineUsed: 'Literacy (authored)',
    practiceReady: true, practiceGenerating: false
  };
}
