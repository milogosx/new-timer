// Audio manager - bell/countdown SFX plus lightweight procedural background loop.
// Designed to coexist with other device audio while respecting browser gesture rules.

import { loadAudioPreferences, saveAudioPreferences } from './storage';

let audioContext = null;
let bellBuffer = null;
let initialized = false;

let sfxGainNode = null;
let bgmGainNode = null;

let bgmSchedulerId = null;
let bgmPatternIndex = 0;
let bgmNextNoteTime = 0;
let bgmPlaying = false;
let bgmUnlocked = false;
let visibilityListenerBound = false;
const bgmActiveSources = new Set();
const bgmListeners = new Set();

const BGM_LOOKAHEAD_SEC = 0.2;
const BGM_SCHEDULER_MS = 80;
const BGM_BPM = 132;
const BGM_BEAT_SEC = 60 / BGM_BPM;
const BGM_TARGET_GAIN = 0.11;

const BGM_PATTERN = [
  { note: 64, beats: 0.5, velocity: 0.92 },
  { note: 67, beats: 0.5, velocity: 0.92 },
  { note: 71, beats: 0.5, velocity: 1.0 },
  { note: 67, beats: 0.5, velocity: 0.86 },
  { note: 69, beats: 0.5, velocity: 0.94 },
  { note: 72, beats: 0.5, velocity: 1.0 },
  { note: 76, beats: 0.75, velocity: 0.95 },
  { note: 74, beats: 0.25, velocity: 0.78 },
  { note: 72, beats: 0.5, velocity: 0.95 },
  { note: 69, beats: 0.5, velocity: 0.82 },
  { note: 67, beats: 0.5, velocity: 0.76 },
  { note: null, beats: 0.5, velocity: 0 },
  { note: 64, beats: 0.5, velocity: 0.9 },
  { note: 67, beats: 0.5, velocity: 0.9 },
  { note: 71, beats: 0.5, velocity: 1.0 },
  { note: 74, beats: 0.5, velocity: 0.95 },
  { note: 72, beats: 0.75, velocity: 0.9 },
  { note: 69, beats: 0.25, velocity: 0.72 },
  { note: 67, beats: 0.5, velocity: 0.8 },
  { note: 64, beats: 1.0, velocity: 0.75 },
];

function midiToFrequency(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

function readInitialBgmEnabled() {
  try {
    const prefs = loadAudioPreferences();
    return Boolean(prefs.bgmEnabled);
  } catch {
    return true;
  }
}

let bgmEnabled = readInitialBgmEnabled();

function emitBgmState() {
  const snapshot = getBackgroundMusicState();
  bgmListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('BGM listener failed:', err);
    }
  });
}

function generateBellBuffer(ctx) {
  const sampleRate = ctx.sampleRate;
  const duration = 0.7;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  // Glass Tap — Bright Shimmer: A7 base with sparkly high overtones
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.0008);
      const decay = Math.exp(-t * 5.5);
      const envelope = attack * decay;
      let sample = 0;
      sample += Math.sin(2 * Math.PI * 3520 * t) * 0.3;
      sample += Math.sin(2 * Math.PI * 5280 * t) * 0.25;
      sample += Math.sin(2 * Math.PI * 7920 * t) * 0.2;
      sample += Math.sin(2 * Math.PI * 10560 * t) * Math.exp(-t * 8) * 0.12;
      sample += Math.sin(2 * Math.PI * 13200 * t) * Math.exp(-t * 14) * 0.06;
      data[i] = sample * envelope * 0.45;
    }
  }
  return buffer;
}

function generateBeepBuffer(ctx, frequency, duration) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const envelope = t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * 6);
    data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5;
  }
  return buffer;
}

function stopActiveBgmSources() {
  bgmActiveSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // no-op if already stopped
    }
  });
  bgmActiveSources.clear();
}

function scheduleBgmStep(step, startTime) {
  if (!audioContext || !bgmGainNode || step.note === null) return;

  const duration = step.beats * BGM_BEAT_SEC;
  const release = Math.min(0.06, duration * 0.3);
  const stopTime = startTime + duration + release;

  const leadOsc = audioContext.createOscillator();
  const leadGain = audioContext.createGain();
  leadOsc.type = 'square';
  leadOsc.frequency.value = midiToFrequency(step.note);

  const bassOsc = audioContext.createOscillator();
  const bassGain = audioContext.createGain();
  bassOsc.type = 'triangle';
  bassOsc.frequency.value = midiToFrequency(step.note - 12);

  const leadLevel = BGM_TARGET_GAIN * step.velocity;
  const bassLevel = leadLevel * 0.48;

  leadGain.gain.setValueAtTime(0.0001, startTime);
  leadGain.gain.linearRampToValueAtTime(leadLevel, startTime + 0.012);
  leadGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  bassGain.gain.setValueAtTime(0.0001, startTime);
  bassGain.gain.linearRampToValueAtTime(bassLevel, startTime + 0.016);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  leadOsc.connect(leadGain);
  bassOsc.connect(bassGain);
  leadGain.connect(bgmGainNode);
  bassGain.connect(bgmGainNode);

  leadOsc.start(startTime);
  bassOsc.start(startTime);
  leadOsc.stop(stopTime);
  bassOsc.stop(stopTime);

  bgmActiveSources.add(leadOsc);
  bgmActiveSources.add(bassOsc);

  const clearSource = (source) => () => {
    bgmActiveSources.delete(source);
  };

  leadOsc.onended = clearSource(leadOsc);
  bassOsc.onended = clearSource(bassOsc);
}

