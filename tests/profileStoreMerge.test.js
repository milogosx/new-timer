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
