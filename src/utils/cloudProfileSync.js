const WORKOUTS_KEY = 'eliteTimer_workouts';
const WARMUPS_KEY = 'eliteTimer_warmups';
const CARDIOS_KEY = 'eliteTimer_cardios';
const WORKOUTS_SCHEMA_KEY = 'eliteTimer_workouts_schema';
const WARMUPS_SCHEMA_KEY = 'eliteTimer_warmups_schema';
const CARDIOS_SCHEMA_KEY = 'eliteTimer_cardios_schema';
const DELETED_DEFAULT_WORKOUT_IDS_KEY = 'eliteTimer_deletedDefaultWorkoutIds';
const DELETED_DEFAULT_WARMUP_IDS_KEY = 'eliteTimer_deletedDefaultWarmupIds';
const DELETED_DEFAULT_CARDIO_IDS_KEY = 'eliteTimer_deletedDefaultCardioIds';
const PROFILE_UPDATED_AT_KEY = 'eliteTimer_profile_updated_at';

const CLOUD_READ_ENDPOINT = '/.netlify/functions/profile-read';
const CLOUD_WRITE_ENDPOINT = '/.netlify/functions/profile-write';
const CLOUD_REQUEST_TIMEOUT_MS = 2500;
const CLOUD_WRITE_DEBOUNCE_MS = 450;
const CLOUD_RETRY_DELAY_MS = 2000;

const SCHEMA_FIELD_BY_SECTION = {
  workouts: 'workoutsSchemaVersion',
  warmups: 'warmupsSchemaVersion',
  cardios: 'cardiosSchemaVersion',
};

const STORAGE_KEY_BY_SECTION = {
  workouts: WORKOUTS_KEY,
  warmups: WARMUPS_KEY,
  cardios: CARDIOS_KEY,
};

const SCHEMA_KEY_BY_SECTION = {
  workouts: WORKOUTS_SCHEMA_KEY,
  warmups: WARMUPS_SCHEMA_KEY,
  cardios: CARDIOS_SCHEMA_KEY,
};

const DELETED_DEFAULT_FIELD_BY_SECTION = {
  workouts: 'deletedDefaultWorkoutIds',
  warmups: 'deletedDefaultWarmupIds',
  cardios: 'deletedDefaultCardioIds',
};

const DELETED_DEFAULT_STORAGE_KEY_BY_SECTION = {
  workouts: DELETED_DEFAULT_WORKOUT_IDS_KEY,
  warmups: DELETED_DEFAULT_WARMUP_IDS_KEY,
  cardios: DELETED_DEFAULT_CARDIO_IDS_KEY,
};

let cloudAvailability = 'unknown';
let pendingPatch = {};
let flushTimerId = null;
let flushInFlight = false;
let lifecycleBound = false;

