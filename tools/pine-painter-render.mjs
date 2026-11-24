// Node-only fixture (no browser): renders pine-study-v1 beside the approved
// pine-sprite-v1.png at 1:1, enlarged and at game size, plus a seed sheet and
// a PINE_RULES report. Usage:
//   node --import ./tools/ts-resolve.mjs tools/pine-painter-render.mjs [outDir] [seed]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decode, encode, canvas, scene, stand, bounds, crop } from './png-rgba.mjs';
import { bakePine, paintPine, planPine, pineSilhouette, pineViolations, PINE_DEFAULT_PRESET } from '../src/proto/pinePainter.ts';

const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const outDir = process.argv[2] ?? `${repo}/artifacts/procedural-woods/v1`;
const seed = Number(process.argv[3] ?? PINE_DEFAULT_PRESET.seed);
fs.mkdirSync(outDir, { recursive: true });
const reference = decode(`${repo}/public/assets/runtime/environment/watercolor/v1/pine-sprite-v1.png`);
const preset = { ...PINE_DEFAULT_PRESET, seed };
const fmt = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
console.log('reference', fmt(pineSilhouette(reference)));
// Positive control: the approved pine must pass every raster rule. Its edge carries
// a stray alpha-1 pixel from the supplied file, so only the clipping check is waived.
const refFails = pineViolations(reference).filter(v => !v.startsWith('11 clipped'));
if (refFails.length) { console.error('reference fails PINE_RULES:', refFails); process.exitCode = 1; }

// 1:1 — bake so the painted tree is as tall as the reference's, then crop both.
const rb = bounds(reference), refH = rb.y1 - rb.y0 + 1, big = Math.min(1536, Math.round(refH / .93));
let t0 = performance.now(); const pine = paintPine(preset, big), bigMs = performance.now() - t0;
encode(pine, `${outDir}/pine-${seed}-${big}.png`);
console.log(`seed ${seed} @${big}px: ${bigMs.toFixed(0)} ms`, fmt(pineSilhouette(pine)), bakePine(preset, big).violations);
const pb = bounds(pine), W = Math.max(rb.x1 - rb.x0, pb.x1 - pb.x0) + 40, Hh = Math.max(refH, pb.y1 - pb.y0) + 80;
const one = canvas(W * 2 + 48, Hh + 32);
[[reference, rb], [pine, pb]].forEach(([img, b], k) => { const x = 16 + k * (W + 16); scene(one, x, 16, W, Hh, .96);
  stand(one, img, x, 16, W, Hh, b.y1 - b.y0 + 1, .96); });
encode(one, `${outDir}/compare-1to1.png`);
// 1:1 detail crops: the trunk foot and a shelf on the right flank, same relative spot.
const detail = canvas(2 * 420 + 48, 2 * 420 + 48);
[[reference, rb], [pine, pb]].forEach(([img, b], k) => {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  for (const [row, fx, fy] of [[0, .5, .9], [1, .7, .55]]) {
    const c = crop(img, Math.round(b.x0 + w * fx - 210), Math.round(b.y0 + h * fy - 210), 420, 420);
    scene(detail, 16 + k * 436, 16 + row * 436, 420, 420, 2); stand(detail, c, 16 + k * 436, 16 + row * 436, 420, 420, 420, 1);
  }
});
encode(detail, `${outDir}/detail-1to1.png`);

// Enlarged and game size on one shared scene: 640px and 96px painted height.
const sheet = canvas(2 * 520 + 48, 720 + 140 + 48);
[reference, pine].forEach((img, k) => { const x = 16 + k * 536;
  scene(sheet, x, 16, 520, 720); stand(sheet, img, x, 16, 520, 720, 620);
  scene(sheet, x + 200, 720 + 32, 120, 140); stand(sheet, img, x + 200, 720 + 32, 120, 140, 96); });
encode(sheet, `${outDir}/compare.png`);

// Seed sheet at 512px bakes, shown 300px tall, with rule results.
const seeds = [seed, 2, 31, 404, 777, 1999, 5150, 9001], T = 260, grid = canvas(T * 4, 340 * 2), times = [];
seeds.forEach((s, k) => { const p = { ...PINE_DEFAULT_PRESET, seed: s, slender: (k * .37) % 1, fullness: (k * .53) % 1, droop: (k * .29) % 1, trunk: (k * .61) % 1 };
  const t = performance.now(), img = paintPine(p, 512); times.push(performance.now() - t);
  const x = (k % 4) * T, y = Math.floor(k / 4) * 340; scene(grid, x, y, T, 340); stand(grid, img, x, y, T, 340, 290);
  console.log(`seed ${s}`, bakePine(p, 512).violations.join("; ") || "ok"); });
encode(grid, `${outDir}/seeds.png`);
// Warm timings per size (median of 15 uncached seeds, including any regrowth), and
// the population's silhouette overlap: each silhouette is scaled to a common
// height, centred on its trunk, and compared pairwise by intersection over union.
const report = { sizes: {}, overlap: {} };
for (const size of [256, 512]) { const t = [];
  for (let k = 0; k < 15; k++) { const s0 = performance.now(), b = bakePine({ ...PINE_DEFAULT_PRESET, seed: 20000 + k * 7, slender: (k * .37) % 1, fullness: (k * .53) % 1 }, size); t.push([performance.now() - s0, b.attempt]); }
  t.sort((a, b) => a[0] - b[0]); report.sizes[size] = { medianMs: +t[7][0].toFixed(0), minMs: +t[0][0].toFixed(0), maxMs: +t[14][0].toFixed(0), regrown: t.filter(v => v[1]).length }; }
const masks = [];
for (let k = 0; k < 40; k++) { const p = { ...PINE_DEFAULT_PRESET, seed: 30000 + k * 13, slender: (k * .37) % 1, fullness: (k * .53) % 1, droop: (k * .29) % 1, trunk: (k * .61) % 1 };
  const bake = bakePine(p, 256), img = bake.raster, b = bounds(img), h = b.y1 - b.y0 + 1, m = new Uint8Array(64 * 64), axis = bake.plan.root.x;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const sx = Math.round(axis + (x - 32) * h / 64), sy = Math.round(b.y0 + y * h / 64); if (sx >= 0 && sx < 256 && sy < 256 && img.data[(sy * 256 + sx) * 4 + 3] > 40) m[y * 64 + x] = 1; }
  masks.push(m); }
const ious = []; for (let a = 0; a < masks.length; a++) for (let b = a + 1; b < masks.length; b++) { let i = 0, u = 0; for (let k = 0; k < 4096; k++) { i += masks[a][k] & masks[b][k]; u += masks[a][k] | masks[b][k]; } ious.push(i / u); }
ious.sort((a, b) => a - b);
report.overlap = { pairs: ious.length, mean: +(ious.reduce((a, b) => a + b, 0) / ious.length).toFixed(3), p99: +ious[Math.floor(ious.length * .99)].toFixed(3), max: +ious[ious.length - 1].toFixed(3), min: +ious[0].toFixed(3) };
fs.writeFileSync(`${outDir}/pine-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
