import { shouldPlaySpeechCues } from './timerPhase.js';

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string' && entry);
}

export function buildWorkoutStructureSignature(workout, exercises = []) {
  const normalizedExercises = Array.isArray(exercises)
    ? exercises.map((exercise, index) => {
      const id = typeof exercise?.id === 'string' && exercise.id ? exercise.id : `index:${index}`;
      const sets = Number.isFinite(Number(exercise?.sets)) ? Math.max(0, Number(exercise.sets)) : 0;
      const source = exercise?._isWarmup ? 'warmup' : (exercise?._isCardio ? 'cardio' : 'main');

      return {
        id,
        sets,
        source,
      };
    })
    : [];

  const warmupIds = sanitizeStringArray(workout?.warmupIds);
  const cardioIds = sanitizeStringArray(workout?.cardioIds);

  if (!workout && normalizedExercises.length === 0 && warmupIds.length === 0 && cardioIds.length === 0) {
    return null;
  }

  return JSON.stringify({
    warmupIds,
    cardioIds,
    exercises: normalizedExercises,
  });
}

export function buildSessionMetadata(workout, exerciseProgress, exercises = []) {
  return {
    workoutId: workout?.id || null,
    workoutName: workout?.name || null,
    workoutStructureSignature: buildWorkoutStructureSignature(workout, exercises),
    exerciseProgress,
    speechEnabled: shouldPlaySpeechCues(workout),
  };
}

function sanitizeCoachingSchedule(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const key = typeof entry.key === 'string' && entry.key ? entry.key : null;
    const at = Number(entry.at);
    if (!key || !Number.isFinite(at) || at < 0) continue;
    cleaned.push({ key, at: Math.floor(at) });
  }
  return cleaned.length ? cleaned : null;
}

function sanitizeExerciseProgressEntry(entry) {
  if (!entry || !Array.isArray(entry.setsCompleted)) {
    return {
      completed: false,
      setsCompleted: [],
    };
  }

  const setsCompleted = entry.setsCompleted.map((value) => Boolean(value));

  return {
    completed: setsCompleted.every(Boolean),
    setsCompleted,
  };
}

export function sanitizeSessionMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {
      workoutId: null,
      workoutName: null,
      workoutStructureSignature: null,
      exerciseProgress: null,
      speechEnabled: null,
      coachingSchedule: null,
    };
  }

  return {
    workoutId: typeof metadata.workoutId === 'string' && metadata.workoutId ? metadata.workoutId : null,
    workoutName: typeof metadata.workoutName === 'string' && metadata.workoutName ? metadata.workoutName : null,
    workoutStructureSignature:
      typeof metadata.workoutStructureSignature === 'string' && metadata.workoutStructureSignature
        ? metadata.workoutStructureSignature
        : null,
    exerciseProgress: Array.isArray(metadata.exerciseProgress)
      ? metadata.exerciseProgress.map(sanitizeExerciseProgressEntry)
      : null,
    speechEnabled: typeof metadata.speechEnabled === 'boolean' ? metadata.speechEnabled : null,
    coachingSchedule: sanitizeCoachingSchedule(metadata.coachingSchedule),
  };
}

export function buildSessionSnapshot({
  overrideStatus,
  nowWall,
  sessionStartTime,
  sessionDuration,
  intervalDuration,
  currentIntervalStartTime,
  currentIntervalDuration,
  intervalCount,
  intervalState,
  elapsedMs,
  intervalElapsedMs,
  isQuickAdd,
  metadata,
}) {
  const sessionMetadata = sanitizeSessionMetadata(metadata);

  return {
    sessionActive: true,
    sessionStatus: overrideStatus,
    sessionStartTime,
    sessionDuration,
    intervalDuration,
    currentIntervalStartTime,
    currentIntervalDuration,
    intervalCount,
    intervalState,
    totalPaused: Math.max(0, nowWall - sessionStartTime - elapsedMs),
    intervalPaused: Math.max(0, nowWall - currentIntervalStartTime - intervalElapsedMs),
    elapsedMs,
    intervalElapsedMs,
    isQuickAdd,
    ...sessionMetadata,
  };
}
