export function getInitialSavedSession(savedSessionState, sessionMinutes, intervalSeconds) {
  if (!savedSessionState || !savedSessionState.sessionActive) return null;

  const timingMatches =
    savedSessionState.sessionDuration === sessionMinutes * 60
    && savedSessionState.intervalDuration === intervalSeconds;

  return { ...savedSessionState, timingMatches };
}

export function doesWorkoutMatchSavedSession(savedSession, workout) {
  return (savedSession?.workoutId || null) === (workout?.id || null);
}
