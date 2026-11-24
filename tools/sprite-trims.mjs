// Precomputes every bundled sprite's opaque trim (src/data/spriteTrims.json) so
// the game never decodes artwork and reads its pixels back at runtime.
// Measures in Chromium with the same sampling as spriteBounds.ts, so SVG sizing
// and colour decoding match the browser exactly. Only new or changed files
// (by content hash) are measured; unchanged runs never launch a browser.
//   node tools/sprite-trims.mjs            update the manifest
//   node tools/sprite-trims.mjs --check    fail if the manifest is stale
//   node tools/sprite-trims.mjs --if-present  warn instead of failing when Chromium is unavailable
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(game, 'public');
const manifestPath = path.join(game, 'src/data/spriteTrims.json');
const check = process.argv.includes('--check');
const optional = process.argv.includes('--if-present');
// Keep in step with spriteBounds.ts.
const SAMPLE_SIZE = 128, ALPHA_THRESHOLD = 24;
const IMAGE = /\.(png|webp|svg|gif|jpe?g)$/i;
const MIME = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : IMAGE.test(entry.name) ? [file] : [];
});
// Generation sources and prompts never reach the game.
const files = walk(path.join(publicRoot, 'assets'))
  .map(file => path.relative(publicRoot, file).split(path.sep).join('/'))
  .filter(rel => !rel.startsWith('assets/sources/'))
  .sort();
const hashOf = rel => crypto.createHash('sha1').update(fs.readFileSync(path.join(publicRoot, rel))).digest('hex').slice(0, 10);

const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, sprites: {} };
const hashes = Object.fromEntries(files.map(rel => [rel, hashOf(rel)]));
const stale = files.filter(rel => previous.sprites?.[rel]?.hash !== hashes[rel]);
const removed = Object.keys(previous.sprites ?? {}).filter(rel => !(rel in hashes));

if (check) {
  if (stale.length || removed.length) {
    console.error(`Sprite trims are stale: ${stale.length} new/changed, ${removed.length} removed. Run: node tools/sprite-trims.mjs`);
    process.exit(1);
  }
  console.log(`Sprite trims match ${files.length} bundled images.`);
  process.exit(0);
}
if (!stale.length && !removed.length) { console.log(`Sprite trims current (${files.length} images).`); process.exit(0); }

const measured = {};
if (stale.length) {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = `Sprite trims not updated (${stale.length} stale): Chromium unavailable. Unlisted sprites are measured at runtime.`;
    if (optional) { console.warn(message); process.exit(0); }
    console.error(message); throw error;
  }
  try {
    const page = await browser.newPage();
    // Serve public/ on a private origin so canvases stay untainted.
    await page.route('http://sprites.local/**', route => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
      const file = path.join(publicRoot, rel);
      if (!file.startsWith(publicRoot) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ status: 200, contentType: MIME[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream', body: fs.readFileSync(file) });
    });
    await page.route('http://sprites.local/', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>trims</title>' }));
    await page.goto('http://sprites.local/');
    for (let i = 0; i < stale.length; i += 24) {
      const batch = stale.slice(i, i + 24);
      const results = await page.evaluate(async ({ batch, size, threshold }) => Promise.all(batch.map(rel => new Promise(resolve => {
        const image = new Image();
        image.onerror = () => resolve([rel, null]);
        image.onload = () => {
          const full = { x0: 0, y0: 0, x1: 1, y1: 1, aspect: image.naturalWidth / Math.max(1, image.naturalHeight) };
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, size, size);
          const alpha = context.getImageData(0, 0, size, size).data;
          let minX = size, minY = size, maxX = -1, maxY = -1;
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (alpha[(y * size + x) * 4 + 3] > threshold) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
          if (maxX < 0) return resolve([rel, full]);
          const b = { x0: minX / size, y0: minY / size, x1: (maxX + 1) / size, y1: (maxY + 1) / size };
          resolve([rel, { ...b, aspect: ((b.x1 - b.x0) * image.naturalWidth) / Math.max(1, (b.y1 - b.y0) * image.naturalHeight) }]);
        };
        image.src = '/' + rel.split('/').map(encodeURIComponent).join('/');
      }))), { batch, size: SAMPLE_SIZE, threshold: ALPHA_THRESHOLD });
      for (const [rel, bounds] of results) if (bounds) measured[rel] = bounds;
        else console.warn('Could not decode', rel);
    }
  } finally { await browser.close(); }
}

const round = n => Math.round(n * 1e6) / 1e6;
const sprites = {};
for (const rel of files) {
  const bounds = measured[rel] ?? (previous.sprites?.[rel]?.hash === hashes[rel] ? previous.sprites[rel] : undefined);
  if (!bounds) continue;
  sprites[rel] = { x0: round(bounds.x0), y0: round(bounds.y0), x1: round(bounds.x1), y1: round(bounds.y1), aspect: round(bounds.aspect), hash: hashes[rel] };
}
// One sprite per line keeps art changes reviewable.
const lines = Object.entries(sprites).map(([rel, value]) => `  ${JSON.stringify(rel)}: ${JSON.stringify(value)}`);
fs.writeFileSync(manifestPath, `{\n "version": 1,\n "sampleSize": ${SAMPLE_SIZE},\n "alphaThreshold": ${ALPHA_THRESHOLD},\n "sprites": {\n${lines.join(',\n')}\n }\n}\n`);
console.log(`Sprite trims: measured ${Object.keys(measured).length}, removed ${removed.length}, total ${Object.keys(sprites).length}.`);
