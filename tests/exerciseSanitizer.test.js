import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeExercisesForSave } from '../src/utils/exerciseSanitizer.js';

test('sanitizeExercisesForSave preserves explicit zero rest values', () => {
  const sanitized = sanitizeExercisesForSave(
    [
      {
        name: 'Row',
        sets: '3',
        reps: '8',
        rest: '0',
        rpe: 'RPE 7',
        note: '  keep pace  ',
      },
    ],
    {
      sets: 4,
      reps: '10',
      rest: 30,
      rpe: 'RPE 6',
    }
  );

  assert.deepEqual(sanitized, [
    {
      name: 'Row',
      sets: 3,
      reps: '8',
      rest: 0,
      rpe: 'RPE 7',
      note: 'keep pace',
    },
  ]);
});

test('sanitizeExercisesForSave applies defaults only when numeric fields are invalid', () => {
  const sanitized = sanitizeExercisesForSave(
    [
      {
        name: '  Bike  ',
        sets: 'abc',
        reps: '   ',
        rest: '',
        rpe: '',
        note: '',
      },
    ],
    {
      sets: 2,
      reps: 'Cont.',
      rest: 0,
      rpe: 'RPE 5',
    }
  );

  assert.deepEqual(sanitized, [
    {
      name: 'Bike',
      sets: 2,
      reps: 'Cont.',
      rest: 0,
      rpe: 'RPE 5',
      note: '',
    },
  ]);
});

test('sanitizeExercisesForSave filters blank exercise names', () => {
  const sanitized = sanitizeExercisesForSave(
    [
      {
        name: '   ',
        sets: '3',
        reps: '10',
        rest: '30',
        rpe: 'RPE 6',
        note: '',
      },
      {
        name: 'Press',
        sets: '4',
        reps: '6',
        rest: '90',
        rpe: 'RPE 8',
        note: '',
      },
    ],
    {
      sets: 1,
      reps: '10',
      rest: 30,
      rpe: 'RPE 5',
    }
  );

  assert.deepEqual(sanitized, [
    {
      name: 'Press',
      sets: 4,
      reps: '6',
      rest: 90,
      rpe: 'RPE 8',
      note: '',
    },
  ]);
});
