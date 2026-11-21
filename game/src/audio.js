// Synthesised sound: no audio files, every sound is built from oscillators
// and filtered noise through the Web Audio API. The context starts on the
// first user gesture (browsers block audio before one); M toggles mute.

let context = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;

function ensureContext() {
  if (context) return context;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
  } catch {
    context = null;
  }
  return context;
}

export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

/** A short tone: frequency, duration, shape, volume, and an optional slide. */
function tone(freq, duration, type, volume, slideTo) {
  const ctx = ensureContext();
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** A burst of filtered noise (gunshots, impacts, pickups). */
function noise(duration, volume, filterFreq) {
  const ctx = ensureContext();
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
}

export function playGunshot() {
  noise(0.12, 0.5, 1800);
  tone(180, 0.08, 'square', 0.12, 60);
}

export function playHit() {
  noise(0.08, 0.3, 900);
}

export function playPickup() {
  tone(660, 0.09, 'sine', 0.25);
  tone(990, 0.12, 'sine', 0.2);
}

export function playCash() {
  tone(880, 0.08, 'triangle', 0.25);
  tone(1174, 0.1, 'triangle', 0.25);
  tone(1568, 0.14, 'triangle', 0.2);
}

export function playMissionStart() {
  [523, 659, 784].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.16, 'triangle', 0.25), i * 110);
  });
}

export function playMissionDone() {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.18, 'triangle', 0.28), i * 120);
  });
}

export function playMissionFail() {
  [392, 330, 262].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.2, 'sawtooth', 0.15), i * 140);
  });
}

export function playHorn() {
  tone(370, 0.25, 'square', 0.18);
  tone(466, 0.25, 'square', 0.12);
}

export function playBusted() {
  [220, 175, 147].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.16), i * 180);
  });
}

/**
 * The continuous sounds, called every frame: the engine hum follows the
 * player's speed, the siren wails while any police car is near.
 */
export function updateAmbience(driving, speedRatio, policeNear) {
  const ctx = ensureContext();
  if (!ctx || !master) return;
  if (driving && !muted) {
    if (!engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      engineNodes = { osc, gain };
    }
    engineNodes.osc.frequency.value = 50 + speedRatio * 140;
    engineNodes.gain.gain.value = 0.05 + speedRatio * 0.06;
  } else if (engineNodes) {
    engineNodes.gain.gain.value = 0;
  }
  if (policeNear && !muted) {
    if (!sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 350;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.frequency.value = 950;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, gain, lfo };
    }
    sirenNodes.gain.gain.value = 0.045;
  } else if (sirenNodes) {
    sirenNodes.gain.gain.value = 0;
  }
}

export function stopAmbience() {
  if (engineNodes) {
    try { engineNodes.osc.stop(); } catch { /* already stopped */ }
    engineNodes = null;
  }
  if (sirenNodes) {
    try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
    sirenNodes = null;
  }
}
