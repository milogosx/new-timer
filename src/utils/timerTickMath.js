import { getNextCircleColor } from './timerLogic';

export function advanceIntervalState({
  intervalElapsedMs,
  activeDurationMs,
  intervalCount,
  circleColor,
  currentIntervalDurationSec,
  defaultIntervalSec,
  maxCompletionsPerTick = 2048,
}) {
  let nextIntervalElapsedMs = intervalElapsedMs;
  let nextActiveDurationMs = activeDurationMs;
  let nextIntervalCount = intervalCount;
  let nextCircleColor = circleColor;
  let nextDurationSec = currentIntervalDurationSec;
  let completions = 0;

  while (
    nextIntervalElapsedMs >= nextActiveDurationMs
    && completions < maxCompletionsPerTick
  ) {
    nextIntervalElapsedMs -= nextActiveDurationMs;
    completions += 1;
    nextIntervalCount += 1;
    nextCircleColor = getNextCircleColor(nextCircleColor, false);
    nextDurationSec = defaultIntervalSec;
    nextActiveDurationMs = Math.max(1, nextDurationSec * 1000);
  }

  return {
    intervalElapsedMs: nextIntervalElapsedMs,
    activeDurationMs: nextActiveDurationMs,
    intervalCount: nextIntervalCount,
    circleColor: nextCircleColor,
    currentIntervalDurationSec: nextDurationSec,
    completions,
  };
}
