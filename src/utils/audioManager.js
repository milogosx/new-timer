let audioContext = null;
let bellBuffer = null;
let initialized = false;

let sfxGainNode = null;
let visibilityListenerBound = false;
let keepAliveIntervalId = null;
// Voice Engine State
const voiceBuffers = {};

function ensureAudioContext() {
  if (initialized && audioContext) return true;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    bellBuffer = generateBellBuffer(audioContext);

    sfxGainNode = audioContext.createGain();
    sfxGainNode.gain.value = 1;
    sfxGainNode.connect(audioContext.destination);

    initialized = true;

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('Audio init failed:', err);
    return false;
  }
}

/**
 * Await AudioContext resume — critical on iOS where the context gets suspended.
 * iOS also has an 'interrupted' state (triggered by phone calls, Siri, etc.)
 * that requires resume() to recover from.
 */
async function ensureResumed() {
  if (!audioContext) return false;
  if (audioContext.state !== 'running') {
    try {
      await audioContext.resume();
    } catch (err) {
      console.warn('AudioContext resume failed:', err);
      return false;
    }
  }
  return audioContext.state === 'running';
}

function bindVisibilityHandling() {
  if (visibilityListenerBound || typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', async () => {
    if (!audioContext) return;
    if (document.visibilityState === 'hidden') return;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  });

  visibilityListenerBound = true;
}

export function initAudio() {
  const ready = ensureAudioContext();
  if (ready) {
    bindVisibilityHandling();
    preloadVoices();
  }
  return ready;
}

async function preloadVoices() {
  if (!audioContext) return;
  const files = [
    'start_warmup',
    'warmup_complete',
    'quarter_way',
    'halfway',
    'three_quarters',
    'five_minutes',
    'one_minute',
    'workout_complete',
  ];

  await Promise.all(
    files.map(async (name) => {
      try {
        const response = await fetch(`/audio/${name}.mp3`);
        const arrayBuffer = await response.arrayBuffer();
        voiceBuffers[name] = await audioContext.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.warn(`Failed to preload voice: ${name}`, err);
      }
    })
  );
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

export async function playBell() {
  if (!audioContext || !bellBuffer || !sfxGainNode) return;

  await ensureResumed();

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.85;
  source.buffer = bellBuffer;
  source.connect(gainNode);
  gainNode.connect(sfxGainNode);
  source.onended = () => {
    try { source.disconnect(); } catch { /* ignore disconnect cleanup failures */ }
    try { gainNode.disconnect(); } catch { /* ignore disconnect cleanup failures */ }
  };
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

/**
 * Request audio ducking via the Audio Session API.
 * Sets type to "transient" which tells iOS to lower other audio (e.g. Spotify).
 * Returns the previous type so it can be restored after playback.
 */
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
  if (!audioContext || !sfxGainNode) return;

  await ensureResumed();

  const buffer = voiceBuffers[key];
  if (!buffer) {
    console.warn('Voice buffer not found for:', key);
    return;
  }

  const prevSessionType = requestDucking();

  try {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(sfxGainNode);
    source.onended = () => {
      try { source.disconnect(); } catch { /* ignore disconnect cleanup failures */ }
      try { gainNode.disconnect(); } catch { /* ignore disconnect cleanup failures */ }
      releaseDucking(prevSessionType);
    };
    source.start(0);
  } catch (err) {
    console.error('Speech playback failed:', err);
    releaseDucking(prevSessionType);
  }
}

/**
 * Play a near-silent buffer to keep the AudioContext alive on iOS.
 * iOS suspends inactive AudioContexts after ~15-30s of silence.
 * Also handles 'interrupted' state which iOS enters after phone calls, Siri, etc.
 */
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
    // Silently ignore — non-critical
  }
}

let keepAliveActive = false;
let lastKeepAliveAt = 0;

/**
 * Start keepalive loop. Call when a timer session starts.
 * Uses setInterval + a visibility-change watchdog. iOS can silently kill
 * setInterval when backgrounded; the watchdog detects this and restarts it
 * whenever the app returns to foreground.
 */
export function startAudioKeepAlive() {
  stopAudioKeepAlive();
  keepAliveActive = true;
  lastKeepAliveAt = Date.now();
  playKeepAlive();
  keepAliveIntervalId = setInterval(() => {
    lastKeepAliveAt = Date.now();
    playKeepAlive();
  }, 15_000);
}

/** Stop keepalive loop. Call when a timer session ends. */
export function stopAudioKeepAlive() {
  keepAliveActive = false;
  if (keepAliveIntervalId !== null) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
}

/**
 * Watchdog: when app returns to foreground, check if the keepalive interval
 * is still alive. If it stopped (gap > 20s), restart it.
 */
function keepAliveWatchdog() {
  if (!keepAliveActive) return;
  const gap = Date.now() - lastKeepAliveAt;
  if (gap > 20_000) {
    // setInterval was killed — restart
    if (keepAliveIntervalId !== null) clearInterval(keepAliveIntervalId);
    lastKeepAliveAt = Date.now();
    playKeepAlive();
    keepAliveIntervalId = setInterval(() => {
      lastKeepAliveAt = Date.now();
      playKeepAlive();
    }, 15_000);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAliveWatchdog();
    }
  });
}
