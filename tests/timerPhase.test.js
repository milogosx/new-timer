import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_WARMUP_PHASE_DURATION_SEC,
  getSessionPhase,
  getSpeechMilestones,
} from '../src/utils/timerPhase.js';

test('getSessionPhase uses a fixed warm-up timing window capped by total session length', () => {
  assert.equal(FIXED_WARMUP_PHASE_DURATION_SEC, 900);

  assert.deepEqual(getSessionPhase(120, 60), {
    totalSessionSeconds: 3600,
    warmupBoundarySec: 900,
    isWarmupPhase: true,
    phaseLabel: 'WARM UP',
  });

  assert.deepEqual(getSessionPhase(950, 60), {
    totalSessionSeconds: 3600,
    warmupBoundarySec: 900,
    isWarmupPhase: false,
    phaseLabel: 'WORKOUT',
  });
});

test('getSessionPhase caps the warm-up boundary to the session length for short sessions', () => {
  assert.deepEqual(getSessionPhase(100, 10), {
    totalSessionSeconds: 600,
    warmupBoundarySec: 600,
    isWarmupPhase: true,
    phaseLabel: 'WARM UP',
  });

  assert.deepEqual(getSessionPhase(600, 10), {
    totalSessionSeconds: 600,
    warmupBoundarySec: 600,
    isWarmupPhase: false,
    phaseLabel: 'WORKOUT',
  });
});

test('getSpeechMilestones uses the same fixed warm-up boundary for announcement guards', () => {
  const longSessionMilestones = getSpeechMilestones(60);
  assert.deepEqual(longSessionMilestones[0], {
    key: 'start_warmup',
    at: 1,
    guard: true,
  });
  assert.deepEqual(longSessionMilestones[1], {
    key: 'warmup_complete',
    at: 900,
    guard: true,
  });

  const shortSessionMilestones = getSpeechMilestones(10);
  assert.deepEqual(shortSessionMilestones[1], {
    key: 'warmup_complete',
    at: 600,
    guard: false,
  });
  assert.equal(shortSessionMilestones.at(-1)?.key, 'workout_complete');
  assert.equal(shortSessionMilestones.at(-1)?.at, 600);
});
