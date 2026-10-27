// Node-only (no browser) fixture: rasterizes Khad Roots vine and thorn outlines
// for the frozen v1 and grown v2 geometry on plain card frames, side by side.
// Shapes only (wood fill, thorns, upper-surface glow); the in-game SVG pigment
// filter is not reproduced. Usage: node tools/khad-roots-render.mjs [outDir] [count]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const v1 = await import(pathToFileURL(`${repo}/src/proto/khadRootGeometryBaseline.ts`).href);
const v2 = await import(pathToFileURL(`${repo}/src/proto/khadRootGeometry.ts`).href);
const outDir = process.argv[2] ?? `${repo}/artifacts/khad-roots/v2`, count = Number(process.argv[3] ?? 6);
const S = 2.4, CW = Math.round(130 * S), CH = Math.round(175 * S), G = 14;
const W = (CW * 2 + G * 3) * 1, H = (CH + G) * count + G;
const img = new Uint8ClampedArray(W * H * 4).fill(22); for (let i = 3; i < img.length; i += 4) img[i] = 255;
const blend = (x, y, c, a) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - a) + c[k] * a; };
// Path to polygon(s): supports M, L, Q, Z (the geometry's own vocabulary).
const polys = d => { const t = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g), out = []; let cur = [], i = 0, p = [0, 0];
  while (i < t.length) { const c = t[i++];
    if (c === 'M') { if (cur.length) out.push(cur); p = [+t[i++], +t[i++]]; cur = [p]; }
    else if (c === 'L') { p = [+t[i++], +t[i++]]; cur.push(p); }
    else if (c === 'Q') { const q = [+t[i++], +t[i++]], e = [+t[i++], +t[i++]]; for (let s = 1; s <= 8; s++) { const u = s / 8, v = 1 - u; cur.push([v * v * p[0] + 2 * v * u * q[0] + u * u * e[0], v * v * p[1] + 2 * v * u * q[1] + u * u * e[1]]); } p = e; }
    else if (c === 'Z') { /* closed by fill */ } else { p = [+c, +t[i++]]; cur.push(p); } }
  if (cur.length) out.push(cur); return out; };
const fill = (poly, ox, oy, c, a, clip) => { const ys = poly.map(p => p[1]); const y0 = Math.floor(Math.min(...ys) * S), y1 = Math.ceil(Math.max(...ys) * S);
  for (let py = y0; py <= y1; py++) { const y = (py + .5) / S, xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi)); }
    xs.sort((m, n) => m - n); for (let k = 0; k + 1 < xs.length; k += 2) for (let px = Math.round(xs[k] * S); px < Math.round(xs[k + 1] * S); px++) { const x = (px + .5) / S, yy = y; if (clip(x, yy)) continue; blend(ox + px, oy + py, c, a); } } };
const stroke = (poly, ox, oy, c, a, w, clip) => { for (let i = 1; i < poly.length; i++) { const [x0, y0] = poly[i - 1], [x1, y1] = poly[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * S * 2); for (let s = 0; s <= n; s++) { const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n; if (clip(x, y)) continue; for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w) blend(ox + Math.round(x * S) + dx, oy + Math.round(y * S) + dy, c, a); } } };
const inRect = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
const drawCard = (geo, id, ox, oy) => {
  const cx = ox + Math.round(15 * S), cy = oy + Math.round(15 * S);
  for (let y = 0; y < 140 * S; y++) for (let x = 0; x < 100 * S; x++) { const u = x / S, v = y / S, edge = Math.min(u, 100 - u, v, 140 - v) < 1.2; blend(cx + x, cy + y, edge ? [150, 140, 120] : [58, 66, 60], 1); }
  for (const r of [v2.KHAD_REWARD_CLEARANCE, v2.KHAD_VALUE_CLEARANCE]) for (let y = 0; y < r.h * S; y++) for (let x = 0; x < r.w * S; x++) blend(cx + Math.round(r.x * S) + x, cy + Math.round(r.y * S) + y, [80, 92, 84], 1);
  const g = geo(id), clip = (x, y) => inRect(x, y, v2.KHAD_REWARD_CLEARANCE) || inRect(x, y, v2.KHAD_VALUE_CLEARANCE);
  for (const st of g.stems) { for (const p of polys(st.ribbon)) fill(p, cx, cy, [70, 20, 40], 1, clip); for (const t of st.thorns) for (const p of polys(t)) fill(p, cx, cy, [70, 20, 40], 1, clip);
    for (const m of st.moonEdges) for (const p of polys(m)) stroke(p, cx, cy, [255, 70, 90], .9, 1, clip); }
};
for (let k = 0; k < count; k++) { const id = `rooted-card-${k}`, y = G + k * (CH + G); drawCard(v1.khadRootGeometry, id, G, y); drawCard(v2.khadRootGeometry, id, G * 2 + CW, y); }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/v1-vs-v2.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${outDir}/v1-vs-v2.png`);
