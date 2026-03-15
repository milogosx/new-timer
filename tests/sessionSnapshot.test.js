import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionMetadata,
  buildSessionSnapshot,
  sanitizeSessionMetadata,
} from '../src/utils/sessionSnapshot.js';

test('buildSessionMetadata keeps the persisted session boundary limited to workout identity and checklist progress', () => {
  assert.deepEqual(
    buildSessionMetadata(
      { id: 'w1', name: 'Leg Day', type: 'strength' },
      [{ completed: true, setsCompleted: [true, true] }]
    ),
    {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      exerciseProgress: [{ completed: true, setsCompleted: [true, true] }],
    }
  );
});

test('sanitizeSessionMetadata strips unsupported fields and normalizes checklist entries', () => {
  assert.deepEqual(
    sanitizeSessionMetadata({
      workoutId: 'w1',
      workoutName: 'Leg Day',
      exerciseProgress: [
        { completed: false, setsCompleted: [1, 0, 'yes'] },
        { completed: true, setsCompleted: 'invalid' },
      ],
      unexpected: 'drop-me',
    }),
    {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      exerciseProgress: [
        { completed: false, setsCompleted: [true, false, true] },
        { completed: false, setsCompleted: [] },
      ],
    }
  );
});

test('buildSessionSnapshot persists only the sanitized session metadata boundary', () => {
  const snapshot = buildSessionSnapshot({
    overrideStatus: 'running',
    nowWall: 2_000,
    sessionStartTime: 1_000,
    sessionDuration: 3_600,
    intervalDuration: 30,
    currentIntervalStartTime: 1_500,
    currentIntervalDuration: 30,
    intervalCount: 2,
    intervalState: 'teal',
    elapsedMs: 800,
    intervalElapsedMs: 300,
    isQuickAdd: false,
    metadata: {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      exerciseProgress: [{ completed: true, setsCompleted: [true, true] }],
      arbitrary: 'ignore-me',
    },
  });

  assert.equal(snapshot.sessionActive, true);
  assert.equal(snapshot.sessionStatus, 'running');
  assert.equal(snapshot.workoutId, 'w1');
  assert.equal(snapshot.workoutName, 'Leg Day');
  assert.deepEqual(snapshot.exerciseProgress, [
    { completed: true, setsCompleted: [true, true] },
  ]);
  assert.equal('arbitrary' in snapshot, false);
});
