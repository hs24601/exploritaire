// Mobile performance review harness. Measurement only: it never edits game code.
//
// Loads proto.html scene checkpoints in a Pixel 7 emulation (DPR 2.625) on the real
// GPU, throttles the CPU, and for each feature ablation records:
//   - rAF frame pacing (fps, p50/p95 frame time, share of frames over 33 ms)
//   - CDP main-thread metrics (script, style, layout, task time per second)
//   - trace busy time per thread (renderer main, compositor, raster, GPU)
//   - React commits per second and rAF callbacks per frame (with their sources)
//   - a CPU profile aggregated by source file (baseline only)
//
// Usage: node tools/perf-mobile-review.cjs
//   PERF_URL      base URL (default http://127.0.0.1:5190/proto.html, a `vite preview` build)
//   PERF_SCENES   comma list of checkpoint ids (default: a representative set)
//   PERF_MODES    comma list of ablation names (default: all)
//   PERF_CPU      CPU throttle rate (default 4, roughly a mid-range phone)
//   PERF_MS       measurement window per mode (default 4000)
//   PERF_OUT      output JSON path (default artifacts/perf-mobile/results.json)
const { chromium, devices } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const URL = process.env.PERF_URL || 'http://127.0.0.1:5190/proto.html';
const SCENES = (process.env.PERF_SCENES || 'day01.opening,day01.sparse-patch,day01.home,day02.woods').split(',');
const CPU = Number(process.env.PERF_CPU || 4);
const WINDOW = Number(process.env.PERF_MS || 4000);
const OUT = process.env.PERF_OUT || 'artifacts/perf-mobile/results.json';
const EXE = process.env.PERF_CHROME || 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';

// Each mode: query additions, localStorage, CSS to inject after load, and an optional page action.
const hide = sel => `${sel}{display:none!important}`;
const MODES = {
  baseline: {},
  fxLow: { query: { fx: 'low' } },
  lightsOff: { lights: 'off' },
  lightsOffFxLow: { lights: 'off', query: { fx: 'low' } },
  dpr1: { dpr: 1 },
  noCpuThrottle: { cpu: 1 },
  filtersOff: { css: '*{filter:none!important;backdrop-filter:none!important}' },
  blendOff: { css: '*{mix-blend-mode:normal!important}' },
  masksOff: { css: '*{mask-image:none!important;-webkit-mask-image:none!important}' },
  animsPaused: { action: 'pauseAnimations' },
  canvasHidden: { css: hide('.proto-map canvas') },
  volumetricsOff: { css: hide('.proto-volumetrics') },
  airOff: { css: hide('.proto-table-air') + hide('.proto-dust') + hide('.proto-shafts') },
  tableLightOff: { css: hide('.proto-table-light') },
  groundLightOff: { css: hide('.proto-ground-light') },
  atmosphereOff: { css: hide('.proto-atmosphere') },
  biomeEdgesOff: { css: hide('[data-biome-edge]') },
  vignetteOff: { css: hide('[data-peripheral-darkness]') + hide('.day-cinema-grade') },
  standeeLightOff: { css: hide('.proto-light-wash') + '.proto-sprite-standee__art{filter:none!important}' },
  shadowsOff: { css: hide('.proto-sprite-shadow') + hide('[data-volume-shadow]') },
  actorStrokeOff: { css: '.proto-map [data-board-piece="actor"]{filter:none!important}' },
  flat3dOff: { css: '.proto-map *{transform-style:flat!important}' },
  // Finer splits of the large levers above.
  shadowBlurOff: { css: '.proto-sprite-shadow{filter:none!important}' },
  shadowMaskOff: { css: '.proto-sprite-shadow{mask-image:none!important;-webkit-mask-image:none!important}' },
  discoveryFilterOff: { css: '[style*="tile-discovery"]{filter:none!important}' },
  mistOff: { css: hide('.proto-mist') },
  firefliesOff: { css: hide('.proto-firefly') },
  manaberryAnimOff: { css: '.manaberry-blob::before,.manaberry-blob::after{animation:none!important}' },
};
const MODE_NAMES = (process.env.PERF_MODES || Object.keys(MODES).join(',')).split(',');

