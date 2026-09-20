// ═══════════════════════════════════════════════════════════════════
// Almitu — "practice-tts" Edge Function
//
// Generate-once audio for the Reading and Listening practice cards. It runs
// on Supabase's servers so the ElevenLabs key NEVER reaches a browser — not a
// student's and not a tutor's.
//
// On each call it:
//   1. Identifies the caller from their JWT and checks they own (student) or
//      teach (tutor) the session.
//   2. Reads the FINAL text for the card from the session's practice bank —
//      the reading passage, or the listening card's INTERNAL script (which is
//      never sent to a student UI).
//   3. If audio for that exact text already exists, returns it (no TTS call).
//   4. Otherwise calls ElevenLabs standard Text-to-Speech ONCE, uploads the
//      MP3 to the public `practice-audio` bucket, and writes the path +
//      metadata back onto the session's plan JSONB. Replay then streams the
//      stored file from the CDN with no further TTS calls.
//
// DEPLOY: Supabase dashboard → Edge Functions → Deploy a new function → name
// it "practice-tts" → paste this file → Deploy.
// SECRETS (Edge Functions → Manage secrets):
//   • ELEVENLABS_API_KEY   (required) — your ElevenLabs key. Kept server-side.
//   • ELEVENLABS_VOICE_ID  (optional) — defaults to DEFAULT_VOICE_ID below.
//   • ELEVENLABS_MODEL     (optional) — defaults to "eleven_multilingual_v2".
//   • ELEVENLABS_SPEED     (optional) — 0.7–1.2, defaults to 0.8 (slower =
//                          clearer for learners). Tune without redeploying.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "practice-audio";
const DEFAULT_VOICE_ID = "Nhs7eitvQWFTQBsf0yiT"; // "Sarah" — clear, gentle (added to the Almitu workspace)
const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_SPEED = 0.8;         // calm, deliberate learner pace (1.0 = normal; range 0.7–1.2)
const OUTPUT_FORMAT = "mp3_44100_64"; // 64 kbps mono MP3 — spec's speech target
const MAX_TTS_CHARS = 5000;        // guardrail against an over-long script

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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || DEFAULT_VOICE_ID;
  const MODEL = Deno.env.get("ELEVENLABS_MODEL") || DEFAULT_MODEL;
  // Speed is tunable without a code change via the ELEVENLABS_SPEED secret.
  // Clamped to the API's supported 0.7–1.2 range; lower = slower/clearer.
  const rawSpeed = Number(Deno.env.get("ELEVENLABS_SPEED"));
  const SPEED = Math.min(1.2, Math.max(0.7, Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : DEFAULT_SPEED));

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

  // ---- 2. Validate request ----
  let body: { sessionId?: string; card?: string; settingsVersion?: number };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const sessionId = (body.sessionId || "").trim();
  const card = (body.card || "").trim();
  // Cache-busting stamp from the client. Bumping it (in lockstep with a voice/
  // speed change) forces already-generated clips to regenerate on next open.
  const settingsVersion = Number.isFinite(Number(body.settingsVersion)) ? Number(body.settingsVersion) : 1;
  if (!sessionId) return json({ error: "missing_session" }, 400);
  if (card !== "reading" && card !== "listening") return json({ error: "bad_card" }, 400);

  if (!ELEVEN_KEY) return json({ error: "tts_not_configured" }, 503);

  // ---- 3. Load the session and authorize ----
  const { data: session, error: sErr } = await admin
    .from("sessions")
    .select("id, student_id, tutor_id, plan")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr || !session) return json({ error: "session_not_found" }, 404);
  if (user.id !== session.student_id && user.id !== session.tutor_id) {
    return json({ error: "forbidden" }, 403);
  }

  const plan = session.plan || {};
  const bank = plan?.content?.practice_bank;
  const cardObj = bank?.[card];
  if (!cardObj) return json({ error: "card_missing" }, 404);

  // The source text: the displayed reading passage, or the listening card's
  // INTERNAL script (never exposed to the student UI).
  const sourceText = card === "reading"
    ? (cardObj?.passage?.text || "")
    : (cardObj?.audio?.internalScript || "");
  if (!sourceText || !sourceText.trim()) return json({ error: "no_source_text" }, 422);
  if (sourceText.length > MAX_TTS_CHARS) return json({ error: "source_too_long" }, 422);

  const audio = cardObj.audio || {};
  const scriptHash = await sha256Hex(`${sourceText}|${VOICE_ID}|${MODEL}|${SPEED}|v${settingsVersion}`);
  const path = `generated/${sessionId}/${card}-${scriptHash.slice(0, 12)}.mp3`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  // ---- 4. Idempotency: already generated for this exact text? ----
  if (audio.audioStatus === "ready" && audio.audioPath === path) {
    return json({ ok: true, card, reused: true, audio, publicUrl });
  }

  // ---- 5. Generate audio if the object isn't already in storage ----
  let uploaded = false;
  // If a prior run uploaded this exact file, reuse it without paying for TTS again.
  const { data: existing } = await admin.storage.from(BUCKET).list(`generated/${sessionId}`, {
    search: `${card}-${scriptHash.slice(0, 12)}.mp3`,
  });
  const alreadyThere = Array.isArray(existing) && existing.some((f) => f.name === `${card}-${scriptHash.slice(0, 12)}.mp3`);

  if (!alreadyThere) {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVEN_KEY,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: sourceText,
          model_id: MODEL,
          // Tuned for warm, steady narration: moderate stability keeps it from
          // wandering, higher similarity + speaker boost keep it human, and a
          // slower speed gives learners time to process each word.
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.0,
            use_speaker_boost: true,
            speed: SPEED,
          },
        }),
      },
    );
    if (!ttsRes.ok) {
      const detail = await ttsRes.text().catch(() => "");
      return json({ error: "tts_failed", status: ttsRes.status, detail: detail.slice(0, 300) }, 502);
    }
    const bytes = new Uint8Array(await ttsRes.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upErr) return json({ error: "upload_failed", detail: upErr.message }, 502);
    uploaded = true;
  }

  // ---- 6. Write path + metadata back onto the plan ----
  const newAudio = {
    ...audio,
    voiceProfile: audio.voiceProfile || "almitu-learning-voice",
    speed: SPEED,
    format: "mp3",
    audioStatus: "ready",
    audioPath: path,
    audioVersion: 1,
    settingsVersion,
    scriptHash: `sha256:${scriptHash}`,
    voiceId: VOICE_ID,
    model: MODEL,
    bitrateKbps: 64,
    channels: 1,
    generatedAt: new Date().toISOString(),
  };
  // Never persist the internal script back through this path — leave it as-is
  // on the plan (it was already stored at generation time) and only touch audio.
  const newPlan = structuredClone(plan);
  newPlan.content.practice_bank[card].audio = newAudio;

  const { error: updErr } = await admin.from("sessions").update({ plan: newPlan }).eq("id", sessionId);
  if (updErr) {
    // Audio exists in storage; the DB just didn't record it. The client still
    // gets the path back and can play it — the next run will reconcile the plan.
    console.warn("plan update failed:", updErr.message);
  }

  return json({ ok: true, card, reused: !uploaded, audio: newAudio, publicUrl });
});
