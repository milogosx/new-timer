import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectNativeShell,
  getProfileSyncBaseUrl,
  getRuntimeEnvironment,
  resolveProfileSyncUrl,
} from '../src/config/runtimeConfig.js';

test('getProfileSyncBaseUrl prefers explicit environment override', () => {
  const baseUrl = getProfileSyncBaseUrl({
    env: {
      VITE_PROFILE_SYNC_BASE_URL: ' https://elite-timer.netlify.app/ ',
    },
    location: {
      origin: 'https://ignored.example',
    },
  });

  assert.equal(baseUrl, 'https://elite-timer.netlify.app');
});

test('getProfileSyncBaseUrl falls back to http/https browser origin', () => {
  const baseUrl = getProfileSyncBaseUrl({
    env: {},
    location: {
      origin: 'https://workout.example',
    },
  });

  assert.equal(baseUrl, 'https://workout.example');
});

test('getProfileSyncBaseUrl ignores non-http origins used by native shells', () => {
  const baseUrl = getProfileSyncBaseUrl({
    env: {},
    location: {
      origin: 'capacitor://localhost',
    },
  });

  assert.equal(baseUrl, '');
});

test('resolveProfileSyncUrl keeps relative paths when no safe base url exists', () => {
  const resolved = resolveProfileSyncUrl('/.netlify/functions/profile-read', {
    env: {},
    location: {
      origin: 'capacitor://localhost',
    },
  });

  assert.equal(resolved, '/.netlify/functions/profile-read');
});

test('resolveProfileSyncUrl prefixes configured absolute base urls', () => {
  const resolved = resolveProfileSyncUrl('/.netlify/functions/profile-write', {
    env: {
      VITE_PROFILE_SYNC_BASE_URL: 'https://elite-timer.netlify.app',
    },
  });

  assert.equal(
    resolved,
    'https://elite-timer.netlify.app/.netlify/functions/profile-write'
  );
});

test('detectNativeShell and getRuntimeEnvironment honor Capacitor native detection', () => {
  const capacitor = {
    isNativePlatform() {
      return true;
    },
  };

  assert.equal(detectNativeShell({ capacitor }), true);
  assert.equal(getRuntimeEnvironment({ capacitor }), 'native-shell');
});
