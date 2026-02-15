import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAudioPreferences,
  saveAudioPreferences,
  loadSettings,
  saveSettings,
} from '../src/utils/storage.js';

const AUDIO_PREFS_KEY = 'eliteTimer_audioPrefs';
const SETTINGS_KEY = 'eliteTimer_settings';

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

function withMockWindow(windowValue, fn) {
  const hadWindow = 'window' in globalThis;
  const previousWindow = globalThis.window;
  globalThis.window = windowValue;
  try {
    fn();
  } finally {
    if (hadWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  }
}

test.beforeEach(() => {
  globalThis.localStorage.clear();
});

test('loadAudioPreferences defaults bgmEnabled to false when no data exists', () => {
  assert.deepEqual(loadAudioPreferences(), { bgmEnabled: false });
});

test('saveAudioPreferences persists explicit true and false values', () => {
  saveAudioPreferences({ bgmEnabled: true });
  assert.equal(loadAudioPreferences().bgmEnabled, true);

  saveAudioPreferences({ bgmEnabled: false });
  assert.equal(loadAudioPreferences().bgmEnabled, false);
});

test('loadAudioPreferences normalizes malformed data safely', () => {
  localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ bgmEnabled: 'yes' }));
  assert.equal(loadAudioPreferences().bgmEnabled, true);

  localStorage.setItem(AUDIO_PREFS_KEY, 'not-json');
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(loadAudioPreferences().bgmEnabled, false);
  } finally {
    console.error = originalError;
  }
});

test('loadSettings includes batterySaverMode default when no data exists', () => {
  assert.deepEqual(loadSettings(), {
    sessionMinutes: 60,
    intervalSeconds: 30,
    batterySaverMode: false,
  });
});

test('loadSettings defaults batterySaverMode to true for coarse pointer devices when missing', () => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sessionMinutes: 45, intervalSeconds: 20 }));

  withMockWindow(
    {
      matchMedia: (query) => ({ matches: query === '(pointer: coarse)' }),
    },
    () => {
      assert.deepEqual(loadSettings(), {
        sessionMinutes: 45,
        intervalSeconds: 20,
        batterySaverMode: true,
      });
    }
  );
});

test('saveSettings normalizes invalid values and boolean battery saver', () => {
  saveSettings({
    sessionMinutes: 'abc',
    intervalSeconds: 0,
    batterySaverMode: 'yes',
  });

  assert.deepEqual(loadSettings(), {
    sessionMinutes: 60,
    intervalSeconds: 30,
    batterySaverMode: false,
  });
});

test('saveSettings persists explicit battery saver opt-out on mobile-like devices', () => {
  withMockWindow(
    {
      matchMedia: () => ({ matches: true }),
    },
    () => {
      saveSettings({
        sessionMinutes: 60,
        intervalSeconds: 30,
        batterySaverMode: false,
      });
      assert.equal(loadSettings().batterySaverMode, false);
    }
  );
});
