let audioContext = null;
let bellBuffer = null;
let initialized = false;
let bellBufferIsAsset = false;
let bellLoadPromise = null;

let sfxGainNode = null;
let visibilityListenerBound = false;
let keepAliveIntervalId = null;
let keepAliveActive = false;
let lastKeepAliveAt = 0;
let nextPlaybackId = 0;

const PLAYBACK_STALL_GRACE_MS = 2_000;
const RESUME_ATTEMPT_TIMEOUT_MS = 250;
const KEEPALIVE_INTERVAL_MS = 15_000;
const KEEPALIVE_WATCHDOG_MS = 20_000;
const activePlaybacks = new Map();
const BELL_ASSET_PATH = '/audio/interval_bell.wav';

import { STRUCTURAL_CUE_KEYS, SPEECH_ASSET_EXTENSION } from './speechCueCatalog.js';

// Preload structural cues upfront on audio init; coaching cues lazy-load on demand
// to avoid a ~12MB preload cost on web/PWA startup.
const VOICE_FILES = STRUCTURAL_CUE_KEYS;

const voiceBuffers = {};
const voiceLoadPromises = {};
let voicePreloadPromise = null;

function disconnectNode(node) {
  if (!node) return;
  try {
    node.disconnect();
  } catch {
    // ignore disconnect cleanup failures
  }
}

function clearVoiceState() {
  voicePreloadPromise = null;

  Object.keys(voiceBuffers).forEach((key) => {
    delete voiceBuffers[key];
  });
  Object.keys(voiceLoadPromises).forEach((key) => {
    delete voiceLoadPromises[key];
  });
}

function resetPlaybackTracking() {
  activePlaybacks.clear();
  nextPlaybackId = 0;
}

function resetAudioGraph({ preserveContext = false } = {}) {
  initialized = false;
  if (!preserveContext) {
    audioContext = null;
  }
  bellBuffer = null;
  bellBufferIsAsset = false;
  bellLoadPromise = null;
  disconnectNode(sfxGainNode);
  sfxGainNode = null;
  resetPlaybackTracking();
  clearVoiceState();
}

function initializeAudioGraph(context) {
  bellBuffer = generateBellBuffer(context);
  bellBufferIsAsset = false;

  sfxGainNode = context.createGain();
  sfxGainNode.gain.value = 1;
  sfxGainNode.connect(context.destination);

  initialized = true;
  void preloadBellBuffer(context);
}

async function preloadBellBuffer(context = audioContext) {
  if (!context || bellBufferIsAsset) return bellBuffer;

  if (!bellLoadPromise) {
    const loadContext = context;
    bellLoadPromise = fetch(BELL_ASSET_PATH)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => loadContext.decodeAudioData(arrayBuffer))
      .then((decodedBuffer) => {
        if (
          decodedBuffer
          && audioContext === loadContext
          && loadContext.state !== 'closed'
        ) {
          bellBuffer = decodedBuffer;
          bellBufferIsAsset = true;
        }
        return decodedBuffer;
      })
      .catch((err) => {
        console.warn('Failed to load bell asset:', err);
        return null;
      })
      .finally(() => {
        bellLoadPromise = null;
      });
  }

  return bellLoadPromise;
}

function registerPlayback(kind, durationMs) {
  nextPlaybackId += 1;
  const startedAt = Date.now();
  const entry = {
    id: `${kind}-${startedAt}-${nextPlaybackId}`,
    expectedEndAt: startedAt + durationMs,
  };
  activePlaybacks.set(entry.id, entry);
  return entry;
}

function finishPlayback(entry) {
  if (!entry) return;
  activePlaybacks.delete(entry.id);
}

function getStalledPlaybacks() {
  const now = Date.now();
  return Array.from(activePlaybacks.values()).filter((entry) => {
    return now > entry.expectedEndAt + PLAYBACK_STALL_GRACE_MS;
  });
}

async function closeAudioContext(contextToClose = audioContext) {
  if (!contextToClose || contextToClose.state === 'closed') return;

  try {
    await contextToClose.close();
  } catch (err) {
    console.warn('AudioContext close failed:', err);
  }
}

