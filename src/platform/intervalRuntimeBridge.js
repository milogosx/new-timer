import {
  ensurePlaybackReady as ensureBrowserPlaybackReady,
  initAudio as initBrowserAudio,
  manuallyRecoverAudio as manuallyRecoverBrowserAudio,
  playBell as playBrowserBell,
  playCountdown as playBrowserCountdown,
  playSpeechAnnouncement as playBrowserSpeechAnnouncement,
  startAudioKeepAlive as startBrowserAudioKeepAlive,
  stopAudioKeepAlive as stopBrowserAudioKeepAlive,
} from '../utils/audioManager.js';
import { detectNativeShell } from '../config/runtimeConfig.js';
import { traceRuntime } from '../utils/runtimeTrace.js';

const NATIVE_INTERVAL_RUNTIME_PLUGIN = 'EliteTimerRuntime';
const DEFAULT_COUNTDOWN_DURATION_MS = 3400;

let runtimeMuted = false;

export function isRuntimeMuted() {
  return runtimeMuted;
}

export async function setRuntimeMuted(muted, options = {}) {
  runtimeMuted = Boolean(muted);
  traceRuntime('runtime.mute_toggled', { muted: runtimeMuted });
  await invokeNativeIntervalRuntime('setMuted', { muted: runtimeMuted }, options);
  return runtimeMuted;
}

function scheduleDeferredCallback(callback, delayMs) {
  if (typeof callback !== 'function') return;

  const safeDelay = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0;
  const timeoutFn = globalThis.window?.setTimeout?.bind(globalThis.window)
    ?? globalThis.setTimeout?.bind(globalThis);

  if (typeof timeoutFn === 'function') {
    timeoutFn(callback, safeDelay);
    return;
  }

  callback();
}

export function getNativeIntervalRuntimePlugin({
  capacitor = globalThis.window?.Capacitor,
} = {}) {
  const plugin = capacitor?.Plugins?.[NATIVE_INTERVAL_RUNTIME_PLUGIN];
  return plugin && typeof plugin === 'object' ? plugin : null;
}

export function getIntervalRuntimeCapabilities(options = {}) {
  const nativeShell = detectNativeShell(options);
  const nativePlugin = getNativeIntervalRuntimePlugin(options);

  return Object.freeze({
    platform: nativeShell ? 'native-shell' : 'web',
    nativeShell,
    nativePluginAvailable: Boolean(nativePlugin),
    ownsCueScheduling: Boolean(nativeShell && nativePlugin),
  });
}

async function invokeNativeIntervalRuntime(method, payload, options = {}) {
  const plugin = getNativeIntervalRuntimePlugin(options);
  if (!plugin || typeof plugin[method] !== 'function') {
    return { handled: false, value: null };
  }

  try {
    const value = payload === undefined
      ? await plugin[method]()
      : await plugin[method](payload);
    return { handled: true, value };
  } catch (err) {
    traceRuntime('runtime.native_method_failed', { method });
    console.warn(`Native interval runtime method failed: ${method}`, err);
    return { handled: true, value: null };
  }
}

export async function initializeIntervalRuntime(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('prepareRuntime', undefined, options);
  traceRuntime('runtime.prepare', {
    platform: getIntervalRuntimeCapabilities(options).platform,
    nativeHandled: nativeResult.handled,
  });
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return initBrowserAudio();
}

export async function ensureIntervalCueingReady(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('ensureCueingReady', undefined, options);
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return ensureBrowserPlaybackReady();
}

export async function playIntervalCue(options = {}) {
  if (runtimeMuted) return null;
  const nativeResult = await invokeNativeIntervalRuntime('playIntervalCue', undefined, options);
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return playBrowserBell();
}

export async function playCountdownCue(onComplete, options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('playCountdownCue', undefined, options);
  if (nativeResult.handled) {
    const countdownDurationMs = Number(nativeResult.value?.countdownDurationMs);
    traceRuntime('runtime.countdown_cue_scheduled', {
      platform: getIntervalRuntimeCapabilities(options).platform,
      nativeHandled: true,
      countdownDurationMs: countdownDurationMs > 0 ? countdownDurationMs : DEFAULT_COUNTDOWN_DURATION_MS,
    });
    scheduleDeferredCallback(
      onComplete,
      countdownDurationMs > 0 ? countdownDurationMs : DEFAULT_COUNTDOWN_DURATION_MS
    );
    return nativeResult.value;
  }

  traceRuntime('runtime.countdown_cue_scheduled', {
    platform: getIntervalRuntimeCapabilities(options).platform,
    nativeHandled: false,
    countdownDurationMs: DEFAULT_COUNTDOWN_DURATION_MS,
  });
  return playBrowserCountdown(onComplete);
}

export async function playSpeechCue(key, options = {}) {
  if (runtimeMuted) return null;
  const nativeResult = await invokeNativeIntervalRuntime('playSpeechCue', { key }, options);
  const speechFallbackVisible = nativeResult.handled
    && (nativeResult.value == null || nativeResult.value?.speechEnabled === false)
    && globalThis.document?.visibilityState === 'visible';
  traceRuntime('runtime.speech_cue_requested', {
    key,
    platform: getIntervalRuntimeCapabilities(options).platform,
    nativeHandled: nativeResult.handled,
    speechEnabled: nativeResult.value?.speechEnabled ?? null,
    browserFallback: speechFallbackVisible,
  });
  if (speechFallbackVisible) {
    return playBrowserSpeechAnnouncement(key);
  }

  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return playBrowserSpeechAnnouncement(key);
}

export async function startIntervalKeepAlive(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('startKeepAlive', undefined, options);
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return startBrowserAudioKeepAlive();
}

export async function stopIntervalKeepAlive(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('stopKeepAlive', undefined, options);
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return stopBrowserAudioKeepAlive();
}

export async function recoverIntervalCueing(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('recoverCueing', undefined, options);
  if (nativeResult.handled) {
    return nativeResult.value;
  }

  return manuallyRecoverBrowserAudio();
}

export async function mirrorActiveSession(session, options = {}) {
  return invokeNativeIntervalRuntime('upsertSession', session, options);
}

export async function clearMirroredActiveSession(options = {}) {
  return invokeNativeIntervalRuntime('clearSession', undefined, options);
}

export async function readMirroredActiveSession(options = {}) {
  const nativeResult = await invokeNativeIntervalRuntime('readSession', undefined, options);
  if (nativeResult.handled) {
    traceRuntime('runtime.native_session_read', {
      active: Boolean(nativeResult.value?.session?.sessionActive),
      sessionStatus: nativeResult.value?.session?.sessionStatus ?? null,
    });
    return nativeResult.value?.session ?? null;
  }

  return null;
}
