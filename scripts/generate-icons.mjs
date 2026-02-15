import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const svgBuffer = readFileSync(resolve(publicDir, 'icon.svg'));

const icons = [
  { size: 32, name: 'favicon-32x32.png' },
  { size: 64, name: 'favicon-64x64.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
];

for (const { size, name } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

// Generate favicon.ico (use 32x32 PNG as base)
await sharp(svgBuffer)
  .resize(32, 32)
  .png()
  .toFile(resolve(publicDir, 'favicon.png'));

console.log('All icons generated!');
