// Node-only (no browser) fixture: Khad Roots bark-plate painter output on plain
// card frames, with bake timings. Usage:
//   node --import ./tools/ts-resolve.mjs tools/khad-roots-paint-render.mjs out.png [ids] [density]
import fs from 'node:fs'; import zlib from 'node:zlib'; import { pathToFileURL } from 'node:url';
const src = fs.readFileSync(new URL('./bush-painter-render.mjs', import.meta.url), 'utf8');
const lib = src.slice(src.indexOf('function decode'), src.indexOf('const reference ='));
const m = new Function('fs', 'zlib', lib + 'return {decode, encode, canvas};')(fs, zlib);
const P = await import(new URL('../src/proto/khadRootPainter.ts', import.meta.url).href);
const ids = (process.argv[3] ?? 'rooted-card-0,rooted-card-1,rooted-card-2').split(','), density = Number(process.argv[4] ?? 3);
const F = P.KHAD_PAINT_FRAME, T = Math.round(F.size * density), out = m.canvas(T * ids.length, T); out.data.fill(20); for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const times = [];
ids.forEach((id, k) => { const ox = k * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const u = x / density + F.x, v = y / density + F.y; if (u >= 0 && u <= 100 && v >= 0 && v <= 140) { const i = (y * out.width + ox + x) * 4; const edge = Math.min(u, 100 - u, v, 140 - v) < 1.5; out.data.set(edge ? [170, 160, 135, 255] : [58, 72, 64, 255], i); } }
  const t = performance.now(), r = P.paintKhadRoots(id, false, density); times.push(performance.now() - t);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = (y * T + x) * 4, a = r.data[i + 3] / 255; if (!a) continue; const o = (y * out.width + ox + x) * 4; for (let c = 0; c < 3; c++) out.data[o + c] = r.data[i + c] * a + out.data[o + c] * (1 - a); } });
m.encode(out, process.argv[2]); console.log('ms per card at density', density, times.map(t => t.toFixed(0)).join(' '));
