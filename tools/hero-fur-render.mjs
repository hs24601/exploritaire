// Node-only fixture (no browser): the hero-fur-study sleeping curl beside the
// approved hero-sleeping-body-v3 cutout (plus its bobtail layer), registered in
// the same frame. Rows: full frame, the head enlarged 2×, and about game size.
// Usage: node --import ./tools/ts-resolve.mjs tools/hero-fur-render.mjs [outDir] [seed]
import fs from 'node:fs';
import { decode, encode, canvas, scene, blit, crop } from './png-rgba.mjs';
const P = await import(new URL('../src/proto/heroFurPainter.ts', import.meta.url).href);
const outDir = process.argv[2] ?? 'artifacts/hero-fur-study', seed = Number(process.argv[3] ?? P.HERO_FUR_DEFAULTS.seed);
fs.mkdirSync(outDir, { recursive: true });
const S = 512, G = 16, art = 'public/assets/runtime/characters/hero/sleeping/watercolor/v1';

// The reference, registered into the painter's frame (92% width, 17% from the top).
const body = decode(`${art}/hero-sleeping-body-v3.png`), tail = decode(`${art}/hero-sleeping-bobtail-layer-v3.png`);
const reference = { width: S, height: S, data: new Uint8ClampedArray(S * S * 4) }, k = .92 * S / body.width;
// Nearest-sample straight-alpha over that keeps coverage (png-rgba's blit only paints onto opaque panels).
for (const layer of [body, tail]) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const sx = Math.floor((x - .04 * S) / k), sy = Math.floor((y - .17 * S) / k); if (sx < 0 || sy < 0 || sx >= layer.width || sy >= layer.height) continue;
  const s = (sy * layer.width + sx) * 4, d = (y * S + x) * 4, a = layer.data[s + 3] / 255, keep = reference.data[d + 3] / 255 * (1 - a), out = a + keep; if (!out) continue;
  for (let c = 0; c < 3; c++) reference.data[d + c] = (layer.data[s + c] * a + reference.data[d + c] * keep) / out;
  reference.data[d + 3] = out * 255;
}

const preset = { ...P.HERO_FUR_DEFAULTS, seed };
P.paintHeroSleeping(preset, S); // warm
const times = [];
let painted;
for (let i = 0; i < 3; i++) { const t0 = performance.now(); painted = P.paintHeroSleeping(preset, S); times.push(performance.now() - t0); }
encode(painted, `${outDir}/painted-${seed}.png`);

const face = { x: 20, y: 160, w: 248, h: 200 }, game = 150;
const out = canvas(S * 2 + G * 3, S + face.h * 2 + game + G * 5, 20);
[reference, painted].forEach((img, i) => {
  const x = G + i * (S + G);
  scene(out, x, G, S, S, .86); blit(out, img, 0, 0, S, S, x, G, S, S);
  const fy = S + G * 2, head = crop(img, face.x, face.y, face.w, face.h);
  scene(out, x, fy, face.w * 2, face.h * 2, .86); blit(out, head, 0, 0, face.w, face.h, x, fy, face.w * 2, face.h * 2);
  const gy = fy + face.h * 2 + G; scene(out, x, gy, game * 2, game, .86); blit(out, img, 0, 0, S, S, x + game / 2, gy, game, game);
});
encode(out, `${outDir}/compare-${seed}.png`);
// The face alone at 3×, where ink placement and readability are judged.
const zoom = canvas(face.w * 6 + G * 3, face.h * 3 + G * 2, 20);
[reference, painted].forEach((img, i) => { const x = G + i * (face.w * 3 + G); scene(zoom, x, G, face.w * 3, face.h * 3, .95); blit(zoom, crop(img, face.x, face.y, face.w, face.h), 0, 0, face.w, face.h, x, G, face.w * 3, face.h * 3); });
encode(zoom, `${outDir}/head-${seed}.png`);
const median = times.sort((a, b) => a - b)[1];
console.log(`${P.HERO_FUR_VERSION} seed ${seed}: 512px warm median ${median.toFixed(0)} ms (Node, not a phone or frame-time figure)`);
