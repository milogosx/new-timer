import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRuntimeTrace,
  readRuntimeTrace,
  traceRuntime,
} from '../src/utils/runtimeTrace.js';

test('traceRuntime records sanitized entries and logs them', () => {
  const originalConsoleInfo = console.info;
  const lines = [];

  clearRuntimeTrace();
  console.info = (line) => {
    lines.push(line);
  };

  try {
    const entry = traceRuntime('timer.started', {
      intervalCount: 1,
      ignored: undefined,
    });

    assert.equal(entry.event, 'timer.started');
    assert.deepEqual(entry.details, { intervalCount: 1 });
    assert.equal(readRuntimeTrace().length, 1);
    assert.deepEqual(readRuntimeTrace()[0].details, { intervalCount: 1 });
    assert.match(lines[0], /\[runtime\]/);
    assert.match(lines[0], /timer\.started/);
  } finally {
    console.info = originalConsoleInfo;
    clearRuntimeTrace();
  }
});

test('traceRuntime keeps only the latest 200 entries', () => {
  const originalConsoleInfo = console.info;
  console.info = () => {};
  clearRuntimeTrace();

  try {
    for (let index = 0; index < 205; index += 1) {
      traceRuntime(`event.${index}`);
    }

    const entries = readRuntimeTrace();
    assert.equal(entries.length, 200);
    assert.equal(entries[0].event, 'event.5');
    assert.equal(entries.at(-1)?.event, 'event.204');
  } finally {
    console.info = originalConsoleInfo;
    clearRuntimeTrace();
  }
});