function isBrowserRuntime() {
  return typeof window !== 'undefined'
    && typeof localStorage !== 'undefined'
    && typeof fetch === 'function';
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`Failed to read local key "${key}":`, err);
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to write local key "${key}":`, err);
    return false;
  }
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((entry) => typeof entry === 'string' && entry.trim());
}

function hasProfileShape(value) {
  return value
    && typeof value === 'object'
    && (Array.isArray(value.workouts)
      || Array.isArray(value.warmups)
      || Array.isArray(value.cardios)
      || Array.isArray(value.deletedDefaultWorkoutIds)
      || Array.isArray(value.deletedDefaultWarmupIds)
      || Array.isArray(value.deletedDefaultCardioIds));
}

function hasAnyLocalProfileData() {
  return [
    ...Object.values(STORAGE_KEY_BY_SECTION),
    ...Object.values(DELETED_DEFAULT_STORAGE_KEY_BY_SECTION),
  ].some((key) => safeGetItem(key) !== null);
}

function readLocalArrayForSection(section) {
  const raw = safeGetItem(STORAGE_KEY_BY_SECTION[section]);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLocalDeletedDefaultIds(section) {
  const key = DELETED_DEFAULT_STORAGE_KEY_BY_SECTION[section];
  return sanitizeStringArray(safeParseJsonRaw(safeGetItem(key))) || [];
}

function safeParseJsonRaw(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLocalSchemaForSection(section) {
  const raw = safeGetItem(SCHEMA_KEY_BY_SECTION[section]);
  const parsed = toSafeInt(raw, 0);
  return parsed > 0 ? parsed : null;
}

function getLocalProfileUpdatedAt() {
  return Math.max(0, toSafeInt(safeGetItem(PROFILE_UPDATED_AT_KEY), 0));
}

function setLocalProfileUpdatedAt(timestamp = Date.now()) {
  const next = Math.max(0, toSafeInt(timestamp, Date.now()));
  safeSetItem(PROFILE_UPDATED_AT_KEY, String(next));
  return next;
}

function buildFullLocalPatch() {
  const patch = {};
  ['workouts', 'warmups', 'cardios'].forEach((section) => {
    const items = readLocalArrayForSection(section);
    if (Array.isArray(items)) {
      patch[section] = items;
    }

    const schemaVersion = readLocalSchemaForSection(section);
    if (schemaVersion) {
      patch[SCHEMA_FIELD_BY_SECTION[section]] = schemaVersion;
    }

    patch[DELETED_DEFAULT_FIELD_BY_SECTION[section]] = readLocalDeletedDefaultIds(section);
  });
  return patch;
}

function sanitizeIncomingPatch(patch) {
  if (!patch || typeof patch !== 'object') return {};

  const next = {};

  ['workouts', 'warmups', 'cardios'].forEach((section) => {
    if (Array.isArray(patch[section])) {
      next[section] = cloneJson(patch[section]);
    }

    const schemaField = SCHEMA_FIELD_BY_SECTION[section];
    const schemaVersion = toSafeInt(patch[schemaField], 0);
    if (schemaVersion > 0) {
      next[schemaField] = schemaVersion;
    }

    const deletedDefaultField = DELETED_DEFAULT_FIELD_BY_SECTION[section];
    if (Array.isArray(patch[deletedDefaultField])) {
      next[deletedDefaultField] = sanitizeStringArray(patch[deletedDefaultField]) || [];
    }
  });

  const clientUpdatedAt = Math.max(0, toSafeInt(patch.clientUpdatedAt, 0));
  if (clientUpdatedAt > 0) {
    next.clientUpdatedAt = clientUpdatedAt;
  }

  return next;
}

function mergePatches(basePatch, newPatch) {
  return {
    ...basePatch,
    ...newPatch,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = CLOUD_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function writePatchToCloud(patch) {
  if (cloudAvailability === 'unavailable') {
    return false;
  }

  try {
    const response = await fetchWithTimeout(CLOUD_WRITE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        cloudAvailability = 'unavailable';
      }
      return false;
    }

    cloudAvailability = 'available';
    return true;
  } catch {
    return false;
  }
}

async function flushPendingPatch() {
  if (flushInFlight || cloudAvailability === 'unavailable') return;

  const keys = Object.keys(pendingPatch);
  if (keys.length === 0) return;

  flushInFlight = true;
  const patch = pendingPatch;
  pendingPatch = {};

  const ok = await writePatchToCloud(patch);
  flushInFlight = false;

  if (!ok) {
    pendingPatch = mergePatches(patch, pendingPatch);
    schedulePatchFlush(CLOUD_RETRY_DELAY_MS);
    return;
  }

  if (Object.keys(pendingPatch).length > 0) {
    schedulePatchFlush(CLOUD_WRITE_DEBOUNCE_MS);
  }
}

function schedulePatchFlush(delayMs = CLOUD_WRITE_DEBOUNCE_MS) {
  if (flushTimerId !== null) return;
  flushTimerId = setTimeout(() => {
    flushTimerId = null;
    void flushPendingPatch();
  }, delayMs);
}

function flushSoon() {
  if (Object.keys(pendingPatch).length === 0) return;
  if (flushTimerId !== null) return;
  schedulePatchFlush(0);
}

function applyRemoteProfileToLocal(profile) {
  ['workouts', 'warmups', 'cardios'].forEach((section) => {
    const deletedDefaultField = DELETED_DEFAULT_FIELD_BY_SECTION[section];
    const localDeleted = new Set(readLocalDeletedDefaultIds(section));
    const remoteDeleted = new Set(sanitizeStringArray(profile[deletedDefaultField]) || []);
    const mergedDeleted = [...new Set([...localDeleted, ...remoteDeleted])];

    safeSetItem(
      DELETED_DEFAULT_STORAGE_KEY_BY_SECTION[section],
      JSON.stringify(mergedDeleted)
    );

    if (Array.isArray(profile[section])) {
      const filtered = profile[section].filter((item) => !mergedDeleted.includes(item?.id));
      safeSetItem(STORAGE_KEY_BY_SECTION[section], JSON.stringify(filtered));
    }

    const schemaField = SCHEMA_FIELD_BY_SECTION[section];
    const schemaVersion = toSafeInt(profile[schemaField], 0);
    if (schemaVersion > 0) {
      safeSetItem(SCHEMA_KEY_BY_SECTION[section], String(schemaVersion));
    }
  });

  setLocalProfileUpdatedAt(profile.updatedAt || Date.now());
}

function normalizeRemoteProfile(payload) {
  if (!hasProfileShape(payload)) return null;

  const profile = sanitizeIncomingPatch(payload);
  const updatedAt = Math.max(
    0,
    toSafeInt(payload.updatedAt, 0),
    toSafeInt(payload.clientUpdatedAt, 0)
  );
  profile.updatedAt = updatedAt > 0 ? updatedAt : Date.now();
  return profile;
}

export async function bootstrapCloudProfile() {
  if (!isBrowserRuntime()) return { status: 'skipped' };

  try {
    const response = await fetchWithTimeout(CLOUD_READ_ENDPOINT, { method: 'GET' });
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        cloudAvailability = 'unavailable';
      }
      return { status: 'unavailable' };
    }

    cloudAvailability = 'available';
    const payload = await response.json();
    const remoteProfile = normalizeRemoteProfile(payload?.profile);

    if (!remoteProfile) {
      if (hasAnyLocalProfileData()) {
        queueCloudProfileSync(buildFullLocalPatch());
      }
      return { status: 'empty' };
    }

    const localUpdatedAt = getLocalProfileUpdatedAt();
    if (localUpdatedAt > remoteProfile.updatedAt && hasAnyLocalProfileData()) {
      queueCloudProfileSync(buildFullLocalPatch());
      return { status: 'kept-local' };
    }

    applyRemoteProfileToLocal(remoteProfile);
    return { status: 'hydrated' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function queueCloudProfileSync(sectionPatch = {}) {
  if (!isBrowserRuntime() || cloudAvailability === 'unavailable') {
    return;
  }

  const nextUpdatedAt = setLocalProfileUpdatedAt(Date.now());
  const sanitizedPatch = sanitizeIncomingPatch({
    ...sectionPatch,
    clientUpdatedAt: nextUpdatedAt,
  });

  if (Object.keys(sanitizedPatch).length === 0) {
    return;
  }

  pendingPatch = mergePatches(pendingPatch, sanitizedPatch);
  schedulePatchFlush();
}

export function bindCloudSyncLifecycle() {
  if (!isBrowserRuntime() || lifecycleBound) return;

  lifecycleBound = true;

  const handleOnline = () => {
    flushSoon();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushSoon();
    }
  };
  const handlePageHide = () => {
    flushSoon();
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
}