const INIT = () => {
  const stats = window.__perf = { raf: 0, frames: 0, sources: {}, commits: 0, long: [] };
  const raf = window.requestAnimationFrame.bind(window);
  let sample = 0;
  window.requestAnimationFrame = cb => {
    stats.raf++;
    if (++sample % 7 === 0) {
      const line = (new Error().stack || '').split('\n').slice(2).find(l => !l.includes('requestAnimationFrame')) || '?';
      const m = line.match(/\/(?:src|assets)\/([^?:)]+)(?:\?[^:]*)?:(\d+)/) || line.match(/at (\S+)/);
      const key = m ? (m[2] ? `${m[1]}:${m[2]}` : m[1]) : '?';
      stats.sources[key] = (stats.sources[key] || 0) + 7;
    }
    return raf(cb);
  };
  const tick = () => { stats.frames++; raf(tick); };
  raf(tick);
  // A minimal React devtools hook so react-dom reports every commit.
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject() { return 1; },
    onCommitFiberRoot() { stats.commits++; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {} };
  try { new PerformanceObserver(list => list.getEntries().forEach(e => stats.long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch {}
};

const frameStats = page => page.evaluate(ms => new Promise(resolve => {
  const gaps = []; let prev, start;
  const p = window.__perf, raf0 = p.raf, frames0 = p.frames, commits0 = p.commits, long0 = p.long.length;
  const tick = now => {
    start ??= now;
    if (prev !== undefined) gaps.push(now - prev);
    prev = now;
    if (now - start < ms) requestAnimationFrame(tick);
    else {
      const sec = (now - start) / 1000, s = [...gaps].sort((a, b) => a - b), frames = p.frames - frames0;
      resolve({ fps: +(gaps.length / sec).toFixed(1), p50: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1),
        janky: +(gaps.filter(g => g > 33.4).length / gaps.length * 100).toFixed(0),
        // Subtract the harness's own two callbacks per frame.
        rafPerFrame: +((p.raf - raf0) / Math.max(1, frames) - 2).toFixed(1),
        commitsPerSec: +((p.commits - commits0) / sec).toFixed(1),
        longTasks: p.long.length - long0, longTaskMs: Math.round(p.long.slice(long0).reduce((a, b) => a + b, 0)) });
    }
  };
  requestAnimationFrame(tick);
}), WINDOW);

const metricMap = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

// Busy time per thread from a trace, in ms per second of trace. Nested task events
// are merged so a thread never counts more than wall time. The renderer main thread
// is also split by rendering phase, and Paint events are counted (repaint churn).
const PHASES = ['FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'UpdateLayer', 'Commit', 'MinorGC', 'MajorGC', 'V8.GC_SCAVENGER', 'HitTest', 'IntersectionObserverController::computeIntersections'];
const summarizeTrace = file => {
  const { traceEvents } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = {}; const spans = {}; const phase = {}; let paints = 0, t0 = Infinity, t1 = 0;
  for (const e of traceEvents) if (e.ph === 'M' && e.name === 'thread_name') names[`${e.pid}:${e.tid}`] = e.args.name;
  const top = new Set(['ThreadControllerImpl::RunTask', 'RunTask', 'ThreadPool_RunTask']);
  const threadOf = e => (names[`${e.pid}:${e.tid}`] || '?').replace(/\d+$/, '');
  for (const e of traceEvents) {
    if (e.ph !== 'X' || !e.dur) continue;
    const n = threadOf(e);
    if (top.has(e.name)) { (spans[n] ||= []).push([e.ts, e.ts + e.dur]); t0 = Math.min(t0, e.ts); t1 = Math.max(t1, e.ts + e.dur); }
    if (n === 'CrRendererMain' && PHASES.includes(e.name)) (phase[e.name] ||= []).push([e.ts, e.ts + e.dur]);
    if (n === 'CrRendererMain' && e.name === 'Paint') paints++;
  }
  const merged = list => { list.sort((a, b) => a[0] - b[0]); let sum = 0, end = -Infinity; for (const [a, b] of list) { if (b <= end) continue; sum += b - Math.max(a, end); end = b; } return sum / 1000; };
  const sec = Math.max(0.001, (t1 - t0) / 1e6), threads = {}, main = {};
  for (const [k, v] of Object.entries(spans)) { const ms = merged(v) / sec; if (ms > 5 && !/VSync|StackSampling/.test(k)) threads[k] = Math.round(ms); }
  for (const [k, v] of Object.entries(phase)) { const ms = merged(v) / sec; if (ms > 2) main[k] = Math.round(ms); }
  return { threads, main, paintsPerSec: Math.round(paints / sec) };
};

// CPU profile self time by source file.
const summarizeProfile = profile => {
  const byFile = {}; const total = profile.samples.length;
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const counts = {}; for (const s of profile.samples) counts[s] = (counts[s] || 0) + 1;
  for (const [id, c] of Object.entries(counts)) {
    const f = nodes.get(Number(id)).callFrame;
    const file = f.url ? f.url.replace(/^.*\/(src|assets|node_modules)\//, '$1/').replace(/\?.*$/, '') : `(${f.functionName || 'native'})`;
    const key = `${file} ${f.functionName || ''}`.trim();
    byFile[key] = (byFile[key] || 0) + c;
  }
  return Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / total * 100).toFixed(1)]);
};

