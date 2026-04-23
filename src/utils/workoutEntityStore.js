import { queueCloudProfileSync } from './cloudProfileSync.js';
import {
  loadDeletedDefaultIds,
  readSchemaVersion,
  safeGetItem,
  safeParseArray,
  safeSetItem,
  saveDeletedDefaultIds,
  shouldWriteBack,
} from './workoutStorageShared.js';

const SYNC_FIELDS_BY_SECTION = {
  workouts: {
    schema: 'workoutsSchemaVersion',
    deletedDefaults: 'deletedDefaultWorkoutIds',
  },
  warmups: {
    schema: 'warmupsSchemaVersion',
    deletedDefaults: 'deletedDefaultWarmupIds',
  },
  cardios: {
    schema: 'cardiosSchemaVersion',
    deletedDefaults: 'deletedDefaultCardioIds',
  },
};

function upsertCanonicalRecords(
  records,
  deletedDefaultIds,
  treatLegacyAsStarter,
  createCanonicalRecords,
  looksLikeLegacyRecord,
) {
  const canonical = createCanonicalRecords()
    .filter((record) => !deletedDefaultIds.has(record.id));
  const storedMap = new Map(records.map((record) => [record.id, record]));
  const mergedCanonical = canonical.map((canonicalRecord) => {
    return storedMap.get(canonicalRecord.id) || canonicalRecord;
  });
  const canonicalIdSet = new Set(mergedCanonical.map((record) => record.id));

  const custom = records.filter((record) => {
    if (canonicalIdSet.has(record.id)) return false;
    if (deletedDefaultIds.has(record.id)) return false;
    if (treatLegacyAsStarter && looksLikeLegacyRecord(record)) return false;
    return true;
  });

  return [...mergedCanonical, ...custom];
}

export function createEntityStore({
  section,
  storageKey,
  schemaKey,
  deletedDefaultsKey,
  schemaVersion,
  createCanonicalRecords,
  normalizeRecord,
  looksLikeLegacyRecord,
  isDefaultId,
  buildNewRecord,
}) {
  const syncFields = SYNC_FIELDS_BY_SECTION[section];

  function load() {
    const storedRecords = safeParseArray(safeGetItem(storageKey));
    const deletedDefaultIds = loadDeletedDefaultIds(deletedDefaultsKey);
    const storedVersion = readSchemaVersion(schemaKey);
    const needsMigration = storedVersion !== schemaVersion;

    if (!storedRecords) {
      const canonical = createCanonicalRecords()
        .filter((record) => !deletedDefaultIds.has(record.id));
      save(canonical);
      return canonical;
    }

    const normalized = storedRecords
      .map((record, index) => normalizeRecord(record, index))
      .filter(Boolean);

    const migrated = upsertCanonicalRecords(
      normalized,
      deletedDefaultIds,
      needsMigration,
      createCanonicalRecords,
      looksLikeLegacyRecord,
    );
    const normalizedJson = JSON.stringify(normalized);
    const migratedJson = JSON.stringify(migrated);

    if (shouldWriteBack(needsMigration, normalizedJson, migratedJson)) {
      save(migrated);
    }

    return migrated;
  }

  function save(records) {
    safeSetItem(storageKey, JSON.stringify(records));
    safeSetItem(schemaKey, String(schemaVersion));
    const deletedDefaultIds = [...loadDeletedDefaultIds(deletedDefaultsKey)];
    queueCloudProfileSync({
      [section]: records,
      [syncFields.schema]: schemaVersion,
      [syncFields.deletedDefaults]: deletedDefaultIds,
    });
  }

  function create(record) {
    const records = load();
    const newRecord = buildNewRecord(record);
    records.push(newRecord);
    save(records);
    return newRecord;
  }

  function update(id, updates) {
    const records = load();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...updates };
    save(records);
    return records[index];
  }

  function remove(id) {
    const records = load().filter((record) => record.id !== id);
    if (isDefaultId(id)) {
      const deletedDefaultIds = loadDeletedDefaultIds(deletedDefaultsKey);
      deletedDefaultIds.add(id);
      saveDeletedDefaultIds(deletedDefaultsKey, deletedDefaultIds);
    }
    save(records);
    return records;
  }

  function resetAll() {
    saveDeletedDefaultIds(deletedDefaultsKey, []);
    const canonical = createCanonicalRecords();
    save(canonical);
    return canonical;
  }

  return {
    load,
    save,
    create,
    update,
    remove,
    resetAll,
  };
}
