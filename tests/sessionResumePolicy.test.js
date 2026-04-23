import test from 'node:test';
import assert from 'node:assert/strict';
import {
  choosePreferredSavedSession,
  doesWorkoutStructureMatchSavedSession,
  doesWorkoutMatchSavedSession,
  getInitialSavedSession,
  resolveResumeExerciseProgress,
} from '../src/utils/sessionResumePolicy.js';
import { buildWorkoutStructureSignature } from '../src/utils/sessionSnapshot.js';

test('getInitialSavedSession returns null for missing or inactive sessions', () => {
  assert.equal(getInitialSavedSession(null, 60, 30), null);
  assert.equal(
    getInitialSavedSession({ sessionActive: false }, 60, 30),
    null
  );
});

test('getInitialSavedSession annotates timingMatches when durations align', () => {
  const saved = {
    sessionActive: true,
    sessionDuration: 3600,
    intervalDuration: 30,
    workoutId: 'w1',
  };
  const result = getInitialSavedSession(saved, 60, 30);
  assert.equal(result?.timingMatches, true);
  assert.equal(result?.workoutId, 'w1');
});

test('getInitialSavedSession marks timing mismatch when session config differs', () => {
  const saved = {
    sessionActive: true,
    sessionDuration: 3000,
    intervalDuration: 45,
  };
  const result = getInitialSavedSession(saved, 60, 30);
  assert.equal(result?.timingMatches, false);
});

test('choosePreferredSavedSession prefers the fresher active snapshot', () => {
  const localSession = {
    sessionActive: true,
    elapsedMs: 15_000,
    sessionStartTime: 1_000,
  };
  const nativeSession = {
    sessionActive: true,
    elapsedMs: 45_000,
    sessionStartTime: 1_000,
  };

  assert.deepEqual(
    choosePreferredSavedSession(localSession, nativeSession),
    nativeSession
  );
});

test('choosePreferredSavedSession falls back cleanly when only one session is active', () => {
  const localSession = {
    sessionActive: true,
    elapsedMs: 10_000,
  };

  assert.deepEqual(choosePreferredSavedSession(localSession, null), localSession);
  assert.equal(choosePreferredSavedSession(null, null), null);
});

test('doesWorkoutMatchSavedSession compares workout IDs with timer-only null semantics', () => {
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: 'w1' }, { id: 'w1' }), true);
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: 'w1' }, { id: 'w2' }), false);
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: null }, null), true);
  assert.equal(doesWorkoutMatchSavedSession(null, { id: 'w1' }), false);
});

test('doesWorkoutStructureMatchSavedSession treats legacy sessions without a structure signature as compatible', () => {
  assert.equal(
    doesWorkoutStructureMatchSavedSession(
      { workoutId: 'w1' },
      { id: 'w1' },
      [{ id: 'main-ex-1', sets: 2 }]
    ),
    true
  );
});

test('resolveResumeExerciseProgress restores saved checklist progress only when workout identity and structure match', () => {
  const workout = {
    id: 'w1',
    warmupIds: ['wu1'],
    cardioIds: [],
  };
  const exercises = [
    { id: 'wu-ex-1', sets: 2, _isWarmup: true },
    { id: 'main-ex-1', sets: 3 },
  ];
  const savedSession = {
    workoutId: 'w1',
    workoutStructureSignature: buildWorkoutStructureSignature(workout, exercises),
    exerciseProgress: [
      { completed: true, setsCompleted: [true, true] },
      { completed: false, setsCompleted: [true, false, false] },
    ],
  };

  assert.deepEqual(
    resolveResumeExerciseProgress(savedSession, workout, exercises),
    [
      { completed: true, setsCompleted: [true, true] },
      { completed: false, setsCompleted: [true, false, false] },
    ]
  );

  assert.deepEqual(
    resolveResumeExerciseProgress(savedSession, { id: 'w2' }, exercises),
    [
      { completed: false, setsCompleted: [false, false] },
      { completed: false, setsCompleted: [false, false, false] },
    ]
  );

  assert.deepEqual(
    resolveResumeExerciseProgress(
      savedSession,
      workout,
      [
        { id: 'wu-ex-1', sets: 2, _isWarmup: true },
        { id: 'main-ex-1', sets: 4 },
      ]
    ),
    [
      { completed: false, setsCompleted: [false, false] },
      { completed: false, setsCompleted: [false, false, false, false] },
    ]
  );
});