async function runMode(browser, scene, name, withProfile) {
  const mode = MODES[name];
  const ctx = await browser.newContext({ ...devices['Pixel 7'], ...(mode.dpr ? { deviceScaleFactor: mode.dpr } : {}) });
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(lights => { try { localStorage.setItem('exploritaire-global-lights', lights); } catch {} }, mode.lights || 'on');
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const q = new URLSearchParams({ scene, ...(mode.query || {}) });
  await page.goto(`${URL}?${q}`, { waitUntil: 'load' });
  await page.waitForTimeout(7000); // cinematics, art preload and camera settle
  if (mode.css) await page.addStyleTag({ content: mode.css });
  if (mode.action === 'pauseAnimations') await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: mode.cpu ?? CPU });
  await page.waitForTimeout(800);
  const inventory = name === 'baseline' ? await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')], cs = all.map(e => getComputedStyle(e));
    return { nodes: all.length, filters: cs.filter(s => s.filter !== 'none').length, blend: cs.filter(s => s.mixBlendMode !== 'normal').length,
      masks: cs.filter(s => s.maskImage && s.maskImage !== 'none').length, preserve3d: cs.filter(s => s.transformStyle === 'preserve-3d').length,
      animations: document.getAnimations().length, canvases: [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height}.${c.className.split(' ')[0] || c.parentElement?.className.split(' ')[0] || ''}`) };
  }) : undefined;
  const m0 = await metricMap(cdp);
  const traceFile = path.join(path.dirname(OUT), `trace-${scene}-${name}.json`);
  await browser.startTracing(page, { path: traceFile, categories: ['toplevel', 'disabled-by-default-devtools.timeline', 'devtools.timeline', 'gpu', 'viz', 'cc'] });
  if (withProfile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const frames = await frameStats(page);
  const profile = withProfile ? (await cdp.send('Profiler.stop')).profile : null;
  await browser.stopTracing();
  const m1 = await metricMap(cdp);
  const sec = WINDOW / 1000, per = k => Math.round((m1[k] - m0[k]) * 1000 / sec);
  const result = { scene, mode: name, ...frames,
    mainMsPerSec: { task: per('TaskDuration'), script: per('ScriptDuration'), style: per('RecalcStyleDuration'), layout: per('LayoutDuration') },
    styleRecalcsPerSec: Math.round((m1.RecalcStyleCount - m0.RecalcStyleCount) / sec), layoutsPerSec: Math.round((m1.LayoutCount - m0.LayoutCount) / sec),
    ...summarizeTrace(traceFile), inventory,
    rafSources: name === 'baseline' ? await page.evaluate(() => Object.entries(window.__perf.sources).sort((a, b) => b[1] - a[1]).slice(0, 15)) : undefined,
    profile: profile ? summarizeProfile(profile) : undefined };
  if (name === 'baseline') await page.screenshot({ path: path.join(path.dirname(OUT), `${scene}.png`) });
  fs.rmSync(traceFile, { force: true });
  await ctx.close();
  return result;
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const results = [];
  // Rounds are interleaved so drift (thermal, background load) spreads across modes.
  const REPEATS = Number(process.env.PERF_REPEATS || 3);
  try {
    for (let round = 0; round < REPEATS; round++) for (const scene of SCENES) for (const name of MODE_NAMES) {
      const r = { round, ...await runMode(browser, scene, name, round === 0 && name === 'baseline') };
      results.push(r);
      console.log(JSON.stringify({ round, scene, mode: name, fps: r.fps, p95: r.p95, janky: r.janky, threads: r.threads, phases: r.main, paints: r.paintsPerSec }));
      fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    }
  } finally { await browser.close(); }
  // Medians per scene and mode, plus per-frame cost on the renderer main and GPU threads.
  const med = xs => { const s = xs.filter(x => x !== undefined).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : undefined; };
  const summary = [];
  for (const scene of SCENES) for (const mode of MODE_NAMES) {
    const rs = results.filter(r => r.scene === scene && r.mode === mode);
    const fps = med(rs.map(r => r.fps));
    const row = { scene, mode, fps, p95: med(rs.map(r => r.p95)), janky: med(rs.map(r => r.janky)),
      mainMsPerSec: med(rs.map(r => r.threads.CrRendererMain)), gpuMsPerSec: med(rs.map(r => r.threads.CrGpuMain)),
      vizMsPerSec: med(rs.map(r => r.threads.VizCompositorThread)), compositorMsPerSec: med(rs.map(r => r.threads.Compositor)),
      mainMsPerFrame: med(rs.map(r => r.threads.CrRendererMain / r.fps)), gpuMsPerFrame: med(rs.map(r => (r.threads.CrGpuMain || 0) / r.fps)),
      paintsPerSec: med(rs.map(r => r.paintsPerSec)), commitsPerSec: med(rs.map(r => r.commitsPerSec)), rafPerFrame: med(rs.map(r => r.rafPerFrame)) };
    for (const k of Object.keys(row)) if (typeof row[k] === 'number') row[k] = +row[k].toFixed(1);
    summary.push(row);
  }
  fs.writeFileSync(OUT.replace(/\.json$/, '.summary.json'), JSON.stringify(summary, null, 2));
  console.table(summary.map(({ scene, mode, fps, janky, mainMsPerFrame, gpuMsPerFrame, gpuMsPerSec, paintsPerSec }) => ({ scene, mode, fps, janky, mainMsPerFrame, gpuMsPerFrame, gpuMsPerSec, paintsPerSec })));
})().catch(e => { console.error(e); process.exitCode = 1; });
