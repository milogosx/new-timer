import {
  DEFAULT_CARDIOS,
  DEFAULT_CARDIO_ID_SET,
  DEFAULT_WARMUPS,
  DEFAULT_WARMUP_ID_SET,
  DEFAULT_WORKOUTS,
  DEFAULT_WORKOUT_ID_SET,
  LEGACY_CARDIO_NAME_SET,
  LEGACY_WARMUP_NAME_SET,
  LEGACY_WORKOUT_NAME_SET,
} from './workoutCanonicalDefaults.js';
import { createEntityStore } from './workoutEntityStore.js';
import {
  createExercise,
  deepClone,
  generateId,
  normalizeExerciseRecord,
} from './workoutStorageShared.js';

const WORKOUTS_KEY = 'eliteTimer_workouts';
const WARMUPS_KEY = 'eliteTimer_warmups';
const CARDIOS_KEY = 'eliteTimer_cardios';
const WORKOUTS_SCHEMA_KEY = 'eliteTimer_workouts_schema';
const WARMUPS_SCHEMA_KEY = 'eliteTimer_warmups_schema';
const CARDIOS_SCHEMA_KEY = 'eliteTimer_cardios_schema';
const DELETED_DEFAULT_WORKOUT_IDS_KEY = 'eliteTimer_deletedDefaultWorkoutIds';
const DELETED_DEFAULT_WARMUP_IDS_KEY = 'eliteTimer_deletedDefaultWarmupIds';
const DELETED_DEFAULT_CARDIO_IDS_KEY = 'eliteTimer_deletedDefaultCardioIds';
const WORKOUTS_SCHEMA_VERSION = 3;
const WARMUPS_SCHEMA_VERSION = 2;
const CARDIOS_SCHEMA_VERSION = 1;

function createCanonicalWorkouts() {
  return deepClone(DEFAULT_WORKOUTS);
}

function createCanonicalWarmups() {
  return deepClone(DEFAULT_WARMUPS);
}

function createCanonicalCardios() {
  return deepClone(DEFAULT_CARDIOS);
}

function normalizeWorkoutRecord(workout, index) {
  if (!workout || typeof workout !== 'object') return null;

  const name = typeof workout.name === 'string' ? workout.name.trim() : '';
  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises.map((exercise, exerciseIndex) => normalizeExerciseRecord(exercise, exerciseIndex))
    : [];

  if (exercises.length === 0) {
    exercises.push(normalizeExerciseRecord({}, 0));
  }

  const createdAt = Number.parseInt(workout.createdAt, 10);
  const warmupIds = Array.isArray(workout.warmupIds)
    ? workout.warmupIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const cardioIds = Array.isArray(workout.cardioIds)
    ? workout.cardioIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  return {
    id: typeof workout.id === 'string' && workout.id ? workout.id : generateId(),
    name: name || `Workout ${index + 1}`,
    type: typeof workout.type === 'string' ? workout.type : 'other',
    exercises,
    warmupIds,
    cardioIds,
    pinned: Boolean(workout.pinned),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index,
  };
}

function normalizeWarmupRecord(warmup, index) {
  if (!warmup || typeof warmup !== 'object') return null;

  const name = typeof warmup.name === 'string' ? warmup.name.trim() : '';
  const exercises = Array.isArray(warmup.exercises)
    ? warmup.exercises.map((exercise, exerciseIndex) => normalizeExerciseRecord(exercise, exerciseIndex))
    : [];

  if (exercises.length === 0) {
    exercises.push(normalizeExerciseRecord({ rest: 15, rpe: 'RPE 4' }, 0));
  }

  const createdAt = Number.parseInt(warmup.createdAt, 10);

  return {
    id: typeof warmup.id === 'string' && warmup.id ? warmup.id : generateId(),
    name: name || `Warm-up ${index + 1}`,
    exercises,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index,
  };
}

function normalizeCardioRecord(cardio, index) {
  if (!cardio || typeof cardio !== 'object') return null;

  const name = typeof cardio.name === 'string' ? cardio.name.trim() : '';
  const exercises = Array.isArray(cardio.exercises)
    ? cardio.exercises.map((exercise, exerciseIndex) => normalizeExerciseRecord(exercise, exerciseIndex))
    : [];

  if (exercises.length === 0) {
    exercises.push(normalizeExerciseRecord({ rest: 0, rpe: 'RPE 5' }, 0));
  }

  const createdAt = Number.parseInt(cardio.createdAt, 10);

  return {
    id: typeof cardio.id === 'string' && cardio.id ? cardio.id : generateId(),
    name: name || `Cardio ${index + 1}`,
    exercises,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index,
  };
}

