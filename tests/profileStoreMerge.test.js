import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProfilePatch } from '../netlify/profileStore.js';

test('mergeProfilePatch keeps newer existing profile when incoming patch is stale', () => {
  const existing = {
    workouts: [{ id: 'default-foundation', name: 'Local New' }],
    updatedAt: 200,
  };
  const incomingPatch = {
    workouts: [{ id: 'default-foundation', name: 'Older Value' }],
    clientUpdatedAt: 150,
  };

  const merged = mergeProfilePatch(existing, incomingPatch);
  assert.equal(merged.workouts[0].name, 'Local New');
  assert.equal(merged.updatedAt, 200);
});

test('mergeProfilePatch applies incoming patch when timestamp is newer', () => {
  const existing = {
    workouts: [{ id: 'default-foundation', name: 'Local Old' }],
    updatedAt: 200,
  };
  const incomingPatch = {
    workouts: [{ id: 'default-foundation', name: 'Cloud New' }],
    deletedDefaultWorkoutIds: ['default-engine'],
    clientUpdatedAt: 250,
  };

  const merged = mergeProfilePatch(existing, incomingPatch);
  assert.equal(merged.workouts[0].name, 'Cloud New');
  assert.deepEqual(merged.deletedDefaultWorkoutIds, ['default-engine']);
  assert.equal(merged.updatedAt, 250);
});

test('mergeProfilePatch applies an older unrelated section patch without overwriting newer sections', () => {
  const existing = {
    workouts: [{ id: 'default-foundation', name: 'Workouts Newer' }],
    workoutsUpdatedAt: 200,
    updatedAt: 200,
  };
  const incomingPatch = {
    warmups: [{ id: 'default-dynamic-primer', name: 'Warmup Added Later' }],
    clientUpdatedAt: 150,
  };

  const merged = mergeProfilePatch(existing, incomingPatch);
  assert.equal(merged.workouts[0].name, 'Workouts Newer');
  assert.equal(merged.warmups[0].name, 'Warmup Added Later');
  assert.equal(merged.workoutsUpdatedAt, 200);
  assert.equal(merged.warmupsUpdatedAt, 150);
  assert.equal(merged.updatedAt, 200);
});

test('mergeProfilePatch resolves conflicts per section timestamp', () => {
  const existing = {
    workouts: [{ id: 'default-foundation', name: 'Keep Workout' }],
    warmups: [{ id: 'default-dynamic-primer', name: 'Old Warmup' }],
    workoutsUpdatedAt: 300,
    warmupsUpdatedAt: 100,
    updatedAt: 300,
  };
  const incomingPatch = {
    workouts: [{ id: 'default-foundation', name: 'Stale Workout' }],
    warmups: [{ id: 'default-dynamic-primer', name: 'Fresh Warmup' }],
    workoutsUpdatedAt: 250,
    warmupsUpdatedAt: 350,
    clientUpdatedAt: 350,
  };

  const merged = mergeProfilePatch(existing, incomingPatch);
  assert.equal(merged.workouts[0].name, 'Keep Workout');
  assert.equal(merged.warmups[0].name, 'Fresh Warmup');
  assert.equal(merged.workoutsUpdatedAt, 300);
  assert.equal(merged.warmupsUpdatedAt, 350);
  assert.equal(merged.updatedAt, 350);
});
