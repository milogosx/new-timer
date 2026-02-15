import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWarmups, loadWorkouts } from '../src/utils/workoutStorage.js';

const WORKOUTS_KEY = 'eliteTimer_workouts';
const WARMUPS_KEY = 'eliteTimer_warmups';
const WORKOUTS_SCHEMA_KEY = 'eliteTimer_workouts_schema';
const WARMUPS_SCHEMA_KEY = 'eliteTimer_warmups_schema';

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

test('loadWorkouts migrates legacy starter records and preserves custom workouts', () => {
  const legacyAndCustom = [
    {
      id: 'starter-push',
      name: 'Push',
      type: 'strength',
      exercises: [{ id: 'a1', name: 'Bench', sets: 3, reps: '8', rest: 60, rpe: 'RPE 8', note: '' }],
      warmupIds: [],
      pinned: false,
      createdAt: 1,
    },
    {
      id: 'legacy-pull',
      name: 'Pull Day',
      type: 'strength',
      exercises: [{ id: 'a2', name: 'Rows', sets: 3, reps: '10', rest: 60, rpe: 'RPE 8', note: '' }],
      warmupIds: [],
      pinned: false,
      createdAt: 2,
    },
    {
      id: 'custom-1',
      name: 'My Custom Session',
      type: 'cardio',
      exercises: [{ id: 'c1', name: 'Run', sets: 1, reps: '20 min', rest: 0, rpe: 'RPE 6', note: '' }],
      warmupIds: [],
      pinned: false,
      createdAt: 3,
    },
  ];

  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(legacyAndCustom));
  localStorage.setItem(WORKOUTS_SCHEMA_KEY, '1');

  const workouts = loadWorkouts();
  const ids = workouts.map((workout) => workout.id);

  assert.ok(ids.includes('default-foundation'));
  assert.ok(ids.includes('default-power-pull'));
  assert.ok(ids.includes('default-full-body'));
  assert.ok(ids.includes('default-engine'));
  assert.ok(ids.includes('custom-1'));
  assert.ok(!ids.includes('starter-push'));
  assert.ok(!ids.includes('legacy-pull'));
  assert.equal(localStorage.getItem(WORKOUTS_SCHEMA_KEY), '3');
});

test('loadWorkouts preserves edits to canonical defaults while backfilling missing defaults', () => {
  const mutatedDefaults = [
    {
      id: 'default-foundation',
      name: 'Old Foundation Name',
      type: 'strength',
      exercises: [{ id: 'd1', name: 'Old', sets: 1, reps: '1', rest: 10, rpe: 'RPE 1', note: '' }],
      warmupIds: [],
      pinned: false,
      createdAt: 1,
    },
    {
      id: 'custom-2',
      name: 'Custom Builder',
      type: 'other',
      exercises: [{ id: 'd2', name: 'Carry', sets: 2, reps: '20m', rest: 45, rpe: 'RPE 7', note: '' }],
      warmupIds: [],
      pinned: false,
      createdAt: 2,
    },
  ];

  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(mutatedDefaults));
  localStorage.setItem(WORKOUTS_SCHEMA_KEY, '2');

  const workouts = loadWorkouts();
  const ids = workouts.map((workout) => workout.id);
  const foundation = workouts.find((workout) => workout.id === 'default-foundation');

  assert.equal(ids.filter((id) => id.startsWith('default-')).length, 4);
  assert.ok(ids.includes('custom-2'));
  assert.equal(foundation?.name, 'Old Foundation Name');
  assert.equal(localStorage.getItem(WORKOUTS_SCHEMA_KEY), '3');
});

test('loadWarmups migrates legacy starter warmups and preserves custom warmups', () => {
  const warmups = [
    {
      id: 'starter-warmup-a',
      name: 'Dynamic Warmup',
      exercises: [{ id: 'w1', name: 'Arm circles', sets: 1, reps: '30s', rest: 10, rpe: 'RPE 3', note: '' }],
      createdAt: 1,
    },
    {
      id: 'custom-warmup-1',
      name: 'Custom Mobility',
      exercises: [{ id: 'w2', name: 'Hip openers', sets: 1, reps: '10', rest: 15, rpe: 'RPE 4', note: '' }],
      createdAt: 2,
    },
  ];

  localStorage.setItem(WARMUPS_KEY, JSON.stringify(warmups));
  localStorage.setItem(WARMUPS_SCHEMA_KEY, '1');

  const migrated = loadWarmups();
  const ids = migrated.map((warmup) => warmup.id);

  assert.ok(ids.includes('default-dynamic-primer'));
  assert.ok(ids.includes('custom-warmup-1'));
  assert.ok(!ids.includes('starter-warmup-a'));
  assert.equal(localStorage.getItem(WARMUPS_SCHEMA_KEY), '2');
});