function looksLikeLegacyWorkout(workout) {
  const id = String(workout.id || '').toLowerCase();
  const name = String(workout.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  return LEGACY_WORKOUT_NAME_SET.has(name);
}

function looksLikeLegacyWarmup(warmup) {
  const id = String(warmup.id || '').toLowerCase();
  const name = String(warmup.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  return LEGACY_WARMUP_NAME_SET.has(name);
}

function looksLikeLegacyCardio(cardio) {
  const id = String(cardio.id || '').toLowerCase();
  const name = String(cardio.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  return LEGACY_CARDIO_NAME_SET.has(name);
}

function removeRoutineReferencesFromWorkouts(workouts, { warmupId = null, cardioId = null } = {}) {
  let modified = false;

  const nextWorkouts = workouts.map((workout) => {
    let nextWorkout = workout;

    if (warmupId && Array.isArray(workout.warmupIds) && workout.warmupIds.includes(warmupId)) {
      nextWorkout = {
        ...nextWorkout,
        warmupIds: workout.warmupIds.filter((id) => id !== warmupId),
      };
      modified = true;
    }

    if (cardioId && Array.isArray(workout.cardioIds) && workout.cardioIds.includes(cardioId)) {
      nextWorkout = {
        ...nextWorkout,
        cardioIds: workout.cardioIds.filter((id) => id !== cardioId),
      };
      modified = true;
    }

    return nextWorkout;
  });

  return {
    workouts: nextWorkouts,
    modified,
  };
}

const workoutStore = createEntityStore({
  section: 'workouts',
  storageKey: WORKOUTS_KEY,
  schemaKey: WORKOUTS_SCHEMA_KEY,
  deletedDefaultsKey: DELETED_DEFAULT_WORKOUT_IDS_KEY,
  schemaVersion: WORKOUTS_SCHEMA_VERSION,
  createCanonicalRecords: createCanonicalWorkouts,
  normalizeRecord: normalizeWorkoutRecord,
  looksLikeLegacyRecord: looksLikeLegacyWorkout,
  isDefaultId: (id) => DEFAULT_WORKOUT_ID_SET.has(id),
  buildNewRecord: (workout = {}) => ({
    ...workout,
    id: generateId(),
    createdAt: Date.now(),
    pinned: false,
    warmupIds: workout.warmupIds || [],
    cardioIds: workout.cardioIds || [],
  }),
});

const warmupStore = createEntityStore({
  section: 'warmups',
  storageKey: WARMUPS_KEY,
  schemaKey: WARMUPS_SCHEMA_KEY,
  deletedDefaultsKey: DELETED_DEFAULT_WARMUP_IDS_KEY,
  schemaVersion: WARMUPS_SCHEMA_VERSION,
  createCanonicalRecords: createCanonicalWarmups,
  normalizeRecord: normalizeWarmupRecord,
  looksLikeLegacyRecord: looksLikeLegacyWarmup,
  isDefaultId: (id) => DEFAULT_WARMUP_ID_SET.has(id),
  buildNewRecord: (warmup = {}) => ({
    ...warmup,
    id: generateId(),
    createdAt: Date.now(),
  }),
});

const cardioStore = createEntityStore({
  section: 'cardios',
  storageKey: CARDIOS_KEY,
  schemaKey: CARDIOS_SCHEMA_KEY,
  deletedDefaultsKey: DELETED_DEFAULT_CARDIO_IDS_KEY,
  schemaVersion: CARDIOS_SCHEMA_VERSION,
  createCanonicalRecords: createCanonicalCardios,
  normalizeRecord: normalizeCardioRecord,
  looksLikeLegacyRecord: looksLikeLegacyCardio,
  isDefaultId: (id) => DEFAULT_CARDIO_ID_SET.has(id),
  buildNewRecord: (cardio = {}) => ({
    ...cardio,
    id: generateId(),
    createdAt: Date.now(),
  }),
});

export function loadWorkouts() {
  return workoutStore.load();
}

export function saveWorkouts(workouts) {
  return workoutStore.save(workouts);
}

export function createWorkout(workout) {
  return workoutStore.create(workout);
}

export function updateWorkout(id, updates) {
  return workoutStore.update(id, updates);
}

export function deleteWorkout(id) {
  return workoutStore.remove(id);
}

export function togglePinWorkout(id) {
  const workouts = loadWorkouts();
  const index = workouts.findIndex((workout) => workout.id === id);
  if (index === -1) return workouts;
  workouts[index].pinned = !workouts[index].pinned;
  saveWorkouts(workouts);
  return workouts;
}

export function resetAllWorkouts() {
  return workoutStore.resetAll();
}

export { createExercise };

export function loadWarmups() {
  return warmupStore.load();
}

export function saveWarmups(warmups) {
  return warmupStore.save(warmups);
}

export function createWarmup(warmup) {
  return warmupStore.create(warmup);
}

export function updateWarmup(id, updates) {
  return warmupStore.update(id, updates);
}

export function deleteWarmup(id) {
  const warmups = warmupStore.remove(id);
  const { workouts, modified } = removeRoutineReferencesFromWorkouts(loadWorkouts(), { warmupId: id });
  if (modified) saveWorkouts(workouts);
  return warmups;
}

export function resetAllWarmups() {
  return warmupStore.resetAll();
}

export function loadCardios() {
  return cardioStore.load();
}

export function saveCardios(cardios) {
  return cardioStore.save(cardios);
}

export function createCardio(cardio) {
  return cardioStore.create(cardio);
}

export function updateCardio(id, updates) {
  return cardioStore.update(id, updates);
}

export function deleteCardio(id) {
  const cardios = cardioStore.remove(id);
  const { workouts, modified } = removeRoutineReferencesFromWorkouts(loadWorkouts(), { cardioId: id });
  if (modified) saveWorkouts(workouts);
  return cardios;
}

export function resetAllCardios() {
  return cardioStore.resetAll();
}
