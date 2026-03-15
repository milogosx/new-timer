import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSettings,
  normalizeSettings,
  saveSettings,
} from '../src/utils/storage.js';

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

test('loadSettings returns the current persisted settings shape when no data exists', () => {
  assert.deepEqual(loadSettings(), {
    sessionMinutes: 60,
    intervalSeconds: 30,
  });
});

test('normalizeSettings clamps values to the supported runtime bounds', () => {
  assert.deepEqual(
    normalizeSettings({ sessionMinutes: 999, intervalSeconds: 1 }),
    {
      sessionMinutes: 180,
      intervalSeconds: 5,
    }
  );
});

test('saveSettings falls back or clamps values into the current persisted settings shape', () => {
  saveSettings({
    sessionMinutes: 'abc',
    intervalSeconds: 0,
  });

  assert.deepEqual(loadSettings(), {
    sessionMinutes: 60,
    intervalSeconds: 5,
  });
});

test('saveSettings persists values using the same bounds as normalizeSettings', () => {
  saveSettings({
    sessionMinutes: 999,
    intervalSeconds: 1,
  });

  assert.deepEqual(loadSettings(), {
    sessionMinutes: 180,
    intervalSeconds: 5,
  });
});
