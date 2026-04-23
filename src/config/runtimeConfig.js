function normalizeBaseUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

function canUseOrigin(origin) {
  return typeof origin === 'string'
    && (origin.startsWith('http://') || origin.startsWith('https://'));
}

export function getProfileSyncBaseUrl({
  env = import.meta?.env,
  location = globalThis.location,
} = {}) {
  const explicitBaseUrl = normalizeBaseUrl(env?.VITE_PROFILE_SYNC_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const locationOrigin = normalizeBaseUrl(location?.origin);
  if (canUseOrigin(locationOrigin)) {
    return locationOrigin;
  }

  return '';
}

export function resolveProfileSyncUrl(path, options = {}) {
  if (typeof path !== 'string' || path.length === 0) {
    return '';
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getProfileSyncBaseUrl(options);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export function detectNativeShell({
  capacitor = globalThis.window?.Capacitor,
} = {}) {
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === 'function') {
    return capacitor.isNativePlatform();
  }
  return Boolean(capacitor.platform && capacitor.platform !== 'web');
}

export function getRuntimeEnvironment(options = {}) {
  return detectNativeShell(options) ? 'native-shell' : 'web';
}
