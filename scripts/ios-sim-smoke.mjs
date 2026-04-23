import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SIMULATOR_NAME = process.env.IOS_SIMULATOR_NAME || 'iPhone 17';
const DERIVED_DATA_PATH = process.env.IOS_SIM_DERIVED_DATA || '/tmp/new-timer-ios-sim';
const OUTPUT_DIR = path.resolve(process.env.IOS_SIM_OUTPUT_DIR || 'output/ios-sim');
const POST_LAUNCH_WAIT_MS = Number(process.env.IOS_SIM_LAUNCH_WAIT_MS || '20000');
const PROJECT_PATH = 'ios/App/App.xcodeproj';
const SCHEME = 'App';
const BUNDLE_ID = 'com.eliterecomposition.timer';
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'latest.png');
const STDOUT_LOG_PATH = path.join(OUTPUT_DIR, 'app-stdout.log');
const STDERR_LOG_PATH = path.join(OUTPUT_DIR, 'app-stderr.log');
const SYSLOG_PATH = path.join(OUTPUT_DIR, 'system-build.log');

function runCommand(command, args, { allowFailure = false, stdio = 'pipe' } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio,
  });

  if (result.status !== 0 && !allowFailure) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${details || 'No command output'}`
    );
  }

  return result;
}

function runText(command, args, options) {
  return runCommand(command, args, options).stdout.trim();
}

async function resolveExpectedBundleId() {
  const html = await readFile('ios/App/App/public/index.html', 'utf8');
  const match = html.match(/assets\/(index-[^"]+\.js)/);
  return match ? match[1] : 'unknown';
}

function resolveSimulator() {
  if (process.env.IOS_SIMULATOR_ID) {
    return {
      udid: process.env.IOS_SIMULATOR_ID,
      name: process.env.IOS_SIMULATOR_ID,
      state: 'unknown',
    };
  }

  const raw = runText('xcrun', ['simctl', 'list', 'devices', 'available', '-j']);
  const { devices } = JSON.parse(raw);
  const runtimes = Object.entries(devices)
    .filter(([runtime]) => runtime.toLowerCase().includes('ios'))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));

  const latestDevices = runtimes.at(-1)?.[1] || [];
  const iPhones = latestDevices.filter((device) => device.isAvailable && device.name.startsWith('iPhone'));
  const preferred = iPhones.find((device) => device.name === DEFAULT_SIMULATOR_NAME) || iPhones[0];

  if (!preferred) {
    throw new Error('No available iPhone simulator runtime was found.');
  }

  return preferred;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureBuildLog(udid) {
  const systemLog = runText(
    'xcrun',
    [
      'simctl',
      'spawn',
      udid,
      'log',
      'show',
      '--last',
      '5m',
      '--style',
      'compact',
      '--predicate',
      'eventMessage CONTAINS "[build]"',
    ],
    { allowFailure: true }
  );

  await rm(SYSLOG_PATH, { force: true });
  if (systemLog) {
    await writeFile(SYSLOG_PATH, systemLog);
  }

  return systemLog;
}

async function main() {
  const simulator = resolveSimulator();
  const expectedGitSha = runText('git', ['rev-parse', '--short', 'HEAD']);
  let expectedBundleId = 'unknown';

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    rm(SCREENSHOT_PATH, { force: true }),
    rm(STDOUT_LOG_PATH, { force: true }),
    rm(STDERR_LOG_PATH, { force: true }),
    rm(SYSLOG_PATH, { force: true }),
  ]);

  console.log(`Using simulator: ${simulator.name} (${simulator.udid})`);
  console.log('Syncing web assets into the iOS shell...');
  runCommand('npm', ['run', 'ios:sync'], { stdio: 'inherit' });
  expectedBundleId = await resolveExpectedBundleId();

  console.log('Booting simulator...');
  runCommand('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', simulator.udid], {
    allowFailure: true,
  });
  runCommand('xcrun', ['simctl', 'boot', simulator.udid], { allowFailure: true });
  runCommand('xcrun', ['simctl', 'bootstatus', simulator.udid, '-b'], { stdio: 'inherit' });

  console.log('Building Debug app for the simulator...');
  runCommand(
    'xcodebuild',
    [
      '-project',
      PROJECT_PATH,
      '-scheme',
      SCHEME,
      '-configuration',
      'Debug',
      '-destination',
      `id=${simulator.udid}`,
      '-derivedDataPath',
      DERIVED_DATA_PATH,
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    { stdio: 'inherit' }
  );

  const appPath = path.join(DERIVED_DATA_PATH, 'Build/Products/Debug-iphonesimulator/App.app');

  console.log('Installing app into the simulator...');
  runCommand('xcrun', ['simctl', 'uninstall', simulator.udid, BUNDLE_ID], { allowFailure: true });
  runCommand('xcrun', ['simctl', 'install', simulator.udid, appPath], { stdio: 'inherit' });

  console.log('Launching app...');
  runCommand(
    'xcrun',
    [
      'simctl',
      'launch',
      '--terminate-running-process',
      `--stdout=${STDOUT_LOG_PATH}`,
      `--stderr=${STDERR_LOG_PATH}`,
      simulator.udid,
      BUNDLE_ID,
    ],
    { stdio: 'inherit' }
  );

  await wait(POST_LAUNCH_WAIT_MS);

  console.log('Capturing screenshot...');
  runCommand('xcrun', ['simctl', 'io', simulator.udid, 'screenshot', '--mask=ignored', SCREENSHOT_PATH], {
    stdio: 'inherit',
  });

  const [stdoutLog, stderrLog, systemLog] = await Promise.all([
    readFile(STDOUT_LOG_PATH, 'utf8').catch(() => ''),
    readFile(STDERR_LOG_PATH, 'utf8').catch(() => ''),
    captureBuildLog(simulator.udid),
  ]);

  const combinedLogs = [stdoutLog, stderrLog, systemLog].filter(Boolean).join('\n');
  const buildLine = combinedLogs
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes('[build]') && !line.includes('log run noninteractively'));

  const buildLineMatchesExpected = Boolean(
    buildLine
      && buildLine.includes(`sha=${expectedGitSha}`)
      && buildLine.includes(`bundle=${expectedBundleId}`)
  );

  console.log('');
  console.log('iOS simulator smoke summary');
  console.log(`- simulator: ${simulator.name}`);
  console.log(`- expected git sha: ${expectedGitSha}`);
  console.log(`- expected bundle: ${expectedBundleId}`);
  console.log(`- screenshot: ${SCREENSHOT_PATH}`);
  console.log(`- stdout log: ${STDOUT_LOG_PATH}`);
  console.log(`- stderr log: ${STDERR_LOG_PATH}`);
  console.log(`- post-launch wait: ${POST_LAUNCH_WAIT_MS}ms`);
  if (systemLog) {
    console.log(`- system log: ${SYSLOG_PATH}`);
  }

  if (buildLine) {
    console.log(`- build log: ${buildLine}`);
    console.log(`- build log matches expected bundle: ${buildLineMatchesExpected ? 'yes' : 'no'}`);
  } else {
    console.log('- build log: not captured from simulator output; use the screenshot as the primary verification artifact');
  }

  console.log('');
  console.log('This smoke run verifies build sync, simulator install, app launch, and a screenshot artifact.');
  console.log('It does not verify lock-screen behavior, background survival, bell feel, or hardware-specific audio/haptics.');
}

main().catch((error) => {
  console.error('iOS simulator smoke failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
