const ACTIVE_SESSION_KEY = 'eliteTimer_activeSession';
const SETTINGS_KEY = 'eliteTimer_settings';
const SETTINGS_LIMITS = Object.freeze({
  sessionMinutes: { min: 1, max: 180, fallback: 60 },
  intervalSeconds: { min: 5, max: 600, fallback: 30 },
});
const SETTINGS_PRESETS = Object.freeze([
  'workoutDefaults',
  'timerOnlyDefaults',
]);

function normalizeBoundedNumber(value, limits) {
  if (typeof value === 'string' && value.trim() === '') {
    return limits.fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return limits.fallback;
  }
  return Math.max(limits.min, Math.min(limits.max, parsed));
}

function normalizeTimingPreset(preset) {
  const source = preset && typeof preset === 'object' ? preset : {};

  return {
    sessionMinutes: normalizeBoundedNumber(source.sessionMinutes, SETTINGS_LIMITS.sessionMinutes),
    intervalSeconds: normalizeBoundedNumber(source.intervalSeconds, SETTINGS_LIMITS.intervalSeconds),
  };
}

export function normalizeSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const legacyPreset = normalizeTimingPreset(source);
  const hasNestedPreset = SETTINGS_PRESETS.some((key) => {
    return source[key] && typeof source[key] === 'object';
  });

  if (!hasNestedPreset) {
    return {
      workoutDefaults: legacyPreset,
      timerOnlyDefaults: legacyPreset,
    };
  }

  return {
    workoutDefaults: normalizeTimingPreset(source.workoutDefaults ?? legacyPreset),
    timerOnlyDefaults: normalizeTimingPreset(source.timerOnlyDefaults ?? legacyPreset),
  };
}

export function saveSessionState(state) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save session state:', err);
  }
}

export function loadSessionState() {
  try {
    const data = localStorage.getItem(ACTIVE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load session state:', err);
    return null;
  }
}

export function clearSessionState() {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear session state:', err);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return normalizeSettings(null);
    return normalizeSettings(JSON.parse(data));
  } catch {
    return normalizeSettings(null);
  }
}
