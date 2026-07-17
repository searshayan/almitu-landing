/* ═══════════════════════════════════════════════════════
   Almitu Pro — Supabase client

   Fill in the two values below from your Supabase project:
     Dashboard → Project Settings → API
       • Project URL      → SUPABASE_URL
       • Project API keys → anon / public  → SUPABASE_ANON_KEY

   Both are PUBLIC values and safe to ship in client code — row-level
   security (see supabase/migration.sql) is what actually protects data.
   ═══════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://cnbvluvmoqfwggniicrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnZsdXZtb3Fmd2dnbmlpY3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDYxMDQsImV4cCI6MjA5OTc4MjEwNH0.ITAgucjpbAWrFdx8rh73oKLxAJ-y5EZuL_tfDxv54N8';

/* True only once real credentials are pasted in above. Lets the app show a
   friendly "backend not configured yet" screen instead of throwing. */
function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20
    && !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_');
}

/* The shared client. Created lazily so a missing CDN or missing config
   degrades gracefully rather than crashing the whole page. */
let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!isSupabaseConfigured()) return null;
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase JS failed to load from CDN.');
    return null;
  }
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return _sb;
}
