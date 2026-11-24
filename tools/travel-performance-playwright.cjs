const { chromium } = require('playwright');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const stage = process.env.PERF_STAGE || 'before';
const widths = (process.env.PERF_WIDTHS || '1280,1912').split(',').map(Number);
const profiling=process.env.PERF_PROFILE!=='0';
async function sample(page, cdp, label, ms, startTravel = false) {
  const before = (await cdp.send('Performance.getMetrics')).metrics;
  if(profiling)await cdp.send('Profiler.start');
  const frames = await page.evaluate(({ ms, startTravel }) => new Promise(resolve => {
    const gaps = [], chunks = {}; let last = performance.now(), start = last;
    if (startTravel) {
      const viewport = document.querySelector('.proto-map-viewport');
      const anchor = document.createElement('i'); anchor.style.cssText = 'position:absolute;left:50%;top:calc(50% - 96px);width:0;height:0;pointer-events:none';
      viewport.querySelector('[data-physical-world]').append(anchor);
      const r = anchor.getBoundingClientRect(); anchor.remove();
      window.dispatchEvent(new CustomEvent('proto-actor-pointer-drop', { detail: { actorId: 'hero', x: r.x, y: r.y } }));
    }
    function tick(now) {
      const gap = now - last; gaps.push(gap); (chunks[Math.floor((now - start) / 1000)] ??= []).push(gap); last = now;
      if (now - start < ms) requestAnimationFrame(tick);
      else {
        const stats = a => { a.sort((a,b) => a-b); return { frames: a.length, mean: a.reduce((a,b) => a+b,0)/a.length, p95: a[Math.floor(a.length*.95)], worst: a.at(-1), over50: a.filter(n => n > 50).length }; };
        resolve({ fps: gaps.length * 1000 / (now-start), ...stats(gaps), seconds: Object.fromEntries(Object.entries(chunks).map(([k,v]) => [k,stats(v)])), position: document.querySelector('[data-board-piece="actor"]').dataset.gridReference, view: document.querySelector('.proto-map').dataset.cameraView });
      }
    } requestAnimationFrame(tick);
  }), { ms, startTravel });
  const { profile } = profiling ? await cdp.send('Profiler.stop') : {profile:{nodes:[],samples:[],timeDeltas:[]}};
  const after = (await cdp.send('Performance.getMetrics')).metrics;
  const weights = new Map(), inclusive = new Map(), parents = new Map();
  profile.nodes.forEach(n => (n.children || []).forEach(id => parents.set(id,n.id)));
  profile.samples.forEach((id,i) => { const dt = profile.timeDeltas[i] || 0; weights.set(id,(weights.get(id)||0)+dt); let parent=id; while(parent){inclusive.set(parent,(inclusive.get(parent)||0)+dt);parent=parents.get(parent);} });
  const nodes = profile.nodes.map(n => ({ name: n.callFrame.functionName, url: n.callFrame.url, line: n.callFrame.lineNumber+1, self: Math.round((weights.get(n.id)||0)/1000), total: Math.round((inclusive.get(n.id)||0)/1000) }));
  const hot = nodes.filter(n=>n.self>5 || n.total>30).sort((a,b)=>b.total-a.total).slice(0,45);
  const hotSource = nodes.filter(n=>n.url.includes('/src/')).sort((a,b)=>b.total-a.total).slice(0,30);
  const hotSelf = nodes.sort((a,b)=>b.self-a.self).slice(0,30);
  const metrics = Object.fromEntries(after.filter(m=>/Duration|Count/.test(m.name)).map(m=>[m.name,+(m.value-(before.find(n=>n.name===m.name)?.value||0)).toFixed(3)]));
  return { label, profiling, ...frames, metrics, hot, hotSource, hotSelf };
}
(async () => {
  const hardware = process.env.PERF_GPU === '1';
  const browser = await chromium.launch({ headless: true, ...(hardware ? { channel:'chromium', args:['--enable-gpu'] } : {}) }); const results=[];
  const browserCdp = await browser.newBrowserCDPSession();
  const { gpu } = await browserCdp.send('SystemInfo.getInfo');
  fs.mkdirSync('artifacts/travel-performance',{recursive:true});
  fs.writeFileSync(`artifacts/travel-performance/${stage}-environment.json`,JSON.stringify({url:URL,browser:browser.version(),hardwareRequested:hardware,profiling,gpu},null,2));
  try { for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 } });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(URL); await page.getByRole('slider', { name: 'Travel speed' }).waitFor(); await page.waitForTimeout(1600);
    if(process.env.PERF_HIDE)await page.addStyleTag({content:`${process.env.PERF_HIDE}{display:none!important}`});
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable'); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    results.push({ width, ...await sample(page, cdp, 'OTT idle', 2000) });
    await page.getByRole('slider', { name: 'Travel speed' }).fill('30');
    results.push({ width, ...await sample(page, cdp, 'travel transition and follow', 12000, true) });
    if(results.at(-1).position==='table:0,2') throw new Error('Benchmark did not start travel');
    await page.locator('[data-route-line]').waitFor({ state:'detached', timeout:15000 }); await page.waitForTimeout(1000);
    results.push({ width, ...await sample(page, cdp, 'immersive idle', 2000), errors });
    if(stage==='after') await page.screenshot({path:`artifacts/travel-performance/${width}-after.png`});
    await page.close(); console.log(JSON.stringify(results.filter(r=>r.width===width).map(({hot,hotSource,hotSelf,seconds,...rest})=>rest)));
  }} finally { await browser.close(); }
  fs.mkdirSync('artifacts/travel-performance',{recursive:true}); fs.writeFileSync(`artifacts/travel-performance/${stage}.json`,JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
