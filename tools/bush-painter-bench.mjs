// Node-only (no browser) runtime study for bush-study-v3: renders five
// procedural bushes to a contact sheet and measures what a game scene would pay.
// Usage: node tools/bush-painter-bench.mjs [outDir]
// Node runs the same V8 engine as Chrome, but this is a desktop CPU and not a
// phone or a frame-time trace; read the numbers as relative cost.
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const painterUrl = pathToFileURL(`${repo}/src/proto/bushPainter.ts`).href;

if (!isMainThread) {
  // Persistent worker, as a game would keep one: bakes each job it is sent
  // and returns the pixels' size so the transfer is part of the measurement.
  const { paintBush } = await import(painterUrl);
  parentPort.on('message', jobs => parentPort.postMessage(jobs.map(({ preset, size }) => paintBush(preset, size).data.byteLength)));
  parentPort.postMessage('ready');
} else {
  const outDir = process.argv[2] ?? `${repo}/artifacts/procedural-bush/v3`;
  const t0 = performance.now();
  const { paintBush } = await import(painterUrl);
  const importMs = performance.now() - t0;

  const presets = [
    { seed: 81723, fullness: .7, spread: 1, brush: .65, warmth: .6, fruit: 1 },
    { seed: 20511, fullness: .35, spread: .55, brush: .8, warmth: .4, fruit: 0 },
    { seed: 47390, fullness: 1, spread: .9, brush: .5, warmth: .85, fruit: 2 },
    { seed: 63158, fullness: .55, spread: .3, brush: .7, warmth: .2, fruit: 1 },
    { seed: 90877, fullness: .85, spread: .75, brush: .9, warmth: .7, fruit: 1 },
  ];

  // Cold first bake: the first bush a player would see, before JIT warm-up.
  let t = performance.now(); paintBush(presets[0], 256); const coldMs = performance.now() - t;

  const stats = values => { const s = [...values].sort((a, b) => a - b); return { median: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1] }; };
  const sizes = [128, 256, 512];
  const perSize = {};
  for (const size of sizes) {
    const times = [];
    // Warm, uncached: every bake uses a fresh seed so nothing is reused.
    for (let i = 0; i < 15; i++) { const p = { ...presets[i % 5], seed: 100000 + size * 31 + i }; t = performance.now(); paintBush(p, size); times.push(performance.now() - t); }
    perSize[size] = stats(times);
  }
  // Cached lookup, as the lab wrapper and any game cache would serve repeats.
  const cache = new Map(); const key = p => JSON.stringify(p);
  cache.set(key(presets[0]), paintBush(presets[0], 256));
  t = performance.now(); for (let i = 0; i < 10000; i++) cache.get(key(presets[i % 1 ? 1 : 0])); const lookupUs = (performance.now() - t) / 10000 * 1000;

  // Contact sheet: five bushes on one shared ground, enlarged and at 128px.
  const bakes = presets.map(p => paintBush(p, 512));
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const encode = (img, file) => {
    const chunk = (tp, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(tp), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4); ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
    for (let y = 0; y < img.height; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  };
  const T = 384, G = 12, sheet = { width: T * 5 + G * 6, height: T + 128 + G * 3, data: null };
  sheet.data = new Uint8ClampedArray(sheet.width * sheet.height * 4).fill(24); for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;
  const scene = (x0, y0, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = y / s, i = ((y0 + y) * sheet.width + x0 + x) * 4, g = v > .7, tt = g ? (v - .7) / .3 : v / .7;
    const c = g ? [92 - tt * 30, 70 - tt * 22, 48 - tt * 14] : [74 - tt * 30, 94 - tt * 34, 98 - tt * 38], sh = Math.exp(-(((x / s - .5) / .2) ** 2 + ((v - .87) / .025) ** 2)) * .45;
    sheet.data.set([c[0] * (1 - sh), c[1] * (1 - sh), c[2] * (1 - sh), 255], i); } };
  const draw = (img, x0, y0, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const step = img.width / s; let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < step; j++) for (let k = 0; k < step; k++) { const i = (Math.floor(y * step + j) * img.width + Math.floor(x * step + k)) * 4, al = img.data[i + 3] / 255; r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++; }
    if (!a) continue; const al = a / n, o = ((y0 + y) * sheet.width + x0 + x) * 4;
    for (const [c, v] of [[0, r], [1, g], [2, b]]) sheet.data[o + c] = v / a * al + sheet.data[o + c] * (1 - al); } };
  bakes.forEach((img, i) => { const x = G + i * (T + G); scene(x, G, T); draw(img, x, G, T); scene(x + (T - 128) / 2, T + G * 2, 128); draw(img, x + (T - 128) / 2, T + G * 2, 128); });
  fs.mkdirSync(outDir, { recursive: true }); encode(sheet, `${outDir}/five-bushes.png`);

  // Scene costs: serial on one thread vs. a warm pool of background workers.
  const poolSize = Math.max(1, Math.min(4, os.availableParallelism() - 1));
  const pool = await Promise.all(Array.from({ length: poolSize }, () => new Promise((done, fail) => {
    const w = new Worker(new URL(import.meta.url)); w.once('message', () => done(w)); w.on('error', fail);
  })));
  const run = (w, jobs) => new Promise(done => { w.once('message', done); w.postMessage(jobs); });
  // Warm every worker's JIT with one bake at each size, as a preload would.
  await Promise.all(pool.map((w, i) => run(w, sizes.map(size => ({ preset: { ...presets[i % 5], seed: 900000 + i + size }, size })))));
  const scenario = async (count, size) => {
    const serials = [], parallels = [];
    for (let rep = 0; rep < 5; rep++) {
      const jobs = Array.from({ length: count }, (_, i) => ({ preset: { ...presets[i % 5], seed: 300000 + rep * 1000 + count * 97 + size + i }, size }));
      let s = performance.now(); jobs.forEach(j => paintBush(j.preset, j.size)); serials.push(performance.now() - s);
      const parts = pool.map((_, w) => jobs.filter((_, i) => i % pool.length === w)).filter(p => p.length);
      s = performance.now(); await Promise.all(parts.map((part, w) => run(pool[w], part.map(j => ({ ...j, preset: { ...j.preset, seed: j.preset.seed + 500 } }))))); parallels.push(performance.now() - s);
    }
    return { count, size, serialMs: stats(serials).median, workerWallMs: stats(parallels).median, workers: Math.min(count, pool.length) };
  };
  const scenes = [];
  for (const [count, size] of [[1, 512], [3, 256], [5, 256], [5, 512], [12, 256]]) scenes.push(await scenario(count, size));
  pool.forEach(w => w.terminate());

  const imageGen = { file: fs.statSync(`${repo}/public/assets/runtime/environment/watercolor/v1/manaberry-sparse-standee-v1.png`).size, w: 1375, h: 1144 };
  const mb = b => (b / 1048576).toFixed(2);
  const report = {
    machine: `${os.cpus()[0].model.trim()} · ${os.availableParallelism()} threads · Node ${process.version}`,
    importMs, coldMs, perSize, lookupUs, scenes,
    memory: Object.fromEntries(sizes.map(s => [s, { cpuMB: mb(s * s * 4), gpuMB: mb(s * s * 4 * 4 / 3) }])),
    imageGen: { downloadMB: mb(imageGen.file), decodedMB: mb(imageGen.w * imageGen.h * 4), gpuMB: mb(imageGen.w * imageGen.h * 4 * 4 / 3) },
  };
  fs.writeFileSync(`${outDir}/runtime-bench.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