async function rebuildAudioGraph({ preserveContext = Boolean(audioContext && audioContext.state !== 'closed') } = {}) {
  if (preserveContext && audioContext && audioContext.state !== 'closed') {
    const existingContext = audioContext;
    resetAudioGraph({ preserveContext: true });

    try {
      initializeAudioGraph(existingContext);
      return;
    } catch (err) {
      console.warn('In-place audio graph rebuild failed:', err);
      resetAudioGraph({ preserveContext: true });
    }
  }

  const contextToClose = audioContext;
  resetAudioGraph();
  await closeAudioContext(contextToClose);
}

function ensureAudioContext() {
  if (initialized && audioContext && bellBuffer && sfxGainNode) return true;

  try {
    const needsNewContext = !audioContext || audioContext.state === 'closed';
    if (needsNewContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    initializeAudioGraph(audioContext);

    if (audioContext?.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('Audio init failed:', err);
    resetAudioGraph({ preserveContext: Boolean(audioContext && audioContext.state !== 'closed') });
    return false;
  }
}

async function ensureResumed() {
  if (!audioContext) return false;
  if (audioContext.state === 'running') return true;

  try {
    const resumePromise = Promise.resolve(audioContext.resume()).catch((err) => {
      console.warn('AudioContext resume failed:', err);
      return null;
    });
    await Promise.race([
      resumePromise,
      new Promise((resolve) => setTimeout(resolve, RESUME_ATTEMPT_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.warn('AudioContext resume failed:', err);
    return false;
  }

  return audioContext.state === 'running';
}

export async function ensurePlaybackReady() {
  const stalledPlaybacks = getStalledPlaybacks();
  if (stalledPlaybacks.length > 0) {
    await rebuildAudioGraph();
  }

  if (audioContext?.state === 'closed') {
    resetAudioGraph();
  }

  if (!audioContext || !bellBuffer || !sfxGainNode) {
    if (!ensureAudioContext()) {
      return false;
    }
  }

  let ready = await ensureResumed();
  if (ready || audioContext?.state !== 'closed') {
    return ready;
  }

  resetAudioGraph();
  if (!ensureAudioContext()) {
    return false;
  }

  ready = await ensureResumed();
  return ready;
}

function bindVisibilityHandling() {
  if (visibilityListenerBound || typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') return;
    void ensurePlaybackReady();
  });

  visibilityListenerBound = true;
}

export function initAudio() {
  const ready = ensureAudioContext();
  if (ready) {
    bindVisibilityHandling();
    void preloadVoices();
  }
  return ready;
}

async function loadVoiceBuffer(name) {
  if (voiceBuffers[name]) return voiceBuffers[name];
  if (!audioContext) return null;
  if (!voiceLoadPromises[name]) {
    voiceLoadPromises[name] = fetch(`/audio/${name}.${SPEECH_ASSET_EXTENSION}`)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => {
        if (!audioContext) {
          throw new Error('AudioContext unavailable during voice decode');
        }
        return audioContext.decodeAudioData(arrayBuffer);
      })
      .then((buffer) => {
        voiceBuffers[name] = buffer;
        return buffer;
      })
      .catch((err) => {
        console.warn(`Failed to preload voice: ${name}`, err);
        delete voiceLoadPromises[name];
        return null;
      });
  }

  return voiceLoadPromises[name];
}

async function preloadVoices() {
  if (!audioContext) return;
  if (!voicePreloadPromise) {
    voicePreloadPromise = Promise.allSettled(
      VOICE_FILES.map((name) => loadVoiceBuffer(name))
    ).finally(() => {
      voicePreloadPromise = null;
    });
  }
  await voicePreloadPromise;
}

function generateBellBuffer(ctx) {
  const sampleRate = ctx.sampleRate;
  const duration = 0.7;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);

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

function playBuffer(buffer, {
  gain = 1,
  playback = null,
  onEnded = null,
} = {}) {
  if (!audioContext || !sfxGainNode) return false;

  try {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = gain;
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(sfxGainNode);
    source.onended = () => {
      disconnectNode(source);
      disconnectNode(gainNode);
      finishPlayback(playback);
      if (typeof onEnded === 'function') {
        onEnded();
      }
    };
    source.start(0);
    return true;
  } catch (err) {
    finishPlayback(playback);
    if (typeof onEnded === 'function') {
      onEnded();
    }
    console.warn('Audio playback failed:', err);
    return false;
  }
}

function playRecoveryTone() {
  if (!audioContext) return false;
  const buffer = generateBeepBuffer(audioContext, 1320, 0.16);
  return playBuffer(buffer, { gain: 0.22 });
}

export async function playBell() {
  if (!await ensurePlaybackReady()) return;
  if (!bellBufferIsAsset) {
    await preloadBellBuffer();
  }
  if (!audioContext || !bellBuffer || !sfxGainNode) return;

  const playback = registerPlayback('bell', 1_200);
  const started = playBuffer(bellBuffer, {
    gain: 0.85,
    playback,
  });
  if (!started) return;

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

  if (!await ensurePlaybackReady()) {
    safeComplete();
    return;
  }

  if (!audioContext || !sfxGainNode) {
    safeComplete();
    return;
  }

  const now = audioContext.currentTime;
  const beepFrequencies = [880, 880, 880, 1760];
  const startTimes = [0, 1, 2, 3];

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
    } catch (err) {
      console.warn('Failed to schedule countdown beep:', err);
    }
  }

  setTimeout(safeComplete, 3400);
}

function requestDucking() {
  if (!navigator.audioSession) return null;
  try {
    const prev = navigator.audioSession.type;
    navigator.audioSession.type = 'transient';
    return prev;
  } catch {
    return null;
  }
}

function releaseDucking(prevType) {
  if (!navigator.audioSession || prevType == null) return;
  try {
    navigator.audioSession.type = prevType;
  } catch {
    // ignore
  }
}

export async function playSpeechAnnouncement(key) {
  if (!await ensurePlaybackReady()) return;
  if (!audioContext || !sfxGainNode) return;

  const buffer = await loadVoiceBuffer(key);
  if (!buffer) {
    console.warn('Voice buffer not found for:', key);
    return;
  }

  const prevSessionType = requestDucking();
  let duckingReleased = false;
  const releaseSpeechDucking = () => {
    if (duckingReleased) return;
    duckingReleased = true;
    releaseDucking(prevSessionType);
  };

  const playback = registerPlayback('speech', Math.ceil(buffer.duration * 1000) + 2_000);
  const started = playBuffer(buffer, {
    gain: 1,
    playback,
    onEnded: releaseSpeechDucking,
  });

  if (!started) {
    releaseSpeechDucking();
  }
}

function playKeepAlive() {
  if (!audioContext || audioContext.state === 'closed') return;
  if (audioContext.state !== 'running') {
    audioContext.resume().catch(() => {});
  }
  try {
    const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch {
    // non-critical keepalive failure
  }
}

async function pulseKeepAlive() {
  const ready = await ensurePlaybackReady();
  if (!ready) return false;

  lastKeepAliveAt = Date.now();
  playKeepAlive();
  return true;
}

export function startAudioKeepAlive() {
  stopAudioKeepAlive();
  keepAliveActive = true;
  void pulseKeepAlive();
  keepAliveIntervalId = setInterval(() => {
    void pulseKeepAlive();
  }, KEEPALIVE_INTERVAL_MS);
}

export function stopAudioKeepAlive() {
  keepAliveActive = false;
  if (keepAliveIntervalId !== null) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
}

function keepAliveWatchdog() {
  if (!keepAliveActive) return;
  const gap = Date.now() - lastKeepAliveAt;
  if (gap <= KEEPALIVE_WATCHDOG_MS) return;

  if (keepAliveIntervalId !== null) {
    clearInterval(keepAliveIntervalId);
  }
  void pulseKeepAlive();
  keepAliveIntervalId = setInterval(() => {
    void pulseKeepAlive();
  }, KEEPALIVE_INTERVAL_MS);
}

export async function manuallyRecoverAudio() {
  if (!ensureAudioContext()) return false;

  await rebuildAudioGraph();
  if (!ensureAudioContext()) return false;

  let ready = await ensureResumed();
  if (!ready) {
    const contextToClose = audioContext;
    resetAudioGraph();
    await closeAudioContext(contextToClose);
    if (!ensureAudioContext()) return false;
    ready = await ensureResumed();
  }

  if (!ready) return false;

  void preloadVoices();
  playRecoveryTone();
  return true;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAliveWatchdog();
    }
  });
}
