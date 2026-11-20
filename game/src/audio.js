// audio.js — all sound is synthesized WebAudio: engine, siren, gunshots, crashes and a bass loop.
export function createAudio() {
  return {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    musicTimer: 0, musicStep: 0,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    return audio;
  }
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return audio;
    const ctx = new AC();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(ctx.destination);

    const engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audio.master);
    engineOsc.start();
    audio.engineOsc = engineOsc;
    audio.engineFilter = engineFilter;
    audio.engineGain = engineGain;

    const sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 750;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(audio.master);
    sirenOsc.start();
    lfo.start();
    audio.sirenOsc = sirenOsc;
    audio.sirenGain = sirenGain;
    audio.sirenLfo = lfo;
  } catch (err) {
    audio.ctx = null;
  }
  return audio;
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) {
    audio.master.gain.setValueAtTime(muted ? 0 : 0.5, audio.ctx.currentTime);
  }
}

export function updateEngineSound(audio, speedKmh, inCar) {
  if (!audio.ctx || !audio.engineGain) return;
  const t = audio.ctx.currentTime;
  if (!inCar) {
    audio.engineGain.gain.setTargetAtTime(0, t, 0.1);
    return;
  }
  const gain = 0.05 + Math.min(0.09, Math.abs(speedKmh) / 122 * 0.09);
  audio.engineGain.gain.setTargetAtTime(gain, t, 0.08);
  audio.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speedKmh) * 1.6, t, 0.08);
}

export function updateSirenSound(audio, wantedLevel) {
  if (!audio.ctx || !audio.sirenGain) return;
  audio.sirenGain.gain.setTargetAtTime(wantedLevel > 0 ? 0.045 : 0, audio.ctx.currentTime, 0.2);
}

export function noiseBurst(audio, duration, filterFreq, volume) {
  if (!audio.ctx) return;
  try {
    const ctx = audio.ctx;
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
    gain.connect(audio.master);
    src.start();
  } catch (err) {
    // a failed burst is silent, never fatal
  }
}

export function playGunshot(audio) {
  noiseBurst(audio, 0.14, 2600, 0.5);
}

export function playCrash(audio, strength) {
  noiseBurst(audio, 0.12 + (strength || 0.3) * 0.3, 700, 0.25 + (strength || 0.3) * 0.3);
}

function tone(audio, freqA, freqB, duration, type, volume, when) {
  if (!audio.ctx) return;
  try {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    const start = ctx.currentTime + (when || 0);
    osc.frequency.setValueAtTime(freqA, start);
    if (freqB) osc.frequency.exponentialRampToValueAtTime(freqB, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch (err) {
    // silent on failure
  }
}

export function playPickup(audio) {
  tone(audio, 660, 990, 0.25, 'sine', 0.3, 0);
}

export function playMissionComplete(audio) {
  tone(audio, 523, null, 0.16, 'triangle', 0.3, 0);
  tone(audio, 659, null, 0.16, 'triangle', 0.3, 0.1);
  tone(audio, 784, null, 0.3, 'triangle', 0.3, 0.2);
}

const BASS_LINE = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4];

export function updateMusic(audio, dt) {
  if (!audio.ctx) return;
  audio.musicTimer -= dt;
  if (audio.musicTimer <= 0) {
    audio.musicTimer = 0.42;
    const freq = BASS_LINE[audio.musicStep % BASS_LINE.length];
    audio.musicStep += 1;
    tone(audio, freq, null, 0.3, 'sine', 0.11, 0);
  }
}
