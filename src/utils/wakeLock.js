let wakeLock = null;

export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');

      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });

      // Re-acquire on visibility change
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return true;
    } else {
      console.warn('Wake Lock API not supported');
      return false;
    }
  } catch (err) {
    console.error('Wake Lock failed:', err);
    return false;
  }
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && wakeLock !== null) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.error('Wake Lock re-acquire failed:', err);
    }
  }
}

export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

export function isWakeLockActive() {
  return wakeLock !== null && !wakeLock.released;
}

export function isWakeLockSupported() {
  return 'wakeLock' in navigator;
}
