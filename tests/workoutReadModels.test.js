import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkoutLibraryData, sortWorkouts } from '../src/utils/workoutReadModels.js';

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

test('sortWorkouts keeps pinned items first and then newest by createdAt', () => {
  const sorted = sortWorkouts([
    { id: 'late', pinned: false, createdAt: 300 },
    { id: 'pinned', pinned: true, createdAt: 100 },
    { id: 'early', pinned: false, createdAt: 200 },
  ]);

  assert.deepEqual(sorted.map((entry) => entry.id), ['pinned', 'late', 'early']);
});

test('loadWorkoutLibraryData returns sorted workouts with warmups and cardios', () => {
  const libraryData = loadWorkoutLibraryData();

  assert.equal(libraryData.workouts[0].pinned, true);
  assert.equal(libraryData.warmups.length > 0, true);
  assert.equal(libraryData.cardios.length > 0, true);
});
