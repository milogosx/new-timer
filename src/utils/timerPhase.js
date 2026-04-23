import { WARMUP_COACH_KEYS, WORKOUT_COACH_KEYS } from './speechCueCatalog.js';

export const FIXED_WARMUP_PHASE_DURATION_SEC = 15 * 60;

export const COACHING_CADENCE_SEC = 120;
export const COACHING_JITTER_SEC = 30;
export const COACHING_DEADZONE_SEC = 20;

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(source, rand) {
  const arr = source.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shouldPlaySpeechCues(workout) {
  return Boolean(workout);
}

export function getSessionPhase(elapsedSeconds, sessionMinutes) {
  const totalSessionSeconds = Math.max(0, Number(sessionMinutes) * 60 || 0);
  const warmupBoundarySec = Math.min(FIXED_WARMUP_PHASE_DURATION_SEC, totalSessionSeconds);
  const isWarmupPhase = elapsedSeconds < warmupBoundarySec;

  return {
    totalSessionSeconds,
    warmupBoundarySec,
    isWarmupPhase,
    phaseLabel: isWarmupPhase ? 'WARM UP' : 'WORKOUT',
  };
}

export function getSpeechMilestones(sessionMinutes) {
  const { totalSessionSeconds, warmupBoundarySec } = getSessionPhase(0, sessionMinutes);

  return [
    { key: 'start_warmup', at: 1, guard: totalSessionSeconds > 0 },
    { key: 'warmup_complete', at: warmupBoundarySec, guard: totalSessionSeconds > warmupBoundarySec },
    {
      key: 'quarter_way',
      at: Math.floor(totalSessionSeconds * 0.25),
      guard: Math.floor(totalSessionSeconds * 0.25) > warmupBoundarySec,
    },
    {
      key: 'halfway',
      at: Math.floor(totalSessionSeconds / 2),
      guard: Math.floor(totalSessionSeconds / 2) > warmupBoundarySec,
    },
    {
      key: 'three_quarters',
      at: Math.floor(totalSessionSeconds * 0.75),
      guard: Math.floor(totalSessionSeconds * 0.75) > warmupBoundarySec,
    },
    {
      key: 'five_minutes',
      at: totalSessionSeconds - 300,
      guard: totalSessionSeconds - 300 > warmupBoundarySec,
    },
    {
      key: 'one_minute',
      at: totalSessionSeconds - 60,
      guard: totalSessionSeconds - 60 > warmupBoundarySec,
    },
    { key: 'workout_complete', at: totalSessionSeconds, guard: totalSessionSeconds > 0 },
  ];
}

export function buildCoachingSchedule(sessionMinutes, seed) {
  const { totalSessionSeconds, warmupBoundarySec } = getSessionPhase(0, sessionMinutes);
  if (totalSessionSeconds <= 0) return [];

  const numericSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : Date.now();
  const rand = mulberry32(numericSeed || 1);

  const structuralTimes = getSpeechMilestones(sessionMinutes)
    .filter((m) => m.guard !== false)
    .map((m) => m.at);

  const isNearStructural = (t) =>
    structuralTimes.some((st) => Math.abs(st - t) < COACHING_DEADZONE_SEC);

  const warmupPool = shuffled(WARMUP_COACH_KEYS, rand);
  const workoutPool = shuffled(WORKOUT_COACH_KEYS, rand);

  const schedule = [];
  let warmupIdx = 0;
  let workoutIdx = 0;
  let t = COACHING_CADENCE_SEC + (rand() - 0.5) * 2 * COACHING_JITTER_SEC;

  while (t < totalSessionSeconds) {
    const at = Math.floor(t);
    if (at >= COACHING_DEADZONE_SEC && !isNearStructural(at)) {
      const inWarmup = at < warmupBoundarySec;
      let key;
      if (inWarmup) {
        key = warmupPool[warmupIdx % warmupPool.length];
        warmupIdx += 1;
      } else {
        key = workoutPool[workoutIdx % workoutPool.length];
        workoutIdx += 1;
      }
      schedule.push({ key, at, guard: true });
    }
    t += COACHING_CADENCE_SEC + (rand() - 0.5) * 2 * COACHING_JITTER_SEC;
  }

  return schedule;
}
