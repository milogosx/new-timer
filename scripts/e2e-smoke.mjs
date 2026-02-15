import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE_URL = process.env.E2E_BASE_URL || `http://${HOST}:${PORT}`;
const DIST_DIR = path.resolve('dist');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relativePath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\//, '');
      let filePath = path.resolve(DIST_DIR, relativePath);

      if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      let body;
      try {
        body = await readFile(filePath);
      } catch {
        filePath = path.resolve(DIST_DIR, 'index.html');
        body = await readFile(filePath);
      }

      res.writeHead(200, {
        'Content-Type': resolveContentType(filePath),
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Server error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  return server;
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

async function main() {
  const server = await startStaticServer();

  try {
    await runSmokeFlow();
    console.log('E2E smoke flow passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error('E2E smoke flow failed:', err);
  process.exitCode = 1;
});
