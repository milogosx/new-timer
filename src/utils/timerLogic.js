// Timestamp-based timer calculations
// Runtime ticking now uses monotonic clock in the hook, while this module
// keeps deterministic helpers and backward-compatible resume derivation.

function normalizeEpochMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  // Legacy bug compatibility: some old payloads stored epoch values in seconds.
  if (parsed > 1_000_000_000 && parsed < 100_000_000_000) {
    return parsed * 1000;
  }
  return parsed;
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function calculateElapsed(startTimestamp, pausedDuration = 0) {
  const startMs = normalizeEpochMs(startTimestamp);
  if (!startMs) return 0;
  const pausedMs = Math.max(0, toSafeNumber(pausedDuration, 0));
  return Math.floor((Date.now() - startMs - pausedMs) / 1000);
}

export function calculateIntervalRemaining(intervalStartTimestamp, intervalDuration, pausedDuration = 0) {
  const startMs = normalizeEpochMs(intervalStartTimestamp);
  if (!startMs) return intervalDuration;
  const pausedMs = Math.max(0, toSafeNumber(pausedDuration, 0));
  const elapsed = Math.floor((Date.now() - startMs - pausedMs) / 1000);
  const remaining = intervalDuration - elapsed;
  return Math.max(0, remaining);
}

export function formatTime(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function calculateTotalIntervals(sessionDurationSeconds, intervalDurationSeconds) {
  if (!intervalDurationSeconds) return 0;
  return Math.ceil(sessionDurationSeconds / intervalDurationSeconds);
}

export function getNextCircleColor(currentColor) {
  if (currentColor === 'rest') return 'black';
  return currentColor === 'teal' ? 'black' : 'teal';
}

export function deriveResumedIntervalState(savedState, now = Date.now()) {
  const nowMs = normalizeEpochMs(now) || Date.now();

  const defaultIntervalDuration = Math.max(0, toSafeNumber(savedState.intervalDuration, 0));
  const savedIntervalDuration = Math.max(
    0,
    toSafeNumber(savedState.currentIntervalDuration, defaultIntervalDuration)
  );

  const intervalCountBase = Math.max(0, Math.floor(toSafeNumber(savedState.intervalCount, 0)));
  const totalPausedMs = Math.max(0, toSafeNumber(savedState.totalPaused, 0));
  const intervalPausedMs = Math.max(0, toSafeNumber(savedState.intervalPaused, 0));

  const sessionStartMs = normalizeEpochMs(savedState.sessionStartTime);
  const intervalStartMs = normalizeEpochMs(savedState.currentIntervalStartTime);

  const elapsedMsFromState = toSafeNumber(savedState.elapsedMs, -1);
  const intervalElapsedMsFromState = toSafeNumber(savedState.intervalElapsedMs, -1);

  const elapsedMs = elapsedMsFromState >= 0
    ? elapsedMsFromState
    : Math.max(0, nowMs - (sessionStartMs || nowMs) - totalPausedMs);

  const intervalElapsed = intervalElapsedMsFromState >= 0
    ? Math.max(0, intervalElapsedMsFromState / 1000)
    : Math.max(0, (nowMs - (intervalStartMs || nowMs) - intervalPausedMs) / 1000);

  let intervalsPassed = 0;
  let timeIntoCurrentInterval = 0;
  let currentIntervalDuration = savedIntervalDuration;
  let isQuickAdd = Boolean(savedState.isQuickAdd);

  if (isQuickAdd) {
    if (intervalElapsed < savedIntervalDuration) {
      timeIntoCurrentInterval = intervalElapsed;
      currentIntervalDuration = savedIntervalDuration;
    } else {
      const elapsedAfterQuickAdd = intervalElapsed - savedIntervalDuration;
      intervalsPassed = 1;
      isQuickAdd = false;

      if (defaultIntervalDuration > 0) {
        intervalsPassed += Math.floor(elapsedAfterQuickAdd / defaultIntervalDuration);
        timeIntoCurrentInterval = elapsedAfterQuickAdd % defaultIntervalDuration;
        currentIntervalDuration = defaultIntervalDuration;
      } else {
        timeIntoCurrentInterval = 0;
        currentIntervalDuration = 0;
      }
    }
  } else if (defaultIntervalDuration > 0) {
    intervalsPassed = Math.floor(intervalElapsed / defaultIntervalDuration);
    timeIntoCurrentInterval = intervalElapsed % defaultIntervalDuration;
    currentIntervalDuration = defaultIntervalDuration;
  }

  let intervalState = savedState.intervalState === 'teal' ? 'teal' : savedState.intervalState === 'rest' ? 'rest' : 'black';
  for (let i = 0; i < intervalsPassed; i += 1) {
    intervalState = getNextCircleColor(intervalState, false);
  }

  return {
    elapsed: Math.floor(elapsedMs / 1000),
    intervalCount: intervalCountBase + intervalsPassed,
    intervalState,
    intervalRemaining:
      currentIntervalDuration > 0
        ? Math.max(0, Math.ceil(currentIntervalDuration - timeIntoCurrentInterval))
        : 0,
    currentIntervalDuration,
    isQuickAdd,
    timeIntoCurrentInterval,
  };
}
