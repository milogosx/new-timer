#!/usr/bin/env node
/**
 * Voice pack sync + verify.
 *
 * Cross-checks that every slug in audio-manifest/voice-pack.json has a
 * matching rendered WAV, is present in speechCueCatalog.js, and is listed
 * in EliteTimerRuntimePlugin.swift. Then copies audio-manifest/rendered/
 * into both bundle locations (public/audio + ios/App/App/public/audio).
 *
 * Exits non-zero if anything is out of sync so this can gate CI.
 */

import { readFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MANIFEST_PATH = join(ROOT, 'audio-manifest', 'voice-pack.json');
const RENDERED_DIR = join(ROOT, 'audio-manifest', 'rendered');
const CATALOG_PATH = join(ROOT, 'src', 'utils', 'speechCueCatalog.js');
const SWIFT_PATH = join(ROOT, 'ios', 'App', 'App', 'EliteTimerRuntimePlugin.swift');
const BUNDLE_DIRS = [
  join(ROOT, 'public', 'audio'),
  join(ROOT, 'ios', 'App', 'App', 'public', 'audio'),
];

function expectedCatalogSlugs() {
  const structural = [
    'start_warmup',
    'warmup_complete',
    'quarter_way',
    'halfway',
    'three_quarters',
    'five_minutes',
    'one_minute',
    'workout_complete',
  ];
  const warmup = Array.from({ length: 15 }, (_, i) =>
    `warmup_coach_${String(i + 1).padStart(2, '0')}`
  );
  const workout = Array.from({ length: 30 }, (_, i) =>
    `workout_coach_${String(i + 1).padStart(2, '0')}`
  );
  return [...structural, ...warmup, ...workout];
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const manifestSlugs = manifest.items.map((item) => item.slug);

  const renderedFiles = new Set(
    (await readdir(RENDERED_DIR)).filter((name) => name.endsWith('.wav'))
  );

  const catalogSource = await readFile(CATALOG_PATH, 'utf8');
  const swiftSource = await readFile(SWIFT_PATH, 'utf8');

  const expectedSlugs = expectedCatalogSlugs();
  const problems = [];

  const manifestSet = new Set(manifestSlugs);
  const expectedSet = new Set(expectedSlugs);

  for (const slug of expectedSet) {
    if (!manifestSet.has(slug)) problems.push(`manifest missing slug: ${slug}`);
    if (!renderedFiles.has(`${slug}.wav`)) problems.push(`rendered missing: ${slug}.wav`);
    // Structural slugs are literal; coaching slugs are generated in JS/Swift
    // from loops, so we only assert literal presence for the structural set.
    const isCoaching = /^(warmup|workout)_coach_/.test(slug);
    if (!isCoaching) {
      if (!catalogSource.includes(slug)) problems.push(`catalog missing slug: ${slug}`);
      if (!swiftSource.includes(slug)) problems.push(`swift missing slug: ${slug}`);
    }
  }

  for (const slug of manifestSet) {
    if (!expectedSet.has(slug)) problems.push(`manifest has unexpected slug: ${slug}`);
  }

  if (problems.length) {
    console.error('Voice pack sync: problems detected:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  for (const dest of BUNDLE_DIRS) {
    if (!existsSync(dest)) await mkdir(dest, { recursive: true });
    for (const slug of expectedSet) {
      const file = `${slug}.wav`;
      await copyFile(join(RENDERED_DIR, file), join(dest, file));
    }
  }

  console.log(
    `Voice pack sync: ${expectedSet.size} cues verified and copied to ${BUNDLE_DIRS.length} bundles.`
  );
}

await main();
