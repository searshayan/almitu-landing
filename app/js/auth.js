/* ═══════════════════════════════════════════════════════
   Almitu Pro — Authentication (email + password)

   Owns the auth session, loads the signed-in user's profile, and
   hands control to the router (routeApp) whenever auth state changes.
   ═══════════════════════════════════════════════════════ */

window.almituAuth = { user: null, profile: null, loading: true };

function currentProfile() { return window.almituAuth.profile; }
function currentUserId() { return window.almituAuth.user ? window.almituAuth.user.id : null; }

/* ─────────────── sign up / in / out ─────────────── */

async function authSignUp(email, password, fullName) {
  const c = requireSb();
  const { data, error } = await c.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  if (error) throw new Error(error.message);
  // If email confirmation is ON, there's no session yet.
  return { needsConfirmation: !data.session };
}

async function authSignIn(email, password) {
  const c = requireSb();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

async function authSignOut() {
  const c = sb();
  if (c) await c.auth.signOut();
  window.almituAuth = { user: null, profile: null, loading: false };
  if (typeof exitViewAs === 'function') exitViewAs(true);   // drop any admin View-as
  if (typeof stopStudentLivePolling === 'function') stopStudentLivePolling();
  if (window.tutorState) { tutorState.currentSessionId = null; tutorState.currentMeetLink = null; }
  if (window._timerInterval) clearInterval(window._timerInterval);
  routeApp();
}

/* Re-fetch the profile for the current user (after admin changes a role, etc.) */
async function refreshProfile() {
  try {
    window.almituAuth.profile = await dataGetMyProfile();
  } catch (e) {
    console.error('refreshProfile', e);
    window.almituAuth.profile = null;
  }
  return window.almituAuth.profile;
}

/* ─────────────── boot + auth-state wiring ─────────────── */

async function authInit() {
  if (!isSupabaseConfigured()) {
    window.almituAuth.loading = false;
    routeApp();                     // router shows the "configure backend" notice
    return;
  }
  const c = requireSb();

  // React to sign-in / sign-out — but NOT to token refreshes or the re-emits
  // supabase-js fires when the tab regains focus. Re-routing on those would
  // tear down whatever the user is doing (e.g. a tutor mid-session loses the
  // presentation the moment they switch to the Google Meet tab and back).
  c.auth.onAuthStateChange(async (event, session) => {
    const newId = session ? session.user.id : null;
    const prevId = window.almituAuth.user ? window.almituAuth.user.id : null;
    window.almituAuth.user = session ? session.user : null;
    window.almituAuth.loading = false;

    if (newId === prevId && event !== 'SIGNED_OUT') return;   // same person → leave the UI alone

    if (session) { await refreshProfile(); }
    else { window.almituAuth.profile = null; }
    routeApp();
  });

  // Initial load.
  const { data } = await c.auth.getSession();
  window.almituAuth.user = data.session ? data.session.user : null;
  if (window.almituAuth.user) await refreshProfile();
  window.almituAuth.loading = false;
  routeApp();
}
