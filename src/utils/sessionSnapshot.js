export function buildSessionMetadata(workout, exerciseProgress) {
  return {
    workoutId: workout?.id || null,
    workoutName: workout?.name || null,
    exerciseProgress,
  };
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
      exerciseProgress: null,
    };
  }

  return {
    workoutId: typeof metadata.workoutId === 'string' && metadata.workoutId ? metadata.workoutId : null,
    workoutName: typeof metadata.workoutName === 'string' && metadata.workoutName ? metadata.workoutName : null,
    exerciseProgress: Array.isArray(metadata.exerciseProgress)
      ? metadata.exerciseProgress.map(sanitizeExerciseProgressEntry)
      : null,
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
