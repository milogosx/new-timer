import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionMetadata,
  buildSessionSnapshot,
  buildWorkoutStructureSignature,
  sanitizeSessionMetadata,
} from '../src/utils/sessionSnapshot.js';

test('buildWorkoutStructureSignature captures ordered exercise structure for attached routines and main exercises', () => {
  assert.equal(
    buildWorkoutStructureSignature(
      { warmupIds: ['wu1'], cardioIds: ['cd1'] },
      [
        { id: 'wu-ex-1', sets: 2, _isWarmup: true },
        { id: 'cd-ex-1', sets: 1, _isCardio: true },
        { id: 'main-ex-1', sets: 3 },
      ]
    ),
    JSON.stringify({
      warmupIds: ['wu1'],
      cardioIds: ['cd1'],
      exercises: [
        { id: 'wu-ex-1', sets: 2, source: 'warmup' },
        { id: 'cd-ex-1', sets: 1, source: 'cardio' },
        { id: 'main-ex-1', sets: 3, source: 'main' },
      ],
    })
  );
});

test('buildSessionMetadata keeps the persisted session boundary limited to workout identity, structure signature, checklist progress, and speech gating', () => {
  assert.deepEqual(
    buildSessionMetadata(
      { id: 'w1', name: 'Leg Day', type: 'strength' },
      [{ completed: true, setsCompleted: [true, true] }],
      [{ id: 'main-ex-1', sets: 2 }]
    ),
    {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      workoutStructureSignature: JSON.stringify({
        warmupIds: [],
        cardioIds: [],
        exercises: [
          { id: 'main-ex-1', sets: 2, source: 'main' },
        ],
      }),
      exerciseProgress: [{ completed: true, setsCompleted: [true, true] }],
      speechEnabled: true,
    }
  );
});

test('buildSessionMetadata disables speech for timer-only sessions', () => {
  assert.deepEqual(
    buildSessionMetadata(null, null, []),
    {
      workoutId: null,
      workoutName: null,
      workoutStructureSignature: null,
      exerciseProgress: null,
      speechEnabled: false,
    }
  );
});

test('sanitizeSessionMetadata strips unsupported fields and normalizes checklist entries', () => {
  assert.deepEqual(
    sanitizeSessionMetadata({
      workoutId: 'w1',
      workoutName: 'Leg Day',
      workoutStructureSignature: '{"exercises":[]}',
      exerciseProgress: [
        { completed: false, setsCompleted: [1, 0, 'yes'] },
        { completed: true, setsCompleted: 'invalid' },
      ],
      speechEnabled: false,
      unexpected: 'drop-me',
    }),
    {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      workoutStructureSignature: '{"exercises":[]}',
      exerciseProgress: [
        { completed: false, setsCompleted: [true, false, true] },
        { completed: false, setsCompleted: [] },
      ],
      speechEnabled: false,
      coachingSchedule: null,
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
      workoutStructureSignature: '{"exercises":[]}',
      exerciseProgress: [{ completed: true, setsCompleted: [true, true] }],
      speechEnabled: false,
      arbitrary: 'ignore-me',
    },
  });

  assert.equal(snapshot.sessionActive, true);
  assert.equal(snapshot.sessionStatus, 'running');
  assert.equal(snapshot.workoutId, 'w1');
  assert.equal(snapshot.workoutName, 'Leg Day');
  assert.equal(snapshot.workoutStructureSignature, '{"exercises":[]}');
  assert.deepEqual(snapshot.exerciseProgress, [
    { completed: true, setsCompleted: [true, true] },
  ]);
  assert.equal(snapshot.speechEnabled, false);
  assert.equal('arbitrary' in snapshot, false);
});
