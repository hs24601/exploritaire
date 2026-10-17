const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto('http://localhost:5178/proto.html');
      assert.equal(response.status(), 200);
      const viewport = page.locator('.proto-map-viewport');
      await viewport.waitFor();
      let view = await viewport.boundingBox();
      const state = () => viewport.evaluate(el => {
        const css = getComputedStyle(el);
        return { scale: parseFloat(css.getPropertyValue('--camera-scale')), x: parseFloat(css.getPropertyValue('--camera-x')), y: parseFloat(css.getPropertyValue('--camera-y')) };
      });
      const settle = scale => page.waitForFunction(scale => Math.abs(parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-scale')) - scale) < .001, scale);
      await page.mouse.move(view.x + 100, view.y + 100);
      await page.mouse.wheel(0, -10000);
      await settle(5.95);
      assert.equal(await page.locator('.proto-map-zoom').innerText(), 'Zoom 350%');
      assert.equal(await page.locator('.proto-table-stage').evaluate(el => getComputedStyle(el).transform), 'none');
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(300);
      assert.ok(Math.abs((await state()).scale - 5.95) < .001, 'wheel stays capped');
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-readouts, .proto-map-fps, .proto-map-zoom, .proto-map-toolbar, .proto-map-camera-button, .table-grid-reference' }), []);
      await page.screenshot({ path: `artifacts/ott-zoom-${width}-350-3x.png` });
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      await settle(1.7);
      await page.waitForTimeout(500);
      view = await viewport.boundingBox();
      // Pan beyond occupied tiles so neither finger starts an object gesture.
      await page.mouse.move(view.x + 100, view.y + 100);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(view.x + 2100, view.y + 100, { steps: 4 });
      await page.mouse.up({ button: 'right' });
      const cdp = await page.context().newCDPSession(page);
      const points = distance => [{ x: view.x + 220 - distance / 2, y: view.y + 100, id: 1 }, { x: view.x + 220 + distance / 2, y: view.y + 100, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(80) });
      await page.waitForTimeout(100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(320) });
      await page.waitForTimeout(100);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settle(5.95);
      assert.equal(await page.locator('.proto-map-zoom').innerText(), 'Zoom 350%');
      await page.getByRole('button', { name: 'True Center', exact: true }).click();
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(650);
      await page.mouse.move(view.x + 100, view.y + 100);
      await page.mouse.wheel(0, -10000);
      await settle(6.8);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(view.x + 145, view.y + 115, { steps: 3 });
      await page.mouse.up({ button: 'right' });
      const immersive = await state();
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await settle(5.95);
      await page.waitForTimeout(650);
      const flat = await state();
      assert.ok(Math.abs(flat.x / flat.scale - immersive.x / immersive.scale) < .01, 'mode clamp preserves horizontal world center');
      assert.ok(Math.abs(flat.y / flat.scale - immersive.y / immersive.scale) < .01, 'mode clamp preserves vertical world center');
      assert.equal(await page.locator('.proto-map-zoom').innerText(), 'Zoom 350%');
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      await settle(1.7);
      assert.ok(Math.abs((await state()).scale - 1.7) < .001, 'reset restores starting scale');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('OTT wheel/pinch 350% cap, immersion 400%, return framing, reset, desktop footer layout, page errors and 3x screenshots passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
