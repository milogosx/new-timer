import test from 'node:test';
import assert from 'node:assert/strict';
import { playCountdownCue, playSpeechCue } from '../src/platform/intervalRuntimeBridge.js';

function restoreWindow(hadWindow, originalWindow) {
  if (hadWindow) {
    globalThis.window = originalWindow;
    return;
  }

  delete globalThis.window;
}

function restoreProperty(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  delete globalThis[name];
}

function createDocument(visibilityState = 'visible') {
  return {
    visibilityState,
    addEventListener() {},
    removeEventListener() {},
  };
}

function createAudioContextHarness() {
  class FakeGainNode {
    constructor() {
      this.gain = { value: 1 };
    }

    connect() {}

    disconnect() {}
  }

  class FakeBufferSource {
    constructor() {
      this.onended = null;
    }

    connect() {}

    disconnect() {}

    start() {
      this.onended?.();
    }
  }

  return class FakeAudioContext {
    constructor() {
      this.sampleRate = 44_100;
      this.destination = {};
      this.state = 'running';
    }

    createBuffer(_channels, length) {
      return {
        getChannelData() {
          return new Float32Array(length);
        },
      };
    }

    createBufferSource() {
      return new FakeBufferSource();
    }

    createGain() {
      return new FakeGainNode();
    }

    async decodeAudioData() {
      return { duration: 1 };
    }

    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
  };
}

test('playCountdownCue defers native completion until the reported countdown duration ends', async () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = globalThis.window;
  let scheduledTimeout = null;
  let completionCalls = 0;

  const capacitor = {
    Plugins: {
      EliteTimerRuntime: {
        async playCountdownCue() {
          return {
            countdownDurationMs: 3400,
            ownsCueScheduling: true,
          };
        },
      },
    },
  };

  globalThis.window = {
    Capacitor: capacitor,
    setTimeout(callback, delay) {
      scheduledTimeout = { callback, delay };
      return 1;
    },
  };

  try {
    const result = await playCountdownCue(() => {
      completionCalls += 1;
    }, { capacitor });

    assert.equal(result.countdownDurationMs, 3400);
    assert.equal(completionCalls, 0);
    assert.equal(scheduledTimeout?.delay, 3400);

    scheduledTimeout.callback();
    assert.equal(completionCalls, 1);
  } finally {
    restoreWindow(hadWindow, originalWindow);
  }
});

test('playCountdownCue falls back to the default native countdown duration when none is returned', async () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = globalThis.window;
  let scheduledTimeout = null;

  const capacitor = {
    Plugins: {
      EliteTimerRuntime: {
        async playCountdownCue() {
          return { ownsCueScheduling: true };
        },
      },
    },
  };

  globalThis.window = {
    Capacitor: capacitor,
    setTimeout(callback, delay) {
      scheduledTimeout = { callback, delay };
      return 1;
    },
  };

  try {
    await playCountdownCue(() => {}, { capacitor });
    assert.equal(scheduledTimeout?.delay, 3400);
  } finally {
    restoreWindow(hadWindow, originalWindow);
  }
});

test('playSpeechCue falls back to browser speech when native speech is disabled and the app is visible', async () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const fetchCalls = [];
  const FakeAudioContext = createAudioContextHarness();
  const cueKey = 'speech-visible-fallback-test';

  const capacitor = {
    platform: 'ios',
    Plugins: {
      EliteTimerRuntime: {
        async playSpeechCue() {
          return { speechEnabled: false, key: cueKey };
        },
      },
    },
  };

  globalThis.document = createDocument('visible');
  globalThis.window = {
    Capacitor: capacitor,
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
  };
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      audioSession: { type: 'ambient' },
    },
  });

  try {
    await playSpeechCue(cueKey, { capacitor });
    assert.ok(fetchCalls.some((url) => url.endsWith(`/audio/${cueKey}.wav`)));
  } finally {
    restoreWindow(hadWindow, originalWindow);
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    restoreProperty('navigator', originalNavigator);
  }
});

test('playSpeechCue does not fall back to browser speech when native speech is disabled but the app is hidden', async () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const cueKey = 'speech-hidden-no-fallback-test';
  const fetchCalls = [];

  const capacitor = {
    platform: 'ios',
    Plugins: {
      EliteTimerRuntime: {
        async playSpeechCue() {
          return { speechEnabled: false, key: cueKey };
        },
      },
    },
  };

  globalThis.document = createDocument('hidden');
  globalThis.window = {
    Capacitor: capacitor,
    AudioContext: createAudioContextHarness(),
    webkitAudioContext: createAudioContextHarness(),
  };
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  };

  try {
    const result = await playSpeechCue(cueKey, { capacitor });
    assert.deepEqual(result, { speechEnabled: false, key: cueKey });
    assert.equal(fetchCalls.length, 0);
  } finally {
    restoreWindow(hadWindow, originalWindow);
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});

test('playSpeechCue does not double-play through the browser when native speech is enabled', async () => {
  const hadWindow = 'window' in globalThis;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const cueKey = 'speech-native-owned-test';
  const fetchCalls = [];

  const capacitor = {
    platform: 'ios',
    Plugins: {
      EliteTimerRuntime: {
        async playSpeechCue() {
          return { speechEnabled: true, key: cueKey };
        },
      },
    },
  };

  globalThis.document = createDocument('visible');
  globalThis.window = {
    Capacitor: capacitor,
    AudioContext: createAudioContextHarness(),
    webkitAudioContext: createAudioContextHarness(),
  };
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return {
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  };

  try {
    const result = await playSpeechCue(cueKey, { capacitor });
    assert.deepEqual(result, { speechEnabled: true, key: cueKey });
    assert.equal(fetchCalls.length, 0);
  } finally {
    restoreWindow(hadWindow, originalWindow);
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});
