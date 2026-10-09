const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = [];
  fs.mkdirSync('artifacts/scenery-closeup', { recursive: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      const viewport = await page.locator('.proto-map-viewport').boundingBox();
      // Frame the Dark Woods with an actual right-drag, as in the supplied images.
      const centre = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(centre.x - 96 * 1.7, centre.y - 48 * 1.7 * .5, { steps: 10 });
      await page.mouse.up({ button: 'right' });
      const state = () => page.locator('.proto-map-viewport').evaluate(el => ({
        scale: parseFloat(getComputedStyle(el).getPropertyValue('--camera-scale')),
      }));
      const cdp = await page.context().newCDPSession(page);
      const points = distance => [{ x: viewport.x + 190 - distance / 2, y: viewport.y + 100, id: 1 },
        { x: viewport.x + 190 + distance / 2, y: viewport.y + 100, id: 2 }];
      const zoomTo = async scale => {
        const start = (await state()).scale;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(100 * scale / start) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(300);
      };
      const check = async tag => {
        const popup = page.locator('[data-biome-popup="woods-danger"]');
        assert.equal(await popup.count(), 1, `${width} ${tag}: centre pop-up remains rendered`);
        const box = await popup.boundingBox();
        assert.ok(box.width > 60 && box.height > 60, `${width} ${tag}: readable centre scenery`);
        assert.ok(box.y + box.height > viewport.y && box.y < viewport.y + viewport.height);
        const labels = await page.locator('[data-biome-id] .board-object-label__text > span').evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.closest('[data-biome-id]').dataset.biomeId, x: r.x, y: r.y, width: r.width, height: r.height };
        }));
        for (const label of labels) assert.ok(overlap(box, label) < 1, `${width} ${tag}: centre art covers ${label.id}`);
        assert.deepEqual(await findLayoutDefects(page, '.proto-map', { parts: '.proto-map-camera-button' }), []);
        report.push({ width, tag, scale: (await state()).scale, popup: box });
        await page.screenshot({ path: `artifacts/scenery-closeup/${width}-${tag}-3x.png` });
      };
      for (const percent of [265, 293, 332, 400]) {
        await zoomTo(percent === 265 ? 4.5 : percent * 1.7 / 100);
        await check(String(percent));
      }
      // Wheel zoom back out and in must preserve the same middle prop too.
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.wheel(0, 350);
      await page.waitForTimeout(1500);
      await check('wheel-out');
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1500);
      await check('wheel-400');
      assert.deepEqual(errors, []);
      await page.close();
    }
    fs.writeFileSync('artifacts/scenery-closeup/geometry.json', JSON.stringify(report, null, 2));
    console.log('Dark Woods centre scenery stays visible through 265–400% with mouse/touch zoom, readable labels and desktop layout at 1280 and 1912; 3x screenshots captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
