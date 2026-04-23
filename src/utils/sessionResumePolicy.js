import {
  createExerciseProgress,
  normalizeExerciseProgress,
} from './exerciseProgress.js';
import { buildWorkoutStructureSignature } from './sessionSnapshot.js';

export function getInitialSavedSession(savedSessionState, sessionMinutes, intervalSeconds) {
  if (!savedSessionState || !savedSessionState.sessionActive) return null;

  const timingMatches =
    savedSessionState.sessionDuration === sessionMinutes * 60
    && savedSessionState.intervalDuration === intervalSeconds;

  return { ...savedSessionState, timingMatches };
}

function getSessionFreshnessScore(savedSessionState) {
  if (!savedSessionState || !savedSessionState.sessionActive) return -1;

  const elapsedMs = Number(savedSessionState.elapsedMs);
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
    return elapsedMs;
  }

  const intervalStart = Number(savedSessionState.currentIntervalStartTime);
  if (Number.isFinite(intervalStart) && intervalStart > 0) {
    return intervalStart;
  }

  const sessionStart = Number(savedSessionState.sessionStartTime);
  if (Number.isFinite(sessionStart) && sessionStart > 0) {
    return sessionStart;
  }

  return -1;
}

export function choosePreferredSavedSession(primarySavedSession, secondarySavedSession) {
  const primaryActive = Boolean(primarySavedSession?.sessionActive);
  const secondaryActive = Boolean(secondarySavedSession?.sessionActive);

  if (!primaryActive) return secondaryActive ? secondarySavedSession : null;
  if (!secondaryActive) return primarySavedSession;

  return getSessionFreshnessScore(primarySavedSession) >= getSessionFreshnessScore(secondarySavedSession)
    ? primarySavedSession
    : secondarySavedSession;
}

export function doesWorkoutMatchSavedSession(savedSession, workout) {
  return (savedSession?.workoutId || null) === (workout?.id || null);
}

export function doesWorkoutStructureMatchSavedSession(savedSession, workout, exercises) {
  if (!doesWorkoutMatchSavedSession(savedSession, workout)) {
    return false;
  }

  const savedSignature = typeof savedSession?.workoutStructureSignature === 'string'
    && savedSession.workoutStructureSignature
    ? savedSession.workoutStructureSignature
    : null;

  if (!savedSignature) {
    return true;
  }

  return savedSignature === buildWorkoutStructureSignature(workout, exercises);
}

export function resolveResumeExerciseProgress(savedSession, workout, exercises) {
  if (!doesWorkoutStructureMatchSavedSession(savedSession, workout, exercises)) {
    return createExerciseProgress(exercises);
  }

  return normalizeExerciseProgress(exercises, savedSession?.exerciseProgress);
}
