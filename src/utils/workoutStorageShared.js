export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`Failed to read localStorage key "${key}":`, err);
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to write localStorage key "${key}":`, err);
    return false;
  }
}

export function safeParseArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('Failed to parse stored array JSON:', err);
    return null;
  }
}

export function safeParseStringArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item) => typeof item === 'string' && item.trim());
  } catch (err) {
    console.error('Failed to parse stored string array JSON:', err);
    return null;
  }
}

export function loadDeletedDefaultIds(key) {
  return new Set(safeParseStringArray(safeGetItem(key)) || []);
}

export function saveDeletedDefaultIds(key, ids) {
  safeSetItem(key, JSON.stringify([...new Set(ids)]));
}

export function readSchemaVersion(key) {
  const raw = safeGetItem(key);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldWriteBack(needsMigration, normalizedJson, migratedJson) {
  return needsMigration || normalizedJson !== migratedJson;
}

export function normalizeExerciseRecord(exercise, index) {
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
