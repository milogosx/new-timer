import test from 'node:test';
import assert from 'node:assert/strict';

function createDocument(visibilityState = 'visible') {
  const listeners = new Map();

  return {
    visibilityState,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    },
  };
}

function createAudioContextHarness({
  initialState = 'running',
  stateForInstance,
  resumeBehavior,
} = {}) {
  const instances = [];

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

    start() {}
  }

  class FakeAudioContext {
    constructor() {
      this.sampleRate = 44_100;
      this.destination = {};
      this.currentTime = 0;
      this.instanceIndex = instances.length;
      this.state = typeof stateForInstance === 'function'
        ? stateForInstance(this.instanceIndex)
        : initialState;
      this.closeCalls = 0;
      this.resumeCalls = 0;
      instances.push(this);
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

    async close() {
      this.closeCalls += 1;
      this.state = 'closed';
    }

    resume() {
      this.resumeCalls += 1;
      if (typeof resumeBehavior === 'function') {
        return resumeBehavior.call(this);
      }
      this.state = 'running';
      return Promise.resolve();
    }
  }

  return { FakeAudioContext, instances };
}

function restoreProperty(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  delete globalThis[name];
}

async function loadAudioManager(options = {}) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  const documentStub = createDocument();
  const { FakeAudioContext, instances } = createAudioContextHarness(options);

  let now = 1_000;
  Date.now = () => now;

  globalThis.document = documentStub;
  globalThis.window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
  };
  globalThis.fetch = async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      vibrate() {},
      audioSession: { type: 'ambient' },
    },
  });
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};

  const moduleUrl = new URL(`../src/utils/audioManager.js?test=${Math.random()}`, import.meta.url);
  const audioManager = await import(moduleUrl.href);

  return {
    audioManager,
    instances,
    setNow(value) {
      now = value;
    },
    restore() {
      Date.now = originalDateNow;
      console.info = originalConsoleInfo;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.fetch = originalFetch;
      restoreProperty('navigator', originalNavigator);
    },
  };
}

test('stalled playback recovery rebuilds the graph without replacing a running AudioContext', async () => {
  const harness = await loadAudioManager();

  try {
    harness.audioManager.initAudio();
    await harness.audioManager.playBell();

    assert.equal(harness.instances.length, 1);

    harness.setNow(5_000);
    const ready = await harness.audioManager.ensurePlaybackReady();

    assert.equal(ready, true);
    assert.equal(harness.instances.length, 1);
    assert.equal(harness.instances[0].closeCalls, 0);
  } finally {
    harness.restore();
  }
});

test('ensurePlaybackReady returns false when resume hangs instead of blocking indefinitely', async () => {
  const harness = await loadAudioManager({
    initialState: 'suspended',
    resumeBehavior() {
      return new Promise(() => {});
    },
  });

  try {
    harness.audioManager.initAudio();

    const result = await Promise.race([
      harness.audioManager.ensurePlaybackReady(),
      new Promise((resolve) => setTimeout(() => resolve('timed-out'), 1_000)),
    ]);

    assert.equal(result, false);
    assert.equal(harness.instances.length, 1);
    assert.ok(harness.instances[0].resumeCalls >= 1);
  } finally {
    harness.restore();
  }
});

test('manuallyRecoverAudio hard-resets the context when a suspended resume stays stuck', async () => {
  const harness = await loadAudioManager({
    stateForInstance(instanceIndex) {
      return instanceIndex === 0 ? 'suspended' : 'running';
    },
    resumeBehavior() {
      if (this.instanceIndex === 0) {
        return new Promise(() => {});
      }
      this.state = 'running';
      return Promise.resolve();
    },
  });

  try {
    harness.audioManager.initAudio();

    const recovered = await harness.audioManager.manuallyRecoverAudio();

    assert.equal(recovered, true);
    assert.equal(harness.instances.length, 2);
    assert.equal(harness.instances[0].closeCalls, 1);
    assert.ok(harness.instances[0].resumeCalls >= 1);
  } finally {
    harness.restore();
  }
});
