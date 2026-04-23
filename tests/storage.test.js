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
    workoutDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 30,
    },
    timerOnlyDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 30,
    },
  });
});

test('normalizeSettings clamps values to the supported runtime bounds', () => {
  assert.deepEqual(
    normalizeSettings({
      workoutDefaults: { sessionMinutes: 999, intervalSeconds: 1 },
      timerOnlyDefaults: { sessionMinutes: 0, intervalSeconds: 999 },
    }),
    {
      workoutDefaults: {
        sessionMinutes: 180,
        intervalSeconds: 5,
      },
      timerOnlyDefaults: {
        sessionMinutes: 1,
        intervalSeconds: 600,
      },
    }
  );
});

test('normalizeSettings migrates the legacy flat settings shape into both presets', () => {
  assert.deepEqual(
    normalizeSettings({ sessionMinutes: 51, intervalSeconds: 180 }),
    {
      workoutDefaults: {
        sessionMinutes: 51,
        intervalSeconds: 180,
      },
      timerOnlyDefaults: {
        sessionMinutes: 51,
        intervalSeconds: 180,
      },
    }
  );
});

test('saveSettings falls back or clamps values into the current persisted settings shape', () => {
  saveSettings({
    workoutDefaults: {
      sessionMinutes: 'abc',
      intervalSeconds: 0,
    },
    timerOnlyDefaults: {
      sessionMinutes: '',
      intervalSeconds: 700,
    },
  });

  assert.deepEqual(loadSettings(), {
    workoutDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 5,
    },
    timerOnlyDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 600,
    },
  });
});

test('saveSettings persists values using the same bounds as normalizeSettings', () => {
  saveSettings({
    workoutDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 30,
    },
    timerOnlyDefaults: {
      sessionMinutes: 999,
      intervalSeconds: 1,
    },
  });

  assert.deepEqual(loadSettings(), {
    workoutDefaults: {
      sessionMinutes: 60,
      intervalSeconds: 30,
    },
    timerOnlyDefaults: {
      sessionMinutes: 180,
      intervalSeconds: 5,
    },
  });
});
