/* ═══════════════════════════════════════════════════════
   Almitu Pro — Application Entry Point
   Sets up the (hidden) prep form once, then hands off to auth,
   which routes to the correct dashboard.
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Prep-engine form scaffolding (lives inside the tutor dashboard).
  populateLevels();
  renderSessionTypeSelector();
  selectSessionType('vocabulary');
  setDuration(25);
  setL1Support(true);
  updateTierBadge();
  setGenStatus('ready');

  // Deep-link from the landing page: /app/?mode=signup opens the Create-account
  // tab, /app/?mode=signin (or no param) opens Sign-in.
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'signup' || mode === 'signin') authMode = mode;

  // Boot auth → router decides which screen/dashboard to show.
  authInit();
});
