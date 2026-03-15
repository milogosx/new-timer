import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doesWorkoutMatchSavedSession,
  getInitialSavedSession,
  resolveResumeExerciseProgress,
} from '../src/utils/sessionResumePolicy.js';

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

test('doesWorkoutMatchSavedSession compares workout IDs with timer-only null semantics', () => {
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: 'w1' }, { id: 'w1' }), true);
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: 'w1' }, { id: 'w2' }), false);
  assert.equal(doesWorkoutMatchSavedSession({ workoutId: null }, null), true);
  assert.equal(doesWorkoutMatchSavedSession(null, { id: 'w1' }), false);
});

test('resolveResumeExerciseProgress restores saved checklist progress only when workout identity matches', () => {
  const exercises = [
    { sets: 2 },
    { sets: 3 },
  ];
  const savedSession = {
    workoutId: 'w1',
    exerciseProgress: [
      { completed: true, setsCompleted: [true, true] },
      { completed: false, setsCompleted: [true, false, false] },
    ],
  };

  assert.deepEqual(
    resolveResumeExerciseProgress(savedSession, { id: 'w1' }, exercises),
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
});
