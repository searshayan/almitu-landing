// ═══════════════════════════════════════════════════════════════════
// Almitu — "daily-room" Edge Function
//
// Mints the credential to join a classroom's video call (Daily.co). It runs
// server-side so the Daily API key NEVER reaches the browser — the client only
// ever receives a short-lived room URL + meeting token.
//
// On each call it:
//   1. Identifies the caller from their JWT.
//   2. Loads the classroom session and derives the caller's ROLE from the DB
//      (session.tutor_id → owner/host who can screen-share; session.student_id
//      → participant). A caller who is neither is rejected. The client cannot
//      choose its own role.
//   3. Creates (or reuses) a private Daily room named after the session.
//   4. Returns { roomUrl, token, isOwner }.
//
// DEPLOY: Supabase dashboard → Edge Functions → Deploy a new function → name it
// "daily-room" → paste this file → Deploy. Then set the secret:
//   supabase secrets set DAILY_API_KEY=xxxxx
// (SUPABASE_URL / ANON / SERVICE_ROLE are injected automatically.)
// DAILY_DOMAIN is optional — it defaults to almitulive.daily.co.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DAILY_API = "https://api.daily.co/v1";
const ROOM_TTL_SECONDS = 2 * 60 * 60;   // room + token live 2h; a class is 15–25m

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
  const DAILY_DOMAIN = Deno.env.get("DAILY_DOMAIN") || "almitulive.daily.co";
  if (!DAILY_API_KEY) return json({ error: "not_configured", detail: "DAILY_API_KEY is not set" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---- 1. Who is asking? ----
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let body: { sessionId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const sessionId = (body.sessionId || "").trim();
  if (!sessionId) return json({ error: "missing_session" }, 400);

  // ---- 2. Load the session + derive the role from the DB (never the client) ----
  const { data: session } = await admin
    .from("sessions")
    .select("id, tutor_id, student_id, status, is_classroom")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || !session.is_classroom) return json({ error: "no_such_classroom" }, 404);

  let isOwner: boolean;
  if (session.tutor_id === user.id) isOwner = true;         // tutor = host, can screen-share
  else if (session.student_id === user.id) isOwner = false; // student = participant
  else return json({ error: "forbidden" }, 403);

  const { data: profile } = await admin
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const userName = (profile?.full_name || (isOwner ? "Tutor" : "Student")).slice(0, 60);

  const roomName = "almitu-" + sessionId;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    // ---- 3. Ensure the room exists (private; token required to join) ----
    await ensureRoom(DAILY_API_KEY, roomName, nowSec + ROOM_TTL_SECONDS);

    // ---- 4. Mint a meeting token scoped to this room + role ----
    const token = await createToken(DAILY_API_KEY, {
      room_name: roomName,
      is_owner: isOwner,
      user_name: userName,
      exp: nowSec + ROOM_TTL_SECONDS,
    });

    return json({ roomUrl: `https://${DAILY_DOMAIN}/${roomName}`, token, isOwner });
  } catch (e) {
    console.error("daily-room error:", e);
    return json({ error: "daily_error", detail: String((e as Error)?.message || e) }, 502);
  }
});

// ─────────────── Daily REST helpers ───────────────

async function ensureRoom(apiKey: string, name: string, exp: number): Promise<void> {
  // Already there? (idempotent for a rejoin.)
  const got = await fetch(`${DAILY_API}/rooms/${name}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (got.ok) return;

  const res = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        exp,
        max_participants: 2,       // one tutor + one student
        enable_screenshare: true,
        enable_chat: false,
        start_audio_off: false,
        start_video_off: false,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // A race where the room was created between our GET and POST is fine.
    if (String(err?.info || "").includes("already exists")) return;
    throw new Error(err?.info || err?.error || `create room HTTP ${res.status}`);
  }
}

async function createToken(
  apiKey: string,
  props: { room_name: string; is_owner: boolean; user_name: string; exp: number },
): Promise<string> {
  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.info || err?.error || `create token HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}
