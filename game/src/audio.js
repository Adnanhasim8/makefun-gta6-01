// audio.js — all sound is synthesized with WebAudio, no audio files.
// Engine hum, gunshots, sirens, pickups and mission jingles, built from
// oscillators and filtered noise so the game needs no network at all.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, volume) {
    if (!ctx || muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Call every frame: engine pitch follows speed, siren wails while wanted. */
    update(speed01, wanted) {
      if (!ctx) return;
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 50 + speed01 * 140;
        engineGain.gain.value = muted ? 0 : 0.02 + speed01 * 0.05;
      }
      if (sirenOsc && sirenGain) {
        const on = wanted > 0 && !muted;
        sirenGain.gain.value = on ? 0.045 : 0;
        if (on) {
          sirenTimer += 1 / 60;
          const phase = (sirenTimer % 1.2) < 0.6 ? 0 : 1;
          sirenOsc.frequency.value = phase === 0 ? 660 : 880;
        }
      }
    },
    shot() {
      noiseBurst(0.12, 1800, 0.5);
      tone(180, 0.08, 'square', 0.18, 60);
    },
    crash() {
      noiseBurst(0.25, 500, 0.6);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.3, 1320);
    },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      setTimeout(() => tone(659, 0.14, 'triangle', 0.3), 130);
      setTimeout(() => tone(784, 0.3, 'triangle', 0.35), 260);
    },
    missionFail() {
      tone(392, 0.25, 'sawtooth', 0.2, 196);
    },
    sirenBlip() {
      tone(950, 0.18, 'sine', 0.25, 700);
    },
    click() {
      tone(1200, 0.05, 'square', 0.12);
    },
  };
}
