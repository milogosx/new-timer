let wakeLock = null;
let visibilityListenerBound = false;

export async function requestWakeLock() {
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return false;
    }

    if (wakeLock && !wakeLock.released) {
      return true;
    }

    wakeLock = await navigator.wakeLock.request('screen');

    wakeLock.addEventListener('release', handleWakeLockRelease);

    // Re-acquire on visibility change.
    if (!visibilityListenerBound) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      visibilityListenerBound = true;
    }

    return true;
  } catch (err) {
    console.error('Wake Lock failed:', err);
    return false;
  }
}

function handleWakeLockRelease() {
  wakeLock = null;
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    await requestWakeLock();
  }
}

export function releaseWakeLock() {
  if (wakeLock !== null) {
    void wakeLock.release();
    wakeLock = null;
  }
  if (visibilityListenerBound) {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerBound = false;
  }
}

export function isWakeLockActive() {
  return wakeLock !== null && !wakeLock.released;
}

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}
