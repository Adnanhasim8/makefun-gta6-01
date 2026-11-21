// Solmar City — all sound is synthesized live with WebAudio: no audio files.
// Engine hum, sirens, impacts, pickups and mission stings, all built from
// oscillators and filtered noise so the game ships zero media.

(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var engineOsc = null;
  var engineOsc2 = null;
  var engineGain = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenTimer = 0;
  var sirenHigh = false;

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensureContext() || muted) return;
    try {
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensureContext() || muted) return;
    try {
      var t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) { /* audio is best-effort */ }
  }

  // Continuous engine hum while driving; call every frame with speed 0..1.
  function engine(speed01, on) {
    if (!ensureContext()) return;
    try {
      if (!on) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc2 = ctx.createOscillator();
        engineOsc2.type = 'square';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        engineOsc.connect(f);
        engineOsc2.connect(f);
        f.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        engineOsc2.start();
      }
      var base = 55 + speed01 * 130;
      engineOsc.frequency.value = base;
      engineOsc2.frequency.value = base * 0.5 + 2;
      engineGain.gain.value = muted ? 0 : 0.045 + speed01 * 0.05;
    } catch (e) { /* audio is best-effort */ }
  }

  // Two-tone police siren while any police car is close; call every frame.
  function siren(active, dt) {
    if (!ensureContext()) return;
    try {
      if (!active) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      }
      sirenGain.gain.value = muted ? 0 : 0.05;
    } catch (e) { /* audio is best-effort */ }
  }

  function punch() {
    noiseBurst(0.12, 0.5, 900);
    blip(140, 0.1, 'sine', 0.35, 60);
  }

  function crash(strength) {
    noiseBurst(0.25, Math.min(0.6, 0.15 + strength * 0.25), 700);
    blip(90, 0.2, 'sine', 0.3, 40);
  }

  function pickup() {
    blip(660, 0.09, 'sine', 0.25);
    setTimeout(function () { blip(990, 0.14, 'sine', 0.25); }, 90);
  }

  function cash() {
    blip(880, 0.08, 'triangle', 0.22);
    setTimeout(function () { blip(1174, 0.08, 'triangle', 0.22); }, 80);
    setTimeout(function () { blip(1568, 0.16, 'triangle', 0.22); }, 160);
  }

  function missionDone() {
    var notes = [523, 659, 784, 1046];
    notes.forEach(function (n, i) {
      setTimeout(function () { blip(n, 0.22, 'triangle', 0.25); }, i * 130);
    });
  }

  function missionFail() {
    blip(330, 0.3, 'sawtooth', 0.2, 110);
    setTimeout(function () { blip(220, 0.45, 'sawtooth', 0.2, 80); }, 220);
  }

  function busted() {
    blip(440, 0.2, 'square', 0.18, 440);
    setTimeout(function () { blip(440, 0.2, 'square', 0.18, 440); }, 260);
  }

  function door() {
    blip(300, 0.08, 'sine', 0.2, 180);
  }

  function click() {
    blip(1200, 0.04, 'square', 0.12);
  }

  SC.audio = {
    ensureContext: ensureContext,
    setMuted: setMuted,
    isMuted: isMuted,
    engine: engine,
    siren: siren,
    punch: punch,
    crash: crash,
    pickup: pickup,
    cash: cash,
    missionDone: missionDone,
    missionFail: missionFail,
    busted: busted,
    door: door,
    click: click,
  };
})();
