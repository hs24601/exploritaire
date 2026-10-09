const { chromium } = require('playwright');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const measure = p => p.evaluate(() => new Promise(resolve => {
  const gaps = []; let previous, start;
  const tick = now => {
    start ??= now;
    if (previous !== undefined) gaps.push(now - previous);
    previous = now;
    if (now - start < 3000) requestAnimationFrame(tick);
    else { gaps.sort((a,b) => a-b); resolve({ fps: +(gaps.length * 1000 / (now-start)).toFixed(1), median: gaps[Math.floor(gaps.length/2)], p95: gaps[Math.floor(gaps.length*.95)] }); }
  };
  requestAnimationFrame(tick);
}));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  const results = [];
  try {
    for (const width of [1912,1280]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1912 ? 914 : 720 } });
      await page.goto(URL + '?fx=high');
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(2000);
      const selectors = process.env.PERF_FINAL ? { baseline: '' } : process.env.PERF_SURFACE ? {
        baseline: '',
        airCompact: '',
        moteOff: '[data-atmosphere="mote"]',
        airCompactMoteOff: '[data-atmosphere="mote"]',
      } : process.env.PERF_PARTICLES ? {
        baseline: '',
        dustOff: '[data-atmosphere="mote"]',
        mistOff: '[data-atmosphere="mist"]',
        haloOff: '[data-atmosphere="halo"]',
        airLayerOff: '.proto-table-air',
        dustNoGlow: '',
      } : process.env.PERF_BROAD ? {
        baseline: '',
        allGrassOff: '[data-biome-edge^="table:"], [data-grassland-cell]',
        airOff: '.proto-atmosphere, .proto-shafts, .proto-volumetrics',
        floorOff: '.proto-table-floor',
        lightOff: '.proto-table-light',
        allFiltersOff: '',
      } : {
        baseline: '',
        grassWashOff: '[data-biome-edge^="table:"] .proto-light-wash',
        grassSimple: '[data-biome-edge^="table:"] .proto-light-wash',
        grassOff: '[data-biome-edge^="table:"]',
        volumeOff: '.proto-volumetrics',
      };
      for (const [mode, selector] of Object.entries(selectors)) {
        const style = await page.addStyleTag({content: (selector ? `${selector} { display:none!important }` : '/* baseline */') + (mode === 'grassSimple' ? '[data-biome-edge^="table:"] .proto-biome-edge__art {filter:none!important}' : '') + (mode === 'allFiltersOff' ? '.proto-map * {filter:none!important;backdrop-filter:none!important;mix-blend-mode:normal!important}' : '') + (mode === 'dustNoGlow' ? '.proto-mote {box-shadow:none!important}' : '') + (mode.startsWith('airCompact') ? '.proto-table-air {inset:0!important}' : '')});
        await page.waitForTimeout(500);
        results.push({width,mode,...await measure(page)});
        await style.evaluate(el => el.remove());
      }
      console.log(JSON.stringify(results.filter(r=>r.width===width)));
      if (process.env.PERF_FINAL) {
        await page.screenshot({path:`artifacts/immersive-perf/${width}-after.png`});
        await page.goto(URL+'?fx=low');await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(2000);
        const low={width,mode:'low',...await measure(page)};results.push(low);console.log(JSON.stringify(low));
      }
      await page.close();
    }
    fs.mkdirSync('artifacts/immersive-perf', {recursive:true});
    fs.writeFileSync(`artifacts/immersive-perf/${process.env.PERF_FINAL ? 'after' : process.env.PERF_SURFACE ? 'surface' : process.env.PERF_PARTICLES ? 'particles' : process.env.PERF_BROAD ? 'broad' : 'ablation'}.json`,JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
