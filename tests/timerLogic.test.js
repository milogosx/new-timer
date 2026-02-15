import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveResumedIntervalState, getNextCircleColor } from '../src/utils/timerLogic.js';

test('deriveResumedIntervalState resumes normal interval progression', () => {
  const now = 1_000_000;
  const savedState = {
    sessionStartTime: now - 50_000, // 50s elapsed
    totalPaused: 0,
    intervalDuration: 30,
    currentIntervalDuration: 30,
    currentIntervalStartTime: now - 20_000, // 20s into current interval
    intervalPaused: 0,
    intervalCount: 3,
    intervalState: 'teal',
    isQuickAdd: false,
  };

  const resumed = deriveResumedIntervalState(savedState, now);

  assert.equal(resumed.elapsed, 50);
  assert.equal(resumed.intervalCount, 3);
  assert.equal(resumed.intervalState, 'teal');
  assert.equal(resumed.currentIntervalDuration, 30);
  assert.equal(resumed.intervalRemaining, 10);
  assert.equal(resumed.isQuickAdd, false);
});

test('deriveResumedIntervalState keeps quick-add active if interval not finished', () => {
  const now = 1_000_000;
  const savedState = {
    sessionStartTime: now - 40_000,
    totalPaused: 0,
    intervalDuration: 90, // default interval
    currentIntervalDuration: 30, // quick-add interval in progress
    currentIntervalStartTime: now - 10_000, // 10s into quick add
    intervalPaused: 0,
    intervalCount: 4,
    intervalState: 'black',
    isQuickAdd: true,
  };

  const resumed = deriveResumedIntervalState(savedState, now);

  assert.equal(resumed.intervalCount, 4);
  assert.equal(resumed.intervalState, 'black');
  assert.equal(resumed.currentIntervalDuration, 30);
  assert.equal(resumed.intervalRemaining, 20);
  assert.equal(resumed.isQuickAdd, true);
});

test('deriveResumedIntervalState exits quick-add and continues with default intervals', () => {
  const now = 1_000_000;
  const savedState = {
    sessionStartTime: now - 200_000,
    totalPaused: 0,
    intervalDuration: 90, // default interval
    currentIntervalDuration: 30, // quick-add interval was active when app backgrounded
    currentIntervalStartTime: now - 140_000, // away long enough to pass quick-add + 1 default interval + 20s
    intervalPaused: 0,
    intervalCount: 2,
    intervalState: 'black',
    isQuickAdd: true,
  };

  const resumed = deriveResumedIntervalState(savedState, now);

  // 140s after quick-add started:
  // 30s quick-add completes -> interval count +1, color black -> teal
  // 90s default completes -> interval count +1, color teal -> black
  // 20s into current default interval
  assert.equal(resumed.intervalCount, 4);
  assert.equal(resumed.intervalState, 'black');
  assert.equal(resumed.currentIntervalDuration, 90);
  assert.equal(resumed.intervalRemaining, 70);
  assert.equal(resumed.isQuickAdd, false);
});

test('getNextCircleColor alternates between black and teal only', () => {
  assert.equal(getNextCircleColor('black', false), 'teal');
  assert.equal(getNextCircleColor('teal', false), 'black');
  assert.equal(getNextCircleColor('anything-else', false), 'teal');
});

test('deriveResumedIntervalState normalizes legacy second-based epoch timestamps', () => {
  const nowMs = 1_700_000_120_000;
  const nowSec = Math.floor(nowMs / 1000);
  const savedState = {
    sessionStartTime: nowSec - 120, // 120s elapsed but stored as seconds
    totalPaused: 0,
    intervalDuration: 30,
    currentIntervalDuration: 30,
    currentIntervalStartTime: nowSec - 20, // 20s into interval, stored as seconds
    intervalPaused: 0,
    intervalCount: 5,
    intervalState: 'teal',
    isQuickAdd: false,
  };

  const resumed = deriveResumedIntervalState(savedState, nowMs);

  assert.equal(resumed.elapsed, 120);
  assert.equal(resumed.intervalCount, 5);
  assert.equal(resumed.intervalRemaining, 10);
  assert.equal(resumed.intervalState, 'teal');
});
