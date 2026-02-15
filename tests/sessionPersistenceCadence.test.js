import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPersistRunningSession } from '../src/utils/sessionPersistenceCadence.js';

test('shouldPersistRunningSession allows first write when no previous timestamp exists', () => {
  assert.equal(
    shouldPersistRunningSession({ lastPersistAtMs: 0, nowMs: 1_000, minIntervalMs: 1_000 }),
    true
  );
});

test('shouldPersistRunningSession blocks writes before minimum interval', () => {
  assert.equal(
    shouldPersistRunningSession({ lastPersistAtMs: 1_000, nowMs: 1_500, minIntervalMs: 1_000 }),
    false
  );
});

test('shouldPersistRunningSession allows writes at or after minimum interval', () => {
  assert.equal(
    shouldPersistRunningSession({ lastPersistAtMs: 1_000, nowMs: 2_000, minIntervalMs: 1_000 }),
    true
  );
  assert.equal(
    shouldPersistRunningSession({ lastPersistAtMs: 1_000, nowMs: 2_500, minIntervalMs: 1_000 }),
    true
  );
});

test('shouldPersistRunningSession handles invalid inputs safely', () => {
  assert.equal(
    shouldPersistRunningSession({ lastPersistAtMs: 'bad', nowMs: 'bad', minIntervalMs: 'bad' }),
    true
  );
});
