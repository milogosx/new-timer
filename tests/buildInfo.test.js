import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBuildInfo,
  logBuildInfoOnce,
  resetBuildInfoLogForTests,
} from '../src/config/buildInfo.js';

test('getBuildInfo reports bundle and runtime metadata from the active module script', () => {
  const buildInfo = getBuildInfo({
    version: '1.2.3',
    gitSha: 'abc1234',
    buildTime: '2026-03-20T18:45:00.000Z',
    runtimeOptions: {
      capacitor: {
        isNativePlatform() {
          return true;
        },
      },
    },
    document: {
      baseURI: 'capacitor://localhost/',
      querySelector() {
        return {
          getAttribute() {
            return '/assets/index-HYl7yD11.js';
          },
        };
      },
    },
  });

  assert.equal(buildInfo.version, '1.2.3');
  assert.equal(buildInfo.gitSha, 'abc1234');
  assert.equal(buildInfo.runtimeEnvironment, 'native-shell');
  assert.equal(buildInfo.bundlePath, '/assets/index-HYl7yD11.js');
  assert.equal(buildInfo.bundleId, 'index-HYl7yD11.js');
  assert.notEqual(buildInfo.buildTimeLabel, 'unknown build time');
});

test('logBuildInfoOnce only emits one boot log per session', () => {
  const logLines = [];
  const originalConsoleInfo = console.info;

  resetBuildInfoLogForTests();
  console.info = (...args) => {
    logLines.push(args.join(' '));
  };

  try {
    logBuildInfoOnce({
      version: '9.9.9',
      gitSha: 'deadbee',
      buildTime: '2026-03-20T19:00:00.000Z',
      document: {
        baseURI: 'http://localhost:5173/',
        querySelector() {
          return {
            getAttribute() {
              return '/src/main.jsx';
            },
          };
        },
      },
    });

    logBuildInfoOnce({
      version: '9.9.9',
      gitSha: 'deadbee',
      buildTime: '2026-03-20T19:00:00.000Z',
      document: {
        baseURI: 'http://localhost:5173/',
        querySelector() {
          return {
            getAttribute() {
              return '/src/main.jsx';
            },
          };
        },
      },
    });
  } finally {
    console.info = originalConsoleInfo;
    resetBuildInfoLogForTests();
  }

  assert.equal(logLines.length, 1);
  assert.match(logLines[0], /\[build\]/);
  assert.match(logLines[0], /bundle=main\.jsx/);
  assert.match(logLines[0], /sha=deadbee/);
});
