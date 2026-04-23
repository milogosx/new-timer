const TRACE_KEY = '__ER_RUNTIME_TRACE__';
const TRACE_LIMIT = 200;

function getRelativeMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return Math.round(performance.now());
  }

  return 0;
}

function getTraceStore() {
  const existing = globalThis[TRACE_KEY];
  if (Array.isArray(existing)) {
    return existing;
  }

  const nextStore = [];
  globalThis[TRACE_KEY] = nextStore;
  return nextStore;
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          return [key, String(value)];
        }

        return [key, value];
      })
  );
}

export function traceRuntime(event, details = {}) {
  const entry = {
    event,
    at: new Date().toISOString(),
    relativeMs: getRelativeMs(),
    details: sanitizeDetails(details),
  };

  const traceStore = getTraceStore();
  traceStore.push(entry);
  if (traceStore.length > TRACE_LIMIT) {
    traceStore.splice(0, traceStore.length - TRACE_LIMIT);
  }

  const suffix = Object.keys(entry.details).length > 0
    ? ` ${JSON.stringify(entry.details)}`
    : '';
  console.info(`[runtime] +${entry.relativeMs}ms ${entry.event}${suffix}`);

  return entry;
}

export function readRuntimeTrace() {
  return [...getTraceStore()];
}

export function clearRuntimeTrace() {
  globalThis[TRACE_KEY] = [];
}
