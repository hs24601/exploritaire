// Node-only (no browser): validates Sol's hero orbit paintings against the registration rubric
// (docs/art/hero-orbit-v1.md, R1–R2), then packs them into the runtime sheet and regenerates
// src/proto/heroOrbitAtlas.ts. `--placeholder` packs the proxy guides instead, so the scene
// toggle can be checked before any painting exists.
// Usage: node --import ./tools/ts-resolve.mjs tools/hero-orbit-import.mjs [--placeholder]
import fs from 'node:fs';
import { decode, encode } from './png-rgba.mjs';
const P = await import(new URL('../src/proto/heroOrbitProxy.ts', import.meta.url).href);
const placeholder = process.argv.includes('--placeholder');
const sources = 'public/assets/sources/characters/hero/orbit/watercolor/v1', runtime = 'public/assets/runtime/characters/hero/rig/watercolor/orbit-v1';
const sheetPath = `${runtime}/hero-standing-low-orbit-v1.png`, atlasPath = 'src/proto/heroOrbitAtlas.ts';
// One texel density for every view, near the approved low sheet (about 250 px per figure).
const SCALE = .36, PAD = 6, GAP = 16, SIZE = 1024;

const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
function bounds(img, threshold = 40) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (alphaAt(img, x, y) > threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Registration checks. Failures block packing; notes are for review. */
function check(view, img, guide) {
  const fail = [], note = [];
  if (img.width !== SIZE || img.height !== SIZE) fail.push(`R1: ${img.width}×${img.height}, expected ${SIZE}×${SIZE}`);
  const b = bounds(img), g = bounds(guide);
  if (!b) return { fail: [...fail, 'R1: no painted pixels'], note, b };
  let clear = 0, partial = 0, edge = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const a = alphaAt(img, x, y);
    if (a === 0) clear++; else if (a < 250) partial++;
    if (a > 8 && (x < 2 || y < 2 || x >= img.width - 2 || y >= img.height - 2)) edge++;
  }
  if (clear < img.width * img.height * .3) fail.push(`R1: only ${(clear / (img.width * img.height) * 100).toFixed(0)}% of the canvas is fully transparent; the background must be alpha 0`);
  if (edge) fail.push(`R2: ${edge} painted pixels touch the canvas edge`);
  // Stray translucent pixels far from the figure read as a halo or a paper wash.
  let stray = 0;
  for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
    const a = alphaAt(img, x, y); if (a === 0 || a > 200) continue;
    if (x < b.x0 - 8 || x > b.x1 + 8 || y < b.y0 - 8 || y > b.y1 + 8) stray++;
  }
  if (stray > 20) fail.push(`R1: ${stray * 4}± translucent pixels outside the figure (halo, fringe or paper)`);
  const ground = Math.abs(b.y1 - g.y1) / SIZE, height = b.h / g.h - 1, centre = ((b.x0 + b.x1) - (g.x0 + g.x1)) / 2 / SIZE;
  if (ground > .025) fail.push(`R2: paws ${b.y1 - g.y1 > 0 ? 'below' : 'above'} the ground line by ${Math.abs(b.y1 - g.y1)} px`);
  if (Math.abs(height) > .08) fail.push(`R2: height ${(height * 100).toFixed(0)}% off the guide`); else if (Math.abs(height) > .05) note.push(`R2: height ${(height * 100).toFixed(0)}% off the guide`);
  if (Math.abs(centre) > .05) note.push(`R2: horizontal centre ${(centre * 100).toFixed(1)}% off the guide`);
  // Silhouette agreement: fur grows past the guide, so overlap is reported rather than enforced.
  let both = 0, either = 0;
  for (let i = 3; i < img.data.length; i += 4) { const p = img.data[i] > 128, q = guide.data[i] > 128; if (p && q) both++; if (p || q) either++; }
  note.push(`silhouette IoU with guide ${(both / either).toFixed(2)}${partial ? `, ${partial} soft-edge pixels` : ''}`);
  return { fail, note, b };
}

