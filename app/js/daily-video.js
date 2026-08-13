/* ═══════════════════════════════════════════════════════
   Daily.co video for the Virtual Classroom.

   Call-object mode (not the prebuilt iframe) so we frame tracks into our own UI:
   camera tiles go in the side column, and the tutor's screen share fills the
   Stage. The room URL + token come from the `daily-room` Edge Function, so the
   Daily API key never reaches the browser.

   window.almituVideo = { connect(sessionId), leave(), toggleMic(), toggleCam(),
                          shareScreen(), stopShare(), sharing }
   ═══════════════════════════════════════════════════════ */
(function () {
  let call = null;
  let joinedSession = null;
  let sharing = false;

  window.almituVideo = {
    connect: connect,
    leave: leave,
    toggleMic: toggleMic,
    toggleCam: toggleCam,
    shareScreen: shareScreen,
    stopShare: stopShare,
    get sharing() { return sharing; },
  };

  async function connect(sessionId) {
    if (!sessionId) return;
    if (call && joinedSession === sessionId) return;   // already in this room
    if (call) await leave();
    if (!window.DailyIframe) { toast('Video library failed to load.', 'error'); return; }
    const client = (typeof sb === 'function') ? sb() : null;
    if (!client) { toast('Not signed in — cannot start video.', 'error'); return; }

    let data, error;
    try {
      ({ data, error } = await client.functions.invoke('daily-room', { body: { sessionId: sessionId } }));
    } catch (e) { toast('Could not start video: ' + (e.message || e), 'error'); return; }
    if (error || !data || !data.roomUrl) {
      toast('Could not start video' + (data && data.detail ? ': ' + data.detail : '.'), 'error');
      return;
    }

    call = window.DailyIframe.createCallObject({ subscribeToTracksAutomatically: true });
    call.on('participant-joined', renderAll);
    call.on('participant-updated', renderAll);
    call.on('participant-left', onLeft);
    call.on('joined-meeting', renderAll);
    call.on('error', (e) => console.warn('[daily] error', e));

    try {
      await call.join({ url: data.roomUrl, token: data.token });
      joinedSession = sessionId;
      reflectToggles();
    } catch (e) {
      toast('Could not join the call: ' + (e.message || e), 'error');
      await leave();
    }
  }

  async function leave() {
    sharing = false;
    if (call) {
      try { await call.leave(); } catch (e) { /* already gone */ }
      try { call.destroy(); } catch (e) { /* already gone */ }
      call = null;
    }
    joinedSession = null;
    clearTiles();
    clearScreen();
    reflectToggles();
  }

  /* ─── render camera tiles + screen share from the participant list ─── */

  function renderAll() {
    if (!call) return;
    const ps = call.participants();
    let remoteScreen = null;
    for (const id in ps) {
      const p = ps[id];
      // camera → side-column tile (owner = tutor tile, else student tile)
      const cam = p.tracks && p.tracks.video;
      const tileId = p.owner ? 'roomTileTutor' : 'roomTileStudent';
      if (cam && cam.state === 'playable' && cam.persistentTrack) attachCam(tileId, p, cam.persistentTrack);
      else detachCam(tileId);
      // remote audio → hidden <audio> (call-object mode doesn't auto-play it)
      if (!p.local) {
        const aud = p.tracks && p.tracks.audio;
        if (aud && aud.state === 'playable' && aud.persistentTrack) attachAudio(p, aud.persistentTrack);
        else detachAudio(p);
      }
      // remote screen share → the Stage
      if (!p.local) {
        const scr = p.tracks && p.tracks.screenVideo;
        if (scr && scr.state === 'playable' && scr.persistentTrack) remoteScreen = scr.persistentTrack;
      }
    }
    if (remoteScreen) showScreen(remoteScreen);
    else clearScreen();
  }

  function onLeft(ev) {
    const p = ev.participant;
    detachCam(p.owner ? 'roomTileTutor' : 'roomTileStudent');
    detachAudio(p);
    renderAll();
  }

  function attachCam(tileId, p, track) {
    const tile = document.getElementById(tileId);
    if (!tile) return;
    let v = tile.querySelector('video.rv-cam');
    if (!v) {
      v = document.createElement('video');
      v.className = 'rv-cam';
      v.autoplay = true; v.playsInline = true; v.muted = !!p.local;
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:12px;';
      tile.appendChild(v);
    }
    if (v._tid !== track.id) { v.srcObject = new MediaStream([track]); v._tid = track.id; }
  }
  function detachCam(tileId) {
    const tile = document.getElementById(tileId);
    const v = tile && tile.querySelector('video.rv-cam');
    if (v) v.remove();
  }
  function attachAudio(p, track) {
    let a = document.getElementById('rv-audio-' + p.session_id);
    if (!a) { a = document.createElement('audio'); a.id = 'rv-audio-' + p.session_id; a.autoplay = true; document.body.appendChild(a); }
    if (a._tid !== track.id) { a.srcObject = new MediaStream([track]); a._tid = track.id; }
  }
  function detachAudio(p) {
    const a = document.getElementById('rv-audio-' + p.session_id);
    if (a) a.remove();
  }

  function showScreen(track) {
    const stage = document.getElementById('roomStage');
    if (!stage) return;
    const frame = document.getElementById('roomFrame'); if (frame) frame.style.display = 'none';
    const empty = document.getElementById('roomEmpty'); if (empty) empty.hidden = true;
    let v = document.getElementById('rv-screen');
    if (!v) {
      v = document.createElement('video');
      v.id = 'rv-screen'; v.autoplay = true; v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;border-radius:10px;';
      stage.appendChild(v);
    }
    if (v._tid !== track.id) { v.srcObject = new MediaStream([track]); v._tid = track.id; }
  }
  function clearScreen() {
    const v = document.getElementById('rv-screen');
    if (!v) return;
    v.remove();
    // Restore the Stage (native slide for the tutor, or the waiting note for the student).
    if (typeof window.roomRefreshStage === 'function') window.roomRefreshStage();
  }

  function clearTiles() {
    detachCam('roomTileTutor'); detachCam('roomTileStudent');
    document.querySelectorAll('audio[id^="rv-audio-"]').forEach(a => a.remove());
    const s = document.getElementById('rv-screen'); if (s) s.remove();
  }

  /* ─── controls ─── */

  async function toggleMic() { if (!call) return; await call.setLocalAudio(!call.localAudio()); reflectToggles(); }
  async function toggleCam() { if (!call) return; await call.setLocalVideo(!call.localVideo()); reflectToggles(); }

  async function shareScreen() {
    if (!call) { toast('Join the class first.', 'warn'); return; }
    try { await call.startScreenShare(); sharing = true; }
    catch (e) { toast('Screen share was cancelled or blocked.', 'warn'); }
    reflectToggles();
  }
  function stopShare() {
    if (!call) return;
    try { call.stopScreenShare(); } catch (e) { /* not sharing */ }
    sharing = false;
    reflectToggles();
  }

  function reflectToggles() {
    setOff('roomMicBtn', call ? !call.localAudio() : false);
    setOff('roomCamBtn', call ? !call.localVideo() : false);
    const s = document.getElementById('roomShareBtn');
    if (s) s.classList.toggle('rbtn-active', sharing);
  }
  function setOff(id, off) { const b = document.getElementById(id); if (b) b.classList.toggle('rbtn-off', off); }

  function toast(m, k) { if (typeof showToast === 'function') showToast(m, k || 'info'); }
})();
