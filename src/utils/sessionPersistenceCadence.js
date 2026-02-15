const DEFAULT_MIN_INTERVAL_MS = 1000;

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function shouldPersistRunningSession({
  lastPersistAtMs,
  nowMs,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
}) {
  const safeNow = Math.max(0, toSafeNumber(nowMs, 0));
  const safeLast = Math.max(0, toSafeNumber(lastPersistAtMs, 0));
  const safeInterval = Math.max(0, toSafeNumber(minIntervalMs, DEFAULT_MIN_INTERVAL_MS));

  if (!safeLast) return true;
  return safeNow - safeLast >= safeInterval;
}
