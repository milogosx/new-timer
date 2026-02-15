const WORKOUTS_KEY = 'eliteTimer_workouts';
const WARMUPS_KEY = 'eliteTimer_warmups';
const CARDIOS_KEY = 'eliteTimer_cardios';
const WORKOUTS_SCHEMA_KEY = 'eliteTimer_workouts_schema';
const WARMUPS_SCHEMA_KEY = 'eliteTimer_warmups_schema';
const CARDIOS_SCHEMA_KEY = 'eliteTimer_cardios_schema';
const WORKOUTS_SCHEMA_VERSION = 3;
const WARMUPS_SCHEMA_VERSION = 2;
const CARDIOS_SCHEMA_VERSION = 1;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`Failed to read localStorage key "${key}":`, err);
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to write localStorage key "${key}":`, err);
    return false;
  }
}

function safeParseArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('Failed to parse stored array JSON:', err);
    return null;
  }
}

// Default sample workouts
const DEFAULT_WORKOUTS = [
  {
    id: 'default-foundation',
    name: 'Foundation & Flow',
    type: 'strength',
    exercises: [
      { id: 'e1', name: 'Barbell Back Squats', sets: 3, reps: '5-8', rest: 120, rpe: 'RPE 8', note: '' },
      { id: 'e2', name: 'DB Chest Press', sets: 3, reps: '10-12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e3', name: 'Lat Pulldowns', sets: 3, reps: '10-12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e4', name: 'KB Goblet Lunges', sets: 3, reps: '10 per side', rest: 90, rpe: 'RPE 7', note: '' },
      { id: 'e5', name: 'KB Swings', sets: 3, reps: '20', rest: 60, rpe: 'RPE 7', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: true,
    createdAt: Date.now(),
  },
  {
    id: 'default-power-pull',
    name: 'The Power Pull',
    type: 'strength',
    exercises: [
      { id: 'e6', name: 'Trap Bar Deadlift', sets: 3, reps: '5', rest: 150, rpe: 'RPE 9', note: '' },
      { id: 'e7', name: 'DB Shoulder Press', sets: 3, reps: '10', rest: 90, rpe: 'RPE 8', note: 'Neutral grip' },
      { id: 'e8', name: 'Seated Cable Rows', sets: 3, reps: '12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e9', name: 'Leg Press', sets: 3, reps: '15', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e10', name: 'Face Pulls', sets: 3, reps: '15', rest: 60, rpe: 'RPE 7', note: '' },
      { id: 'e11', name: 'Tricep Rope Pushdowns', sets: 3, reps: '12', rest: 60, rpe: 'RPE 7', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: false,
    createdAt: Date.now() - 1000,
  },
  {
    id: 'default-full-body',
    name: 'Full Body Volume',
    type: 'strength',
    exercises: [
      { id: 'e12', name: 'DB Incline Bench', sets: 3, reps: '12', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e13', name: 'Single-Arm DB Row', sets: 3, reps: '12 per side', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e14', name: 'Leg Extension / Curl', sets: 3, reps: '15', rest: 60, rpe: 'RPE 8', note: '' },
      { id: 'e15', name: 'KB Goblet Squats', sets: 3, reps: '15', rest: 90, rpe: 'RPE 8', note: '' },
      { id: 'e16', name: 'DB Lateral Raises', sets: 3, reps: '15', rest: 60, rpe: 'RPE 7', note: '' },
      { id: 'e17', name: 'Plank', sets: 1, reps: 'Max Hold', rest: 60, rpe: 'RPE 9', note: '' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: [],
    pinned: false,
    createdAt: Date.now() - 2000,
  },
  {
    id: 'default-engine',
    name: 'The Engine',
    type: 'cardio',
    exercises: [
      { id: 'e18', name: 'Incline Walk', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '30 min continuous' },
      { id: 'e19', name: 'HIIT', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 9', note: '15 min (30s on / 90s off)' },
    ],
    warmupIds: ['default-dynamic-primer'],
    cardioIds: ['default-steady-state'],
    pinned: false,
    createdAt: Date.now() - 3000,
  },
];

const DEFAULT_WORKOUT_ID_SET = new Set(DEFAULT_WORKOUTS.map((workout) => workout.id));
const LEGACY_WORKOUT_NAME_SET = new Set([
  'push',
  'push day',
  'pull',
  'pull day',
  'legs',
  'leg day',
  'legs day',
  'upper body',
  'lower body',
  'arms',
  'chest day',
  'back day',
  'cardio day',
]);

function normalizeExerciseRecord(exercise, index) {
  const parsedSets = Number.parseInt(exercise?.sets, 10);
  const parsedRest = Number.parseInt(exercise?.rest, 10);
  const name = typeof exercise?.name === 'string' ? exercise.name.trim() : '';

  return {
    id: typeof exercise?.id === 'string' && exercise.id ? exercise.id : generateId(),
    name: name || `Exercise ${index + 1}`,
    sets: Number.isFinite(parsedSets) ? Math.max(1, parsedSets) : 3,
    reps: typeof exercise?.reps === 'string' && exercise.reps.trim() ? exercise.reps.trim() : '10',
    rest: Number.isFinite(parsedRest) ? Math.max(0, parsedRest) : 60,
    rpe: typeof exercise?.rpe === 'string' && exercise.rpe.trim() ? exercise.rpe.trim() : 'RPE 7',
    note: typeof exercise?.note === 'string' ? exercise.note.trim() : '',
  };
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

function looksLikeLegacyWorkout(workout) {
  const id = String(workout.id || '').toLowerCase();
  const name = String(workout.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  if (LEGACY_WORKOUT_NAME_SET.has(name)) {
    return true;
  }
  return false;
}

function createCanonicalWorkouts() {
  return deepClone(DEFAULT_WORKOUTS);
}

function upsertCanonicalWorkouts(workouts, treatLegacyAsStarter = false) {
  const canonical = createCanonicalWorkouts();

  // Map of stored workouts by ID for quick lookup
  const storedMap = new Map(workouts.map((w) => [w.id, w]));

  // For canonical workouts, prefer the stored version if it exists (user edit)
  // unless we specifically want to force a reset (handled separately typically)
  const mergedCanonical = canonical.map((c) => {
    const stored = storedMap.get(c.id);
    if (stored) {
      // Keep user's version, but ensure any new schema fields from canonical are present if needed
      // For now, just trust the stored version as it's been normalized
      return stored;
    }
    return c;
  });

  // Identify custom workouts (those not in canonical set)
  const canonicalIds = new Set(canonical.map((c) => c.id));
  const custom = workouts.filter((workout) => {
    if (canonicalIds.has(workout.id)) return false; // Already handled in mergedCanonical
    if (treatLegacyAsStarter && looksLikeLegacyWorkout(workout)) return false;
    return true;
  });

  return [...mergedCanonical, ...custom];
}

function readSchemaVersion(key) {
  const raw = safeGetItem(key);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldWriteBack(needsMigration, normalizedJson, migratedJson) {
  return needsMigration || normalizedJson !== migratedJson;
}

export function loadWorkouts() {
  const storedWorkouts = safeParseArray(safeGetItem(WORKOUTS_KEY));
  const storedVersion = readSchemaVersion(WORKOUTS_SCHEMA_KEY);
  const needsMigration = storedVersion !== WORKOUTS_SCHEMA_VERSION;

  if (!storedWorkouts) {
    const canonical = createCanonicalWorkouts();
    saveWorkouts(canonical);
    return canonical;
  }

  const normalized = storedWorkouts
    .map((workout, index) => normalizeWorkoutRecord(workout, index))
    .filter(Boolean);

  const migrated = upsertCanonicalWorkouts(normalized, needsMigration);
  const normalizedJson = JSON.stringify(normalized);
  const migratedJson = JSON.stringify(migrated);

  if (shouldWriteBack(needsMigration, normalizedJson, migratedJson)) {
    saveWorkouts(migrated);
  }

  return migrated;
}

export function saveWorkouts(workouts) {
  safeSetItem(WORKOUTS_KEY, JSON.stringify(workouts));
  safeSetItem(WORKOUTS_SCHEMA_KEY, String(WORKOUTS_SCHEMA_VERSION));
}

export function createWorkout(workout) {
  const workouts = loadWorkouts();
  const newWorkout = {
    ...workout,
    id: generateId(),
    createdAt: Date.now(),
    pinned: false,
    warmupIds: workout.warmupIds || [],
    cardioIds: workout.cardioIds || [],
  };
  workouts.push(newWorkout);
  saveWorkouts(workouts);
  return newWorkout;
}

export function updateWorkout(id, updates) {
  const workouts = loadWorkouts();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  workouts[idx] = { ...workouts[idx], ...updates };
  saveWorkouts(workouts);
  return workouts[idx];
}

export function deleteWorkout(id) {
  const workouts = loadWorkouts().filter((w) => w.id !== id);
  saveWorkouts(workouts);
  return workouts;
}

export function togglePinWorkout(id) {
  const workouts = loadWorkouts();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return workouts;
  workouts[idx].pinned = !workouts[idx].pinned;
  saveWorkouts(workouts);
  return workouts;
}

export function resetAllWorkouts() {
  const canonical = createCanonicalWorkouts();
  saveWorkouts(canonical);
  return canonical;
}

export function createExercise(overrides = {}) {
  return {
    id: generateId(),
    name: '',
    sets: 3,
    reps: '10',
    rest: 60,
    rpe: 'RPE 7',
    note: '',
    ...overrides,
  };
}

// Sort workouts: pinned first, then by creation date (newest first)
export function sortWorkouts(workouts) {
  return [...workouts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdAt - a.createdAt;
  });
}

// ─── WARM-UPS ─────────────────────────────────────────────
// Warm-ups are reusable mini-routines that can be attached to workouts.
// They share the same exercise structure.

const DEFAULT_WARMUPS = [
  {
    id: 'default-dynamic-primer',
    name: 'Dynamic Primer',
    exercises: [
      { id: 'wu1', name: 'Cat-Cow', sets: 1, reps: '10', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu2', name: "World's Greatest Stretch", sets: 1, reps: '5 per side', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu3', name: '90/90 Hip Switches', sets: 1, reps: '5 per side', rest: 15, rpe: 'RPE 4', note: '' },
      { id: 'wu4', name: 'Bird-Dog', sets: 1, reps: '10 per side', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu5', name: 'Scapular Push-ups', sets: 1, reps: '15', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu6', name: 'Bodyweight Squats', sets: 1, reps: '15', rest: 15, rpe: 'RPE 5', note: '' },
      { id: 'wu7', name: 'Wrist Circles', sets: 1, reps: '30s', rest: 15, rpe: 'RPE 3', note: 'Each direction' },
    ],
    createdAt: Date.now(),
  },
];

const DEFAULT_WARMUP_ID_SET = new Set(DEFAULT_WARMUPS.map((warmup) => warmup.id));
const LEGACY_WARMUP_NAME_SET = new Set([
  'dynamic warmup',
  'dynamic warm-up',
  'starter warmup',
  'starter warm-up',
  'warmup a',
  'warm-up a',
]);

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

function looksLikeLegacyWarmup(warmup) {
  const id = String(warmup.id || '').toLowerCase();
  const name = String(warmup.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  if (LEGACY_WARMUP_NAME_SET.has(name)) {
    return true;
  }
  return false;
}

function createCanonicalWarmups() {
  return deepClone(DEFAULT_WARMUPS);
}

function upsertCanonicalWarmups(warmups, treatLegacyAsStarter = false) {
  const canonical = createCanonicalWarmups();
  const custom = warmups.filter((warmup) => {
    if (DEFAULT_WARMUP_ID_SET.has(warmup.id)) return false;
    if (treatLegacyAsStarter && looksLikeLegacyWarmup(warmup)) return false;
    return true;
  });

  return [...canonical, ...custom];
}

export function loadWarmups() {
  const storedWarmups = safeParseArray(safeGetItem(WARMUPS_KEY));
  const storedVersion = readSchemaVersion(WARMUPS_SCHEMA_KEY);
  const needsMigration = storedVersion !== WARMUPS_SCHEMA_VERSION;

  if (!storedWarmups) {
    const canonical = createCanonicalWarmups();
    saveWarmups(canonical);
    return canonical;
  }

  const normalized = storedWarmups
    .map((warmup, index) => normalizeWarmupRecord(warmup, index))
    .filter(Boolean);

  const migrated = upsertCanonicalWarmups(normalized, needsMigration);
  const normalizedJson = JSON.stringify(normalized);
  const migratedJson = JSON.stringify(migrated);

  if (shouldWriteBack(needsMigration, normalizedJson, migratedJson)) {
    saveWarmups(migrated);
  }

  return migrated;
}

export function saveWarmups(warmups) {
  safeSetItem(WARMUPS_KEY, JSON.stringify(warmups));
  safeSetItem(WARMUPS_SCHEMA_KEY, String(WARMUPS_SCHEMA_VERSION));
}

export function createWarmup(warmup) {
  const warmups = loadWarmups();
  const newWarmup = {
    ...warmup,
    id: generateId(),
    createdAt: Date.now(),
  };
  warmups.push(newWarmup);
  saveWarmups(warmups);
  return newWarmup;
}

export function updateWarmup(id, updates) {
  const warmups = loadWarmups();
  const idx = warmups.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  warmups[idx] = { ...warmups[idx], ...updates };
  saveWarmups(warmups);
  return warmups[idx];
}

export function deleteWarmup(id) {
  const warmups = loadWarmups().filter((w) => w.id !== id);
  saveWarmups(warmups);
  // Also remove this warmup from any workouts that reference it
  const workouts = loadWorkouts();
  let modified = false;
  workouts.forEach((workout) => {
    if (workout.warmupIds && workout.warmupIds.includes(id)) {
      workout.warmupIds = workout.warmupIds.filter((wid) => wid !== id);
      modified = true;
    }
  });
  if (modified) saveWorkouts(workouts);
  return warmups;
}

export function resetAllWarmups() {
  const canonical = createCanonicalWarmups();
  saveWarmups(canonical);
  return canonical;
}

// Get warm-up exercises for a workout (resolves warmupIds to exercise arrays)
export function getWarmupExercisesForWorkout(workout) {
  if (!workout?.warmupIds || workout.warmupIds.length === 0) return [];
  const warmups = loadWarmups();
  const exercises = [];
  workout.warmupIds.forEach((wid) => {
    const warmup = warmups.find((w) => w.id === wid);
    if (warmup) {
      warmup.exercises.forEach((ex) => {
        exercises.push({ ...ex, _isWarmup: true, _warmupName: warmup.name });
      });
    }
  });
  return exercises;
}

// ─── CARDIO ROUTINES ──────────────────────────────────────
// Cardio routines are reusable mini-routines that can be attached to workouts.
// They appear after warm-ups and before main exercises.

const DEFAULT_CARDIOS = [
  {
    id: 'default-steady-state',
    name: 'Steady State Cardio',
    exercises: [
      { id: 'cd1', name: 'Incline Walk', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '10 min, 10% incline' },
      { id: 'cd2', name: 'Jump Rope', sets: 3, reps: '2 min', rest: 30, rpe: 'RPE 6', note: '' },
      { id: 'cd3', name: 'Rowing', sets: 1, reps: 'Cont.', rest: 0, rpe: 'RPE 5', note: '10 min steady pace' },
    ],
    createdAt: Date.now(),
  },
];

const DEFAULT_CARDIO_ID_SET = new Set(DEFAULT_CARDIOS.map((c) => c.id));
const LEGACY_CARDIO_NAME_SET = new Set([
  'cardio',
  'steady state',
  'steady state cardio',
  'hiit cardio',
]);

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

function looksLikeLegacyCardio(cardio) {
  const id = String(cardio.id || '').toLowerCase();
  const name = String(cardio.name || '').toLowerCase().trim();

  if (id.startsWith('default-') || id.startsWith('starter-') || id.startsWith('sample-')) {
    return true;
  }
  if (LEGACY_CARDIO_NAME_SET.has(name)) {
    return true;
  }
  return false;
}

function createCanonicalCardios() {
  return deepClone(DEFAULT_CARDIOS);
}

function upsertCanonicalCardios(cardios, treatLegacyAsStarter = false) {
  const canonical = createCanonicalCardios();
  const custom = cardios.filter((cardio) => {
    if (DEFAULT_CARDIO_ID_SET.has(cardio.id)) return false;
    if (treatLegacyAsStarter && looksLikeLegacyCardio(cardio)) return false;
    return true;
  });

  return [...canonical, ...custom];
}

export function loadCardios() {
  const storedCardios = safeParseArray(safeGetItem(CARDIOS_KEY));
  const storedVersion = readSchemaVersion(CARDIOS_SCHEMA_KEY);
  const needsMigration = storedVersion !== CARDIOS_SCHEMA_VERSION;

  if (!storedCardios) {
    const canonical = createCanonicalCardios();
    saveCardios(canonical);
    return canonical;
  }

  const normalized = storedCardios
    .map((cardio, index) => normalizeCardioRecord(cardio, index))
    .filter(Boolean);

  const migrated = upsertCanonicalCardios(normalized, needsMigration);
  const normalizedJson = JSON.stringify(normalized);
  const migratedJson = JSON.stringify(migrated);

  if (shouldWriteBack(needsMigration, normalizedJson, migratedJson)) {
    saveCardios(migrated);
  }

  return migrated;
}

export function saveCardios(cardios) {
  safeSetItem(CARDIOS_KEY, JSON.stringify(cardios));
  safeSetItem(CARDIOS_SCHEMA_KEY, String(CARDIOS_SCHEMA_VERSION));
}

export function createCardio(cardio) {
  const cardios = loadCardios();
  const newCardio = {
    ...cardio,
    id: generateId(),
    createdAt: Date.now(),
  };
  cardios.push(newCardio);
  saveCardios(cardios);
  return newCardio;
}

export function updateCardio(id, updates) {
  const cardios = loadCardios();
  const idx = cardios.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  cardios[idx] = { ...cardios[idx], ...updates };
  saveCardios(cardios);
  return cardios[idx];
}

export function deleteCardio(id) {
  const cardios = loadCardios().filter((c) => c.id !== id);
  saveCardios(cardios);
  // Also remove this cardio from any workouts that reference it
  const workouts = loadWorkouts();
  let modified = false;
  workouts.forEach((workout) => {
    if (workout.cardioIds && workout.cardioIds.includes(id)) {
      workout.cardioIds = workout.cardioIds.filter((cid) => cid !== id);
      modified = true;
    }
  });
  if (modified) saveWorkouts(workouts);
  return cardios;
}

export function resetAllCardios() {
  const canonical = createCanonicalCardios();
  saveCardios(canonical);
  return canonical;
}

// Get cardio exercises for a workout (resolves cardioIds to exercise arrays)
export function getCardioExercisesForWorkout(workout) {
  if (!workout?.cardioIds || workout.cardioIds.length === 0) return [];
  const cardios = loadCardios();
  const exercises = [];
  workout.cardioIds.forEach((cid) => {
    const cardio = cardios.find((c) => c.id === cid);
    if (cardio) {
      cardio.exercises.forEach((ex) => {
        exercises.push({ ...ex, _isCardio: true, _cardioName: cardio.name });
      });
    }
  });
  return exercises;
}