function scheduleBgmAhead() {
  if (!audioContext || !bgmPlaying || !bgmEnabled) return;

  while (bgmNextNoteTime < audioContext.currentTime + BGM_LOOKAHEAD_SEC) {
    const step = BGM_PATTERN[bgmPatternIndex % BGM_PATTERN.length];
    scheduleBgmStep(step, bgmNextNoteTime);
    bgmNextNoteTime += step.beats * BGM_BEAT_SEC;
    bgmPatternIndex += 1;
  }
}

function ensureAudioContext() {
  if (initialized && audioContext) return true;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    bellBuffer = generateBellBuffer(audioContext);

    sfxGainNode = audioContext.createGain();
    sfxGainNode.gain.value = 1;
    sfxGainNode.connect(audioContext.destination);

    bgmGainNode = audioContext.createGain();
    bgmGainNode.gain.value = 0;
    bgmGainNode.connect(audioContext.destination);

    initialized = true;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    return true;
  } catch (err) {
    console.error('Audio init failed:', err);
    return false;
  }
}

function bindVisibilityHandling() {
  if (visibilityListenerBound || typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', async () => {
    if (!audioContext) return;

    if (document.visibilityState === 'hidden') {
      stopBackgroundMusic();
      // On mobile, we DO NOT suspend the context because resuming it reliably
      // from a background state is often blocked by browser policy.
      // We just stop the oscillators (which stopBackgroundMusic does).
      return;
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if (bgmEnabled && bgmUnlocked) {
      startBackgroundMusic();
    }
  });

  visibilityListenerBound = true;
}

export function initAudio() {
  return ensureAudioContext();
}

export function initBackgroundMusic() {
  const ready = ensureAudioContext();
  if (!ready) return false;
  bindVisibilityHandling();
  return true;
}

export async function startBackgroundMusic() {
  if (!initBackgroundMusic()) return false;

  bgmUnlocked = true;

  if (!bgmEnabled) {
    emitBgmState();
    return false;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  if (bgmPlaying) {
    emitBgmState();
    return true;
  }

  bgmPlaying = true;
  bgmPatternIndex = 0;
  bgmNextNoteTime = audioContext.currentTime + 0.03;

  if (bgmGainNode) {
    bgmGainNode.gain.setTargetAtTime(BGM_TARGET_GAIN, audioContext.currentTime, 0.08);
  }

  scheduleBgmAhead();
  bgmSchedulerId = window.setInterval(scheduleBgmAhead, BGM_SCHEDULER_MS);
  emitBgmState();
  return true;
}

export function stopBackgroundMusic() {
  if (bgmSchedulerId !== null) {
    clearInterval(bgmSchedulerId);
    bgmSchedulerId = null;
  }

  if (audioContext && bgmGainNode) {
    const t = audioContext.currentTime;
    bgmGainNode.gain.cancelScheduledValues(t);
    bgmGainNode.gain.setTargetAtTime(0.0001, t, 0.04);
  }

  stopActiveBgmSources();
  bgmPlaying = false;
  emitBgmState();
}

export function setBackgroundMusicEnabled(enabled) {
  bgmEnabled = Boolean(enabled);
  saveAudioPreferences({ bgmEnabled });

  if (!bgmEnabled) {
    stopBackgroundMusic();
    return getBackgroundMusicState();
  }

  // Enabling via UI click should immediately unlock/start if browser permits.
  startBackgroundMusic();

  return getBackgroundMusicState();
}

export function toggleBackgroundMusic() {
  return setBackgroundMusicEnabled(!bgmEnabled);
}

export function getBackgroundMusicState() {
  return {
    enabled: bgmEnabled,
    playing: bgmPlaying,
    unlocked: bgmUnlocked,
  };
}

export function subscribeBackgroundMusic(listener) {
  if (typeof listener !== 'function') {
    return () => { };
  }

  bgmListeners.add(listener);
  listener(getBackgroundMusicState());

  return () => {
    bgmListeners.delete(listener);
  };
}

export function playBell() {
  if (!audioContext || !bellBuffer || !sfxGainNode) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.85;
  source.buffer = bellBuffer;
  source.connect(gainNode);
  gainNode.connect(sfxGainNode);
  source.start(0);

  // Short vibration pulse for haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate([30, 40, 30]);
  }
}

export async function playCountdown(onComplete) {
  const safeComplete = () => {
    if (typeof onComplete === 'function') {
      setTimeout(onComplete, 0);
    }
  };

  if (!audioContext || !sfxGainNode) {
    safeComplete();
    return;
  }

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  } catch (err) {
    console.warn('Audio resume failed in countdown:', err);
  }

  const now = audioContext.currentTime;
  const beepFrequencies = [880, 880, 880, 1760]; // 3 low beeps + 1 high
  const startTimes = [0, 1, 2, 3]; // absolute seconds from now

  // Schedule all beeps immediately using AudioContext time
  // This is much more reliable than setTimeout on mobile
  for (let i = 0; i < 4; i += 1) {
    const buffer = generateBeepBuffer(
      audioContext,
      beepFrequencies[i],
      i === 3 ? 0.4 : 0.2
    );

    try {
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.7;
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(sfxGainNode);
      source.start(now + startTimes[i]);
    } catch (e) {
      console.warn('Failed to schedule beep:', e);
    }
  }

  // Schedule callback exactly when the last beep finishes
  // We use setTimeout here but the caller (useTimer) has a robust fallback loop now
  setTimeout(safeComplete, 3400);
}

export function isInitialized() {
  return initialized;
}
