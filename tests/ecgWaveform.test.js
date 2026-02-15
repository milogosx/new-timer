import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeterministicEcgWaveform } from '../src/utils/ecgWaveform.js';

test('ECG waveform generation is deterministic', () => {
  const first = createDeterministicEcgWaveform();
  const second = createDeterministicEcgWaveform();

  assert.equal(first.path, second.path);
  assert.equal(first.baselineY, second.baselineY);
  assert.deepEqual(first.bloomAnchor, second.bloomAnchor);
  assert.deepEqual(first.viewbox, second.viewbox);
});

test('ECG path includes both smooth curves and sharp line spikes', () => {
  const geometry = createDeterministicEcgWaveform();

  assert.match(geometry.path, /^M /);
  assert.ok(geometry.path.includes(' Q '), 'Expected quadratic segments for smooth wave portions');
  assert.ok(geometry.path.includes(' L '), 'Expected line segments for sharp spike portions');
});

test('ECG exported geometry includes stable dimensions and baseline', () => {
  const geometry = createDeterministicEcgWaveform();

  assert.equal(geometry.viewbox.width, 1000);
  assert.equal(geometry.viewbox.height, 180);
  assert.equal(geometry.baselineY, 110);
});

test('ECG bloom anchor is within bounds and above the baseline', () => {
  const geometry = createDeterministicEcgWaveform();
  const { x, y } = geometry.bloomAnchor;

  assert.ok(x >= 0 && x <= geometry.viewbox.width, `Expected x within viewbox, got ${x}`);
  assert.ok(y >= 0 && y <= geometry.viewbox.height, `Expected y within viewbox, got ${y}`);
  assert.ok(y < geometry.baselineY, `Expected bloom anchor above baseline (${geometry.baselineY}), got ${y}`);
});

test('ECG path reaches the full viewbox width at baseline', () => {
  const geometry = createDeterministicEcgWaveform();
  assert.ok(
    geometry.path.endsWith(`${geometry.viewbox.width} ${geometry.baselineY}`),
    `Expected path to end at ${geometry.viewbox.width} ${geometry.baselineY}, got: ${geometry.path.slice(-24)}`
  );
});
