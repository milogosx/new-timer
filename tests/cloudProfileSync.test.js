import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __flushCloudProfileSyncForTests,
  __resetCloudProfileSyncForTests,
  bootstrapCloudProfile,
  queueCloudProfileSync,
} from '../src/utils/cloudProfileSync.js';

const WORKOUTS_KEY = 'eliteTimer_workouts';
const WORKOUTS_SCHEMA_KEY = 'eliteTimer_workouts_schema';
const WORKOUTS_UPDATED_AT_KEY = 'eliteTimer_workouts_updated_at';
const PROFILE_UPDATED_AT_KEY = 'eliteTimer_profile_updated_at';
const DELETED_DEFAULT_WORKOUT_IDS_KEY = 'eliteTimer_deletedDefaultWorkoutIds';

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

function createDocumentMock() {
  return {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  };
}

function createWindowMock() {
  return {
    addEventListener() {},
    removeEventListener() {},
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemoryStorage();
}

if (!globalThis.window) {
  globalThis.window = createWindowMock();
}

if (!globalThis.document) {
  globalThis.document = createDocumentMock();
}

test.beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.window = createWindowMock();
  globalThis.document = createDocumentMock();
  __resetCloudProfileSyncForTests();
});

test.afterEach(() => {
  delete globalThis.fetch;
});

test('bootstrapCloudProfile hydrates newer remote profile into local storage', async () => {
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/.netlify/functions/profile-read');
    assert.equal(options.method, 'GET');
    return {
      ok: true,
      async json() {
        return {
          profile: {
            workouts: [{ id: 'default-foundation', name: 'Remote Workout' }],
            workoutsSchemaVersion: 3,
            workoutsUpdatedAt: 450,
            updatedAt: 450,
          },
        };
      },
    };
  };

  const result = await bootstrapCloudProfile();

  assert.deepEqual(result, { status: 'hydrated' });
  assert.deepEqual(
    JSON.parse(globalThis.localStorage.getItem(WORKOUTS_KEY)),
    [{ id: 'default-foundation', name: 'Remote Workout' }]
  );
  assert.equal(globalThis.localStorage.getItem(WORKOUTS_SCHEMA_KEY), '3');
  assert.equal(globalThis.localStorage.getItem(WORKOUTS_UPDATED_AT_KEY), '450');
  assert.equal(globalThis.localStorage.getItem(PROFILE_UPDATED_AT_KEY), '450');
});

test('bootstrapCloudProfile keeps newer local profile and requeues only local section data', async () => {
  const requests = [];

  globalThis.localStorage.setItem(
    WORKOUTS_KEY,
    JSON.stringify([{ id: 'default-foundation', name: 'Local Workout' }])
  );
  globalThis.localStorage.setItem(WORKOUTS_SCHEMA_KEY, '3');
  globalThis.localStorage.setItem(WORKOUTS_UPDATED_AT_KEY, '800');
  globalThis.localStorage.setItem(PROFILE_UPDATED_AT_KEY, '800');
  globalThis.localStorage.setItem(
    DELETED_DEFAULT_WORKOUT_IDS_KEY,
    JSON.stringify(['default-engine'])
  );

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });

    if (options.method === 'GET') {
      return {
        ok: true,
        async json() {
          return {
            profile: {
              workouts: [{ id: 'default-foundation', name: 'Older Remote Workout' }],
              workoutsSchemaVersion: 3,
              workoutsUpdatedAt: 500,
              updatedAt: 500,
            },
          };
        },
      };
    }

    return {
      ok: true,
      async json() {
        return { ok: true, updatedAt: 801 };
      },
    };
  };

  const result = await bootstrapCloudProfile();
  await __flushCloudProfileSyncForTests();

  assert.deepEqual(result, { status: 'kept-local' });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, '/.netlify/functions/profile-write');

  const patch = JSON.parse(requests[1].options.body);
  assert.deepEqual(patch.workouts, [{ id: 'default-foundation', name: 'Local Workout' }]);
  assert.deepEqual(patch.deletedDefaultWorkoutIds, ['default-engine']);
  assert.equal(patch.workoutsSchemaVersion, 3);
  assert.ok(typeof patch.clientUpdatedAt === 'number');
  assert.equal(patch.workoutsUpdatedAt, patch.clientUpdatedAt);
  assert.equal(patch.warmups, undefined);
  assert.equal(patch.warmupsUpdatedAt, undefined);
  assert.equal(patch.cardios, undefined);
  assert.equal(patch.cardiosUpdatedAt, undefined);
});

test('queueCloudProfileSync writes section timestamps only for touched sections', async () => {
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return { ok: true, updatedAt: 300 };
      },
    };
  };

  queueCloudProfileSync({
    workouts: [{ id: 'default-foundation', name: 'Queued Workout' }],
    workoutsSchemaVersion: 3,
  });
  await __flushCloudProfileSyncForTests();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/.netlify/functions/profile-write');

  const patch = JSON.parse(requests[0].options.body);
  assert.deepEqual(patch.workouts, [{ id: 'default-foundation', name: 'Queued Workout' }]);
  assert.equal(patch.workoutsSchemaVersion, 3);
  assert.ok(typeof patch.clientUpdatedAt === 'number');
  assert.equal(patch.workoutsUpdatedAt, patch.clientUpdatedAt);
  assert.equal(patch.warmupsUpdatedAt, undefined);
  assert.equal(patch.cardiosUpdatedAt, undefined);
});
