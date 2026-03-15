import { connectLambda, getStore } from '@netlify/blobs';

const STORE_NAME = 'elite-timer-profiles';
const PROFILE_ID = globalThis.process?.env?.ELITE_TIMER_PROFILE_ID || 'solo';
const PROFILE_KEY = `profile:${PROFILE_ID}`;
const SECTIONS = ['workouts', 'warmups', 'cardios'];
const SCHEMA_FIELD_BY_SECTION = {
  workouts: 'workoutsSchemaVersion',
  warmups: 'warmupsSchemaVersion',
  cardios: 'cardiosSchemaVersion',
};
const DELETED_DEFAULT_FIELD_BY_SECTION = {
  workouts: 'deletedDefaultWorkoutIds',
  warmups: 'deletedDefaultWarmupIds',
  cardios: 'deletedDefaultCardioIds',
};
const UPDATED_AT_FIELD_BY_SECTION = {
  workouts: 'workoutsUpdatedAt',
  warmups: 'warmupsUpdatedAt',
  cardios: 'cardiosUpdatedAt',
};

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((entry) => typeof entry === 'string' && entry.trim());
}

function normalizeProfileRecord(value) {
  if (!value || typeof value !== 'object') return null;

  const profile = {};
  const fallbackUpdatedAt = Math.max(
    0,
    toSafeInt(value.updatedAt, 0),
    toSafeInt(value.clientUpdatedAt, 0)
  );

  SECTIONS.forEach((section) => {
    if (Array.isArray(value[section])) {
      profile[section] = cloneJson(value[section]);
    }

    const schemaField = SCHEMA_FIELD_BY_SECTION[section];
    const schemaVersion = toSafeInt(value[schemaField], 0);
    if (schemaVersion > 0) {
      profile[schemaField] = schemaVersion;
    }

    const deletedDefaultField = DELETED_DEFAULT_FIELD_BY_SECTION[section];
    const deletedDefaultIds = sanitizeStringArray(value[deletedDefaultField]);
    if (deletedDefaultIds) {
      profile[deletedDefaultField] = deletedDefaultIds;
    }

    const sectionTouched = Array.isArray(value[section])
      || schemaVersion > 0
      || Array.isArray(value[deletedDefaultField]);
    const sectionUpdatedAtField = UPDATED_AT_FIELD_BY_SECTION[section];
    const explicitSectionUpdatedAt = toSafeInt(value[sectionUpdatedAtField], 0);
    const sectionUpdatedAt = explicitSectionUpdatedAt > 0
      ? explicitSectionUpdatedAt
      : (sectionTouched ? fallbackUpdatedAt : 0);
    if (sectionUpdatedAt > 0) {
      profile[sectionUpdatedAtField] = sectionUpdatedAt;
    }
  });

  const updatedAt = Math.max(
    fallbackUpdatedAt,
    ...SECTIONS.map((section) => toSafeInt(profile[UPDATED_AT_FIELD_BY_SECTION[section]], 0))
  );
  if (updatedAt > 0) profile.updatedAt = updatedAt;

  const hasContent = Array.isArray(profile.workouts)
    || Array.isArray(profile.warmups)
    || Array.isArray(profile.cardios)
    || Array.isArray(profile.deletedDefaultWorkoutIds)
    || Array.isArray(profile.deletedDefaultWarmupIds)
    || Array.isArray(profile.deletedDefaultCardioIds);

  if (!hasContent) return null;
  return profile;
}

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function readStoredProfile() {
  const store = getStore(STORE_NAME);
  const raw = await store.get(PROFILE_KEY);
  return normalizeProfileRecord(parseJsonObject(raw));
}

export async function writeStoredProfile(profile) {
  const normalized = normalizeProfileRecord(profile);
  if (!normalized) {
    return null;
  }

  const store = getStore(STORE_NAME);
  await store.set(PROFILE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function initBlobsContext(event) {
  if (event) {
    connectLambda(event);
  }
}

export function mergeProfilePatch(existingProfile, patch) {
  const base = normalizeProfileRecord(existingProfile) || {};
  const normalizedPatch = normalizeProfileRecord(patch) || {};
  const existingUpdatedAt = toSafeInt(base.updatedAt, 0);
  const incomingUpdatedAt = Math.max(
    0,
    toSafeInt(patch?.clientUpdatedAt, 0),
    toSafeInt(normalizedPatch.updatedAt, 0)
  );

  const merged = {
    ...base,
  };

  SECTIONS.forEach((section) => {
    const schemaField = SCHEMA_FIELD_BY_SECTION[section];
    const deletedDefaultField = DELETED_DEFAULT_FIELD_BY_SECTION[section];
    const updatedAtField = UPDATED_AT_FIELD_BY_SECTION[section];
    const sectionTouched = Object.hasOwn(normalizedPatch, section)
      || Object.hasOwn(normalizedPatch, schemaField)
      || Object.hasOwn(normalizedPatch, deletedDefaultField)
      || Object.hasOwn(normalizedPatch, updatedAtField);

    if (!sectionTouched) {
      return;
    }

    const existingSectionUpdatedAt = toSafeInt(base[updatedAtField], 0);
    const explicitSectionUpdatedAt = toSafeInt(normalizedPatch[updatedAtField], 0);
    const incomingSectionUpdatedAt = explicitSectionUpdatedAt > 0
      ? explicitSectionUpdatedAt
      : incomingUpdatedAt;

    if (
      incomingSectionUpdatedAt > 0
      && existingSectionUpdatedAt > 0
      && incomingSectionUpdatedAt < existingSectionUpdatedAt
    ) {
      return;
    }

    if (Object.hasOwn(normalizedPatch, section)) {
      merged[section] = normalizedPatch[section];
    }
    if (Object.hasOwn(normalizedPatch, schemaField)) {
      merged[schemaField] = normalizedPatch[schemaField];
    }
    if (Object.hasOwn(normalizedPatch, deletedDefaultField)) {
      merged[deletedDefaultField] = normalizedPatch[deletedDefaultField];
    }
    if (incomingSectionUpdatedAt > 0) {
      merged[updatedAtField] = incomingSectionUpdatedAt;
    }
  });

  const nextUpdatedAt = Math.max(
    existingUpdatedAt,
    incomingUpdatedAt,
    ...SECTIONS.map((section) => toSafeInt(merged[UPDATED_AT_FIELD_BY_SECTION[section]], 0))
  ) || Date.now();
  merged.updatedAt = nextUpdatedAt;

  return merged;
}