/** Premultiplied box downscale of a region, keeping straight-alpha output. */
function resample(src, sx, sy, sw, sh, dw, dh) {
  const out = { width: dw, height: dh, data: new Uint8ClampedArray(dw * dh * 4) };
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx0 = sx + x * sw / dw, fx1 = sx + (x + 1) * sw / dw, fy0 = sy + y * sh / dh, fy1 = sy + (y + 1) * sh / dh;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(fy0); yy < Math.ceil(fy1); yy++) for (let xx = Math.floor(fx0); xx < Math.ceil(fx1); xx++) {
      if (xx < 0 || yy < 0 || xx >= src.width || yy >= src.height) { n++; continue; }
      const i = (yy * src.width + xx) * 4, al = src.data[i + 3] / 255;
      r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++;
    }
    const k = (y * dw + x) * 4; if (!a) continue;
    out.data[k] = r / a; out.data[k + 1] = g / a; out.data[k + 2] = b / a; out.data[k + 3] = a / n * 255;
  }
  return out;
}

const report = [], cells = [];
let blocked = false;
for (const view of P.HERO_ORBIT_VIEWS) {
  const guidePath = `${sources}/guides/hero-standing-low-${view.id}-guide-v1.png`, paintPath = `${sources}/hero-standing-low-${view.id}-sol-v1.png`;
  const guide = decode(guidePath);
  if (!placeholder && !fs.existsSync(paintPath)) { report.push(`${view.id}: missing ${paintPath}`); blocked = true; continue; }
  const img = placeholder ? guide : decode(paintPath), result = check(view, img, guide);
  report.push(`${view.id}: ${result.fail.length ? 'FAIL' : 'ok'}${[...result.fail, ...result.note].map(line => `\n  - ${line}`).join('')}`);
  if (result.fail.length) { blocked = true; continue; }
  const b = result.b, sx = b.x0 - PAD / SCALE, sy = b.y0 - PAD / SCALE, sw = b.w + 2 * PAD / SCALE, sh = b.h + 2 * PAD / SCALE;
  cells.push({ id: view.id, img: resample(img, sx, sy, sw, sh, Math.round(sw * SCALE), Math.round(sh * SCALE)) });
}
fs.mkdirSync('artifacts/hero-orbit', { recursive: true });
fs.writeFileSync('artifacts/hero-orbit/import-report.txt', `${placeholder ? 'PLACEHOLDER (guides)\n' : ''}${report.join('\n')}\n`);
console.log(report.join('\n'));
if (blocked) { console.log('\nNot packed: fix the views above (see docs/art/hero-orbit-v1.md).'); process.exit(1); }

// One column, in the rig's view order, like the approved low sheet.
const width = Math.max(...cells.map(c => c.img.width)) + GAP * 2;
const height = cells.reduce((sum, c) => sum + c.img.height + GAP, GAP);
const sheet = { width, height, data: new Uint8ClampedArray(width * height * 4) }, rects = {};
let y = GAP;
for (const c of cells) {
  const x = GAP;
  for (let row = 0; row < c.img.height; row++) sheet.data.set(c.img.data.subarray(row * c.img.width * 4, (row + 1) * c.img.width * 4), ((y + row) * width + x) * 4);
  rects[c.id] = [x, y, c.img.width, c.img.height];
  y += c.img.height + GAP;
}
fs.mkdirSync(runtime, { recursive: true });
encode(sheet, sheetPath);
fs.writeFileSync(atlasPath, `// Generated by tools/hero-orbit-import.mjs; do not edit. See docs/art/hero-orbit-v1.md.
/** Hero orbit v1 standing low-tier sheet: one tight rect per authored view, in pixels. */
export const HERO_ORBIT_ATLAS = {
  version: 'hero-orbit-v1',
  /** True while the sheet holds the proxy guides instead of Sol's paintings. */
  placeholder: ${placeholder},
  sheet: '${sheetPath.replace('public/assets/', '')}',
  rects: {
${Object.entries(rects).map(([id, r]) => `    '${id}': [${r.join(', ')}],`).join('\n')}
  },
} as const;
`);
console.log(`\nPacked ${cells.length} views into ${sheetPath} (${width}×${height}) and wrote ${atlasPath}.`);
