const ACTIVE_SESSION_KEY = 'eliteTimer_activeSession';
const SETTINGS_KEY = 'eliteTimer_settings';
const AUDIO_PREFS_KEY = 'eliteTimer_audioPrefs';
const DEFAULT_AUDIO_PREFS = { bgmEnabled: false };

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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { sessionMinutes: 60, intervalSeconds: 30 };
  } catch {
    return { sessionMinutes: 60, intervalSeconds: 30 };
  }
}

export function saveAudioPreferences(preferences) {
  try {
    const next = {
      ...DEFAULT_AUDIO_PREFS,
      ...(preferences || {}),
      bgmEnabled: Boolean(preferences?.bgmEnabled),
    };
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save audio preferences:', err);
  }
}

export function loadAudioPreferences() {
  try {
    const data = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!data) return { ...DEFAULT_AUDIO_PREFS };

    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_AUDIO_PREFS,
      ...(parsed || {}),
      bgmEnabled: Boolean(parsed?.bgmEnabled),
    };
  } catch (err) {
    console.error('Failed to load audio preferences:', err);
    return { ...DEFAULT_AUDIO_PREFS };
  }
}
