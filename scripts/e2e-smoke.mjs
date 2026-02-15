import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const START_TIMEOUT_MS = 30_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function runSmokeFlow() {
  await mkdir('output/playwright', { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('.home-screen').waitFor({ state: 'visible' });
    await page.locator('.workout-card').first().click();

    await page.locator('.timer-screen').waitFor({ state: 'visible' });
    const mainButton = page.locator('.ctrl-btn-main');
    const resetButton = page.locator('.ctrl-btn-reset');

    await mainButton.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('.ctrl-btn-main');
      return btn && btn.textContent && btn.textContent.trim() === 'PAUSE';
    }, { timeout: 12_000 });

    await mainButton.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('.ctrl-btn-main');
      return btn && btn.textContent && btn.textContent.trim() === 'RESUME';
    }, { timeout: 5_000 });

    await mainButton.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('.ctrl-btn-main');
      return btn && btn.textContent && btn.textContent.trim() === 'PAUSE';
    }, { timeout: 5_000 });

    await resetButton.click();
    await page.locator('.dialog-box').waitFor({ state: 'visible' });
    await page.locator('.dialog-btn-confirm', { hasText: 'RESET' }).click();

    await page.waitForFunction(() => {
      const btn = document.querySelector('.ctrl-btn-main');
      return btn && btn.textContent && btn.textContent.trim() === 'START';
    }, { timeout: 5_000 });
  } catch (err) {
    await page.screenshot({ path: 'output/playwright/e2e-smoke-failure.png', fullPage: true });
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function stopServer(server) {
  if (!server || server.killed) return;

  const closePromise = new Promise((resolve) => {
    server.once('close', resolve);
    server.once('exit', resolve);
  });

  server.kill('SIGTERM');
  const didCloseGracefully = await Promise.race([
    closePromise.then(() => true),
    sleep(3000).then(() => false),
  ]);

  if (!didCloseGracefully) {
    server.kill('SIGKILL');
    await Promise.race([
      closePromise,
      sleep(3000),
    ]);
  }
}

async function main() {
  const server = spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    { stdio: 'pipe' }
  );

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    await runSmokeFlow();
    console.log('E2E smoke flow passed.');
  } finally {
    await stopServer(server);
  }
}

main().catch((err) => {
  console.error('E2E smoke flow failed:', err);
  process.exitCode = 1;
});
