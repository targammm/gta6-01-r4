// audio.js — every sound is synthesized with WebAudio: engine and siren
// oscillators, noise bursts for gunfire and crashes, little jingles for
// pickups and mission completions, and an eight-step bass loop for music.
// The context is created lazily on the first input, as browsers require.

export function createAudio(world) {
  return {
    ctx: null,
    master: null,
    noiseBuffer: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    musicStep: 0,
    musicTimer: 0,
    muted: false,
  };
}

export function ensureAudio(world) {
  const a = world.audio;
  if (!a || a.ctx) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    a.ctx = ctx;
    a.master = ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.5;
    a.master.connect(ctx.destination);

    // One shared noise buffer for every burst.
    const len = ctx.sampleRate;
    a.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = a.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Engine: a sawtooth through a lowpass, gain and pitch follow speed.
    a.engineOsc = ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineFilter = ctx.createBiquadFilter();
    a.engineFilter.type = 'lowpass';
    a.engineFilter.frequency.value = 420;
    a.engineGain = ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engineOsc.connect(a.engineFilter).connect(a.engineGain).connect(a.master);
    a.engineOsc.start();

    // Siren: a triangle whose pitch a square LFO swings up and down.
    a.sirenOsc = ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenOsc.frequency.value = 750;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain).connect(a.sirenOsc.frequency);
    a.sirenGain = ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain).connect(a.master);
    a.sirenOsc.start();
    lfo.start();
  } catch {
    // No audio device or a blocked context: the game stays silent.
  }
}

export function noiseBurst(world, duration, filterFreq, volume) {
  const a = world.audio;
  if (!a || !a.ctx) return;
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(a.master);
  src.start(t, Math.random() * 0.4);
  src.stop(t + duration + 0.02);
}

export function playGunshot(world) {
  noiseBurst(world, 0.14, 2600, 0.5);
}

export function playCrash(world, intensity = 1) {
  noiseBurst(world, 0.12 + 0.18 * intensity, 700, 0.25 + 0.25 * intensity);
}

function tone(world, freq, at, duration, type, volume) {
  const a = world.audio;
  if (!a || !a.ctx) return;
  const ctx = a.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  const t = ctx.currentTime + at;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(a.master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playPickup(world) {
  tone(world, 660, 0, 0.12, 'sine', 0.22);
  tone(world, 990, 0.09, 0.16, 'sine', 0.22);
}

export function playMissionComplete(world) {
  tone(world, 523, 0, 0.18, 'triangle', 0.26);
  tone(world, 659, 0.1, 0.18, 'triangle', 0.26);
  tone(world, 784, 0.2, 0.3, 'triangle', 0.26);
}

// Continuous sounds, refreshed once per world step.
export function updateEngineSound(world) {
  const a = world.audio;
  if (!a || !a.ctx) return;
  const car = world.player.inCar;
  const t = a.ctx.currentTime;
  if (car) {
    const kmh = Math.abs(car.speed) * 3.6;
    a.engineOsc.frequency.setTargetAtTime(52 + kmh * 1.6, t, 0.06);
    a.engineGain.gain.setTargetAtTime(0.05 + Math.min(0.09, (Math.abs(car.speed) / 34) * 0.09), t, 0.08);
  } else {
    a.engineGain.gain.setTargetAtTime(0, t, 0.08);
  }
}

export function updateSirenSound(world) {
  const a = world.audio;
  if (!a || !a.ctx) return;
  const on = world.wanted.level > 0 && world.police.cruisers.length > 0;
  a.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, a.ctx.currentTime, 0.15);
}

// An eight-step bass loop, one note every 0.42 s, during play.
const BASS_LINE = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4];

export function updateMusic(world, dt) {
  const a = world.audio;
  if (!a || !a.ctx) return;
  if (world.phase !== 'play') return;
  a.musicTimer += dt;
  if (a.musicTimer >= 0.42) {
    a.musicTimer -= 0.42;
    const freq = BASS_LINE[a.musicStep % BASS_LINE.length];
    a.musicStep++;
    tone(world, freq, 0, 0.34, 'sine', 0.11);
  }
}

export function setMuted(world, muted) {
  const a = world.audio;
  if (!a) return;
  a.muted = muted;
  if (a.master && a.ctx) {
    a.master.gain.setTargetAtTime(muted ? 0 : 0.5, a.ctx.currentTime, 0.03);
  }
}
