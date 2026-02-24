import NoSleep from 'nosleep.js';

let wakeLock = null;
let noSleep = null;
let noSleepEnabled = false;
let keepAwakeRequested = false;
let visibilityListenerBound = false;

function hasNativeWakeLock() {
  return typeof navigator !== 'undefined' && typeof navigator.wakeLock?.request === 'function';
}

function hasNoSleepFallback() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getNoSleep() {
  if (!noSleep) {
    noSleep = new NoSleep();
  }
  return noSleep;
}

function bindVisibilityListener() {
  if (visibilityListenerBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerBound = true;
}

function unbindVisibilityListener() {
  if (!visibilityListenerBound || typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerBound = false;
}

async function requestNativeWakeLock() {
  if (!hasNativeWakeLock()) return false;
  if (wakeLock && !wakeLock.released) return true;

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', handleWakeLockRelease);
    return true;
  } catch (err) {
    console.error('Wake Lock API request failed:', err);
    return false;
  }
}

async function requestNoSleepFallback() {
  if (!hasNoSleepFallback()) return false;

  try {
    await getNoSleep().enable();
    noSleepEnabled = true;
    return true;
  } catch (err) {
    console.error('NoSleep fallback request failed:', err);
    return false;
  }
}

function disableNoSleepFallback() {
  if (!noSleep) {
    noSleepEnabled = false;
    return;
  }

  try {
    noSleep.disable();
  } catch (err) {
    console.error('NoSleep fallback release failed:', err);
  }
  noSleepEnabled = false;
}

export async function requestWakeLock() {
  keepAwakeRequested = true;
  bindVisibilityListener();

  const nativeAcquired = await requestNativeWakeLock();
  if (nativeAcquired) {
    disableNoSleepFallback();
    return true;
  }

  return requestNoSleepFallback();
}

function handleWakeLockRelease() {
  wakeLock = null;
  if (keepAwakeRequested && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void requestWakeLock();
  }
}

function handleVisibilityChange() {
  if (!keepAwakeRequested || typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') {
    void requestWakeLock();
  }
}

export function releaseWakeLock() {
  keepAwakeRequested = false;

  if (wakeLock !== null) {
    void wakeLock.release();
    wakeLock = null;
  }

  disableNoSleepFallback();
  unbindVisibilityListener();
}

export function isWakeLockActive() {
  return (wakeLock !== null && !wakeLock.released) || noSleepEnabled;
}

export function isWakeLockSupported() {
  return hasNativeWakeLock() || hasNoSleepFallback();
}
