import { connectLambda, getStore } from '@netlify/blobs';

const STORE_NAME = 'elite-timer-profiles';
const PROFILE_ID = globalThis.process?.env?.ELITE_TIMER_PROFILE_ID || 'solo';
const PROFILE_KEY = `profile:${PROFILE_ID}`;

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

  if (Array.isArray(value.workouts)) profile.workouts = cloneJson(value.workouts);
  if (Array.isArray(value.warmups)) profile.warmups = cloneJson(value.warmups);
  if (Array.isArray(value.cardios)) profile.cardios = cloneJson(value.cardios);

  const workoutsSchemaVersion = toSafeInt(value.workoutsSchemaVersion, 0);
  if (workoutsSchemaVersion > 0) profile.workoutsSchemaVersion = workoutsSchemaVersion;

  const warmupsSchemaVersion = toSafeInt(value.warmupsSchemaVersion, 0);
  if (warmupsSchemaVersion > 0) profile.warmupsSchemaVersion = warmupsSchemaVersion;

  const cardiosSchemaVersion = toSafeInt(value.cardiosSchemaVersion, 0);
  if (cardiosSchemaVersion > 0) profile.cardiosSchemaVersion = cardiosSchemaVersion;

  const deletedDefaultWorkoutIds = sanitizeStringArray(value.deletedDefaultWorkoutIds);
  if (deletedDefaultWorkoutIds) profile.deletedDefaultWorkoutIds = deletedDefaultWorkoutIds;

  const deletedDefaultWarmupIds = sanitizeStringArray(value.deletedDefaultWarmupIds);
  if (deletedDefaultWarmupIds) profile.deletedDefaultWarmupIds = deletedDefaultWarmupIds;

  const deletedDefaultCardioIds = sanitizeStringArray(value.deletedDefaultCardioIds);
  if (deletedDefaultCardioIds) profile.deletedDefaultCardioIds = deletedDefaultCardioIds;

  const updatedAt = Math.max(
    0,
    toSafeInt(value.updatedAt, 0),
    toSafeInt(value.clientUpdatedAt, 0)
  );
  if (updatedAt > 0) profile.updatedAt = updatedAt;

  const hasContent = Array.isArray(profile.workouts)
    || Array.isArray(profile.warmups)
    || Array.isArray(profile.cardios)
    || Array.isArray(profile.deletedDefaultWorkoutIds)
    || Array.isArray(profile.deletedDefaultWarmupIds)
    || Array.isArray(profile.deletedDefaultCardioIds);

  if (!hasContent) return null;
  if (!profile.updatedAt) profile.updatedAt = Date.now();
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

  const merged = {
    ...base,
    ...normalizedPatch,
  };

  const nextUpdatedAt = Math.max(
    0,
    toSafeInt(patch?.clientUpdatedAt, 0),
    toSafeInt(normalizedPatch.updatedAt, 0),
    Date.now()
  );
  merged.updatedAt = nextUpdatedAt;

  return merged;
}
