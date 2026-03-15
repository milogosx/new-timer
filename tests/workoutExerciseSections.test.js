import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkouts } from '../src/utils/workoutStorage.js';
import { getWorkoutExerciseSections } from '../src/utils/workoutExerciseSections.js';

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemoryStorage();
}

test.beforeEach(() => {
  globalThis.localStorage.clear();
});

test('getWorkoutExerciseSections returns warmup, cardio, and main exercise slices in display order', () => {
  const workout = loadWorkouts().find((entry) => entry.id === 'default-engine');

  const sections = getWorkoutExerciseSections(workout);

  assert.equal(sections.warmupExercises.length > 0, true);
  assert.equal(sections.cardioExercises.length > 0, true);
  assert.equal(sections.mainExercises.length, workout.exercises.length);
  assert.equal(sections.exercises.length, sections.warmupExercises.length + sections.cardioExercises.length + sections.mainExercises.length);

  assert.equal(sections.exercises[0]._isWarmup, true);
  assert.equal(sections.exercises.at(sections.warmupExercises.length)?._isCardio, true);
  assert.equal(sections.exercises.at(-1)._isWarmup, false);
  assert.equal(sections.exercises.at(-1)._isCardio, false);
});
