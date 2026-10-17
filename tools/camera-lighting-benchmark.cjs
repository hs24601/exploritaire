// Camera-work frame benchmark for the lit immersive map (Day 01 opening).
// Orbits, zooms and pans the live camera with lighting on, reporting frame
// pacing, main-thread long tasks and the hottest JS functions (CPU profile).
// PROTO_URL overrides the page; BENCH_LABEL names the saved result.
const { chromium } = require('playwright');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const LABEL = process.env.BENCH_LABEL || 'run';
const HEADED = Boolean(process.env.BENCH_HEADED);

const startFrames = page => page.evaluate(() => {
  window.__bench = { gaps: [], long: 0, longMs: 0, stop: false };
  let previous;
  const tick = now => {
    if (previous !== undefined) window.__bench.gaps.push(now - previous);
    previous = now;
    if (!window.__bench.stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__bench.long++; window.__bench.longMs += entry.duration; }))
    .observe({ type: 'longtask', buffered: false });
});
const stopFrames = page => page.evaluate(() => {
  const bench = window.__bench; bench.stop = true;
  const gaps = bench.gaps.slice(1).sort((a, b) => a - b), total = gaps.reduce((sum, gap) => sum + gap, 0);
  const at = q => +gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))].toFixed(1);
  return { fps: +(gaps.length * 1000 / total).toFixed(1), median: at(.5), p95: at(.95), over33: gaps.filter(g => g > 33.4).length, frames: gaps.length, longTasks: bench.long, longTaskMs: Math.round(bench.longMs) };
});

const hotFunctions = profile => {
  const self = new Map(), byId = new Map(profile.nodes.map(node => [node.id, node]));
  const interval = (profile.endTime - profile.startTime) / Math.max(1, profile.samples.length) / 1000;
  for (const id of profile.samples) {
    const { callFrame: frame } = byId.get(id);
    const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()?.split('?')[0]}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + interval);
  }
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  // Attribute forced layout and style reads to their nearest app caller.
  const callers = new Map();
  for (const id of profile.samples) {
    const name = byId.get(id).callFrame.functionName;
    if (!['getBoundingClientRect', 'getComputedStyle', 'offsetWidth', 'clientWidth', 'getImageData', 'texImage2D', 'jsxDEV', 'exports.jsxDEV'].includes(name)) continue;
    let up = parent.get(id), frame;
    while (up !== undefined) { frame = byId.get(up).callFrame; if (frame.url.includes('/src/')) break; up = parent.get(up); }
    const key = `${name} <- ${frame ? `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()?.split('?')[0]}:${frame.lineNumber + 1}` : '?'}`;
    callers.set(key, (callers.get(key) ?? 0) + interval);
  }
  return [...[...self].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, ms]) => `${ms.toFixed(0).padStart(6)}ms  ${name}`),
    '  -- layout/readback callers --', ...[...callers].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, ms]) => `${ms.toFixed(0).padStart(6)}ms  ${name}`)];
};

// Main-thread rendering stages and raster/GPU work, in ms over the phase.
const renderingWork = events => {
  const threads = new Map(events.filter(e => e.name === 'thread_name').map(e => [`${e.pid}:${e.tid}`, e.args.name]));
  const stages = ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'RasterTask', 'GPUTask', 'FunctionCall', 'FireAnimationFrame', 'EventDispatch'];
  const totals = {};
  for (const e of events) {
    if (e.ph !== 'X' || !stages.includes(e.name)) continue;
    const thread = threads.get(`${e.pid}:${e.tid}`) ?? '?';
    const key = `${e.name}@${thread.replace(/\d+$/, '')}`;
    totals[key] = (totals[key] ?? 0) + e.dur / 1000;
  }
  return Object.fromEntries(Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)]));
};

(async () => {
  const browser = await chromium.launch({ headless: !HEADED, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const results = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1912, height: 914 }, deviceScaleFactor: 1 });
    await page.goto(URL);
    await page.waitForSelector('.proto-map', { timeout: 30000 });
    // Day 01 opening: Hero awake outside the den with dialogue and its shot.
    const scenario = process.env.BENCH_SCENARIO || 'day01';
    if (scenario !== 'none') {
      const toggle = page.locator('.proto-day-panel__toggle');
      await toggle.click(); await page.getByLabel('Day scenario').selectOption(scenario); await toggle.click();
    }
    await page.waitForTimeout(5000);
    results.gpu = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl'), info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    results.scene = await page.evaluate(() => ({
      props: document.querySelectorAll('[data-environment-prop]').length,
      actors: document.querySelectorAll('[data-board-piece="actor"]').length,
      canvases: document.querySelectorAll('.proto-map canvas').length,
      elements: document.querySelectorAll('.proto-map *').length,
    }));
    const box = await page.locator('.proto-map [data-physical-world]').first().evaluate(el => {
      const r = el.closest('.proto-map').getBoundingClientRect(); return { x: r.x + r.width * .55, y: r.y + r.height * .62 };
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

    const phase = async (name, act) => {
      await page.waitForTimeout(600);
      await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
      await startFrames(page); await cdp.send('Profiler.start');
      await act();
      const { profile } = await cdp.send('Profiler.stop');
      const frames = await stopFrames(page);
      results[name] = { ...frames, rendering: renderingWork(JSON.parse((await browser.stopTracing()).toString()).traceEvents), hot: hotFunctions(profile) };
      console.log(name, JSON.stringify({ ...results[name], hot: undefined }));
    };
    await phase('idle', () => page.waitForTimeout(2500));
    await phase('orbit', async () => {
      await page.mouse.move(box.x, box.y); await page.mouse.down({ button: 'middle' });
      for (let i = 0; i < 180; i++) { await page.mouse.move(box.x + Math.sin(i / 30) * 260, box.y); await page.waitForTimeout(8); }
      await page.mouse.up({ button: 'middle' });
    });
    await phase('zoom', async () => {
      await page.mouse.move(box.x, box.y);
      for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, i < 30 ? 40 : -40); await page.waitForTimeout(25); }
    });
    await phase('pan', async () => {
      await page.mouse.move(box.x, box.y); await page.mouse.down({ button: 'right' });
      for (let i = 0; i < 160; i++) { await page.mouse.move(box.x + Math.sin(i / 25) * 200, box.y + Math.cos(i / 25) * 60); await page.waitForTimeout(8); }
      await page.mouse.up({ button: 'right' });
    });
    fs.mkdirSync('artifacts/camera-lighting', { recursive: true });
    await page.screenshot({ path: `artifacts/camera-lighting/${LABEL}.png` });
    fs.writeFileSync(`artifacts/camera-lighting/${LABEL}.json`, JSON.stringify(results, null, 2));
    console.log('gpu', results.gpu, JSON.stringify(results.scene));
    for (const name of ['orbit', 'zoom', 'pan']) console.log(`\n${name} hot:\n${results[name].hot.slice(0, 12).concat(results[name].hot.slice(20)).join('\n')}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
