// Node-only fixture (no browser): renders bush-study-v3 beside the approved
// reference, plus an eight-seed grid. Usage: node tools/bush-painter-render.mjs [outDir]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const { paintBush } = await import(pathToFileURL(`${repo}/src/proto/bushPainter.ts`).href + '?t=' + Date.now());
const outDir = process.argv[2] ?? '.';

function decode(file) {
  const b = fs.readFileSync(file); let o = 8, w, h, idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12]) throw new Error('RGBA8 only'); }
    if (type === 'IDAT') idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = new Uint8ClampedArray(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) { const a = x >= 4 ? out[y * stride + x - 4] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = y && x >= 4 ? out[(y - 1) * stride + x - 4] : 0;
      let v = raw[row + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255; } }
  return { width: w, height: h, data: out };
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function encode(img, file) {
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function canvas(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
function scene(dst, x0, y0, s) { // shared slate sky + earth, like the lab's landscape
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = y / s, i = ((y0 + y) * dst.width + x0 + x) * 4;
    const ground = v > .7, t = ground ? (v - .7) / .3 : v / .7;
    const c = ground ? [92 - t * 30, 70 - t * 22, 48 - t * 14] : [74 - t * 30, 94 - t * 34, 98 - t * 38];
    const shadow = Math.exp(-(((x / s - .5) / .2) ** 2 + ((v - .87) / .025) ** 2)) * .45;
    dst.data.set([c[0] * (1 - shadow), c[1] * (1 - shadow), c[2] * (1 - shadow), 255], i); }
}
// Box/bilinear sample `src` region into dst rect with straight-alpha over.
function blit(dst, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx0 = sx + x / dw * sw, fy0 = sy + y / dh * sh, step = Math.max(1, sw / dw); let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < step; j++) for (let k = 0; k < step; k++) { const px = Math.min(src.width - 1, Math.floor(fx0 + k)), py = Math.min(src.height - 1, Math.floor(fy0 + j)), i = (py * src.width + px) * 4, al = src.data[i + 3] / 255;
      r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++; }
    if (!a) continue; const al = a / n, i = ((dy + y) * dst.width + dx + x) * 4;
    dst.data[i] = r / a * al + dst.data[i] * (1 - al); dst.data[i + 1] = g / a * al + dst.data[i + 1] * (1 - al); dst.data[i + 2] = b / a * al + dst.data[i + 2] * (1 - al); }
}
function bounds(img) { let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 }; }
// Place a cutout so its base sits on the shared ground line at a common width.
function place(dst, img, x0, y0, s) { const b = bounds(img), bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, scale = s * .78 / bw, dw = Math.round(bw * scale), dh = Math.round(bh * scale);
  blit(dst, img, b.x0, b.y0, bw, bh, x0 + Math.round((s - dw) / 2), y0 + Math.round(s * .885) - dh, dw, dh); }

const reference = decode(`${repo}/public/assets/runtime/environment/watercolor/v1/manaberry-sparse-standee-v1.png`);
const base = { seed: 81723, fullness: .7, spread: 1, brush: .65, warmth: .6, fruit: 1 };
const t0 = performance.now(), bush = paintBush(base, 512), ms = performance.now() - t0;
encode(bush, `${outDir}/v3-default.png`);
const S = 512, G = 16, cmp = canvas(S * 2 + G * 3, S + 128 + G * 3);
cmp.data.fill(24); for (let i = 3; i < cmp.data.length; i += 4) cmp.data[i] = 255;
[reference, bush].forEach((img, k) => { const x = G + k * (S + G); scene(cmp, x, G, S); place(cmp, img, x, G, S);
  scene(cmp, x + (S - 128) / 2, S + G * 2, 128); place(cmp, img, x + (S - 128) / 2, S + G * 2, 128); });
encode(cmp, `${outDir}/compare.png`);
const seeds = [81723, 99100, 99101, 99102, 99103, 99104, 4242, 777], T = 256, grid = canvas(T * 4, T * 2);
seeds.forEach((seed, k) => { const x = (k % 4) * T, y = Math.floor(k / 4) * T; scene(grid, x, y, T);
  place(grid, paintBush({ ...base, seed, fullness: (k * .37) % 1, spread: .4 + (k * .29) % .6, fruit: k % 3 ? 1 : 2 }, 384), x, y, T); });
encode(grid, `${outDir}/seeds.png`);
console.log(`v3 512px bake: ${ms.toFixed(0)} ms`);
