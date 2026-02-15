import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAudioPreferences, saveAudioPreferences } from '../src/utils/storage.js';

const AUDIO_PREFS_KEY = 'eliteTimer_audioPrefs';

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
