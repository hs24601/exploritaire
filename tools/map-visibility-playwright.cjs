const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const url = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
(async () => {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('artifacts/map-visibility', { recursive: true });
  try {
    for (const width of [1280, 1912]) for (const art of ['paint', 'pixel']) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true });
      // Other authorized work shares this checkout. Freeze this isolated page's
      // module graph so unrelated Vite reloads cannot reset a camera sweep.
      await page.routeWebSocket('**/*', socket => socket.onMessage(() => {}));
      await page.addInitScript(style => localStorage.setItem('exploritaire.artStyle', style), art);
      await page.goto(url);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.getByLabel('Cycle day/night', { exact: true }).check();
      await page.waitForTimeout(1800);
      assert.ok(await page.locator('.proto-map-viewport').evaluate(view => {
        const physical = view.querySelector('[data-physical-world]');
        const ground = view.querySelector('[data-ground-world]');
        return getComputedStyle(view).isolation === 'isolate'
          && physical.closest('.proto-map-composite--physical')
          && ground.closest('.proto-map-composite--ground')
          && view.querySelector('[data-ground-light], .proto-ground-light').closest('.proto-map-composite--ground')
          && getComputedStyle(physical).transformStyle === 'preserve-3d';
      }), 'Bounded compositors must separate ground/light from the preserved physical depth scene');
      const results = [];
      for (const zoom of [0, -650, -2000, 1600]) {
        await page.getByLabel('Table time of day', { exact: true }).fill(String(zoom === 0 ? 9 : zoom === -650 ? 18 : 0));
        const bounds = await page.locator('.proto-map-viewport').boundingBox();
        await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .5);
        if (zoom) await page.mouse.wheel(0, zoom);
        await page.waitForTimeout(900);
        if (zoom === -2000) {
          for (let attempt = 0; attempt < 4 && await page.locator('.proto-map-zoom').innerText() !== 'Zoom 400%'; attempt++) {
            await page.mouse.wheel(0, -2000); await page.waitForTimeout(600);
          }
          assert.equal(await page.locator('.proto-map-zoom').innerText(), 'Zoom 400%', 'Exercise the exact near-plane failure zoom');
        }
        for (let turn = 0; turn < 8; turn++) {
          const result = await page.locator('.proto-map-toolbar').evaluate(toolbar => {
            const buttons = [...toolbar.querySelectorAll('button')];
            return buttons.map(button => {
              const r = button.getBoundingClientRect();
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return { name: button.ariaLabel, hit: button.contains(hit), blocker: hit?.outerHTML.slice(0, 120) };
            });
          });
          results.push({ zoom, turn, buttons: result });
          const oversizedHalos = await page.locator('.proto-map-viewport').evaluate(view => {
            const limit = Math.min(view.clientWidth, view.clientHeight) * .36;
            return [...view.querySelectorAll('[data-halo-light]')].flatMap(halo => {
              const r = halo.getBoundingClientRect();
              return Number(getComputedStyle(halo).opacity) > .01 && (r.width > limit || r.height > limit)
                ? [{ light: halo.dataset.haloLight, width: r.width, height: r.height, limit }] : [];
            });
          });
          assert.deepEqual(oversizedHalos, [], 'A projected light halo must never wash out the map');
          const oversizedProps = await page.locator('[data-environment-prop]').evaluateAll(props => props.flatMap(prop => {
            const r = prop.getBoundingClientRect();
            return getComputedStyle(prop).visibility !== 'hidden' && Math.max(r.width, r.height) > 10000
              ? [{ id: prop.dataset.biomePopup || prop.dataset.biomeEdge, width: r.width, height: r.height }] : [];
          }));
          assert.deepEqual(oversizedProps, [], 'Billboards must clip before producing enormous compositing surfaces');
          await page.screenshot({ path: `artifacts/map-visibility/${width}-${art}-${zoom}-${turn}.png` });
          await page.getByRole('button', { name: 'Turn table right', exact: true }).click({ force: true });
          await page.waitForTimeout(360);
        }
      }
      const defects = (await Promise.all(['.proto-map-footer', '.proto-travel-controls'].map(root => findLayoutDefects(page, root, { parts: 'button, label' })))).flat();
      fs.writeFileSync(`artifacts/map-visibility/${width}-${art}.json`, JSON.stringify({ results, defects }, null, 2));
      console.log(JSON.stringify({ width, art, blocked: results.filter(r => r.buttons.some(b => !b.hit)), defects }));
      assert.deepEqual(defects, []);
      assert.ok(results.every(r => r.buttons.every(b => b.hit)), 'Map controls must remain above the projected world');
      // A real touch gesture must still pan through the new compositing layers.
      const bounds = await page.locator('.proto-map-viewport').boundingBox();
      const before = await page.locator('.proto-map-viewport').getAttribute('style');
      const cdp = await page.context().newCDPSession(page);
      const start = { x: bounds.x + bounds.width * .85, y: bounds.y + bounds.height * .6 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - step * 8, y: start.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      assert.notEqual(await page.locator('.proto-map-viewport').getAttribute('style'), before, 'Touch pan remains available');
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `artifacts/map-visibility/${width}-${art}-ott.png` });
      assert.ok(await page.locator('[data-ground-world] > [data-board-piece="tile"][data-tile-type="dirt"]').evaluate(tile => {
        const r = tile.getBoundingClientRect();
        return tile.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), 'OTT ground tiles remain interactive through the compositor');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
