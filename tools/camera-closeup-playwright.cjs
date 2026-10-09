const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:5178/proto.html');
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(900);
      const view = await page.locator('.proto-map-viewport').boundingBox();
      const rig = () => page.locator('.proto-table-stage').evaluate(el => ({
        angle: parseFloat(getComputedStyle(el).getPropertyValue('--table-tilt')),
        scale: parseFloat(getComputedStyle(el.closest('.proto-map-viewport')).getPropertyValue('--camera-scale')),
        transform: getComputedStyle(el).transform,
      }));
      // Real two-finger zoom reaches the old cap without changing elevation.
      const cdp = await page.context().newCDPSession(page);
      const points = distance => [{ x: view.x + 200 - distance / 2, y: view.y + 120, id: 1 }, { x: view.x + 200 + distance / 2, y: view.y + 120, id: 2 }];
      const pinch = async (from, to) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(to) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(200);
      };
      await pinch(100, 100 * 4.5 / 1.7);
      assert.ok(Math.abs((await rig()).scale - 4.5) < .01);
      assert.equal((await rig()).angle, 60);
      await page.screenshot({ path: `artifacts/camera-descent-${width}-265-3x.png` });
      await pinch(100, 100 * 5.65 / 4.5);
      assert.ok(Math.abs((await rig()).angle - 71) < .1, 'pinch lowers the camera beyond the old cap');
      await page.screenshot({ path: `artifacts/camera-descent-${width}-332-3x.png` });
      await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1800);
      const scale = await page.locator('.proto-map-world').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11);
      assert.ok(Math.abs(scale - 6.8) < .01, `maximum zoom: ${scale}`);
      const angle = await page.locator('.proto-table-stage').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--table-tilt')));
      assert.equal(angle, 82);
      const actor = await page.locator('[data-board-piece="actor"]').boundingBox();
      assert.ok(actor.y >= view.y && actor.y + actor.height / 2 <= view.y + view.height, 'upper half of actor stays visible');
      const overlays = await page.locator('.proto-table-light').evaluateAll(elements => elements.map(el => ({ angle: parseFloat(getComputedStyle(el).getPropertyValue('--table-tilt')), transform: getComputedStyle(el).transform })));
      for (const overlay of overlays) { assert.equal(overlay.angle, angle); assert.equal(overlay.transform, (await rig()).transform); }
      // Hover inversion must still find the actor's square at the low angle.
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.table-grid-reference').getAttribute('data-grid-reference'), 'table:0,1');
      const cameraPosition = () => page.locator('.proto-map-world').evaluate(el => el.style.transform);
      const frozen = await cameraPosition();
      const grab = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
      await page.mouse.down();
      await page.mouse.move(grab.x + 24, grab.y - 12, { steps: 3 });
      await page.locator('[data-actor-drag-ghost]').waitFor();
      assert.equal(await cameraPosition(), frozen, 'mouse actor drag freezes the low camera');
      await page.locator('[data-board-piece="actor"]').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
      await page.mouse.up();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...grab, id: 3 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: grab.x + 24, y: grab.y - 12, id: 3 }] });
      await page.locator('[data-actor-drag-ghost]').waitFor();
      assert.equal(await cameraPosition(), frozen, 'touch actor drag freezes the low camera');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await pinch(100, 100 * 4.5 / 6.8);
      assert.ok(Math.abs((await rig()).angle - 60) < .01, 'zooming back out restores elevation and aim');
      await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1800);
      const defects = await findLayoutDefects(page, '.proto-map', { parts: '.proto-map-camera-button' });
      assert.deepEqual(defects, []);
      await page.screenshot({ path: `artifacts/camera-closeup-${width}-3x.png` });
      await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
      await page.waitForTimeout(500);
      assert.equal((await rig()).angle, 82);
      await page.screenshot({ path: `artifacts/camera-descent-${width}-spin-3x.png` });
      await page.getByRole('button', { name: 'Reset View', exact: true }).click();
      await page.waitForTimeout(500);
      assert.equal((await rig()).angle, 60);
      assert.equal((await rig()).scale, 1.7);
      await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1800);
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.proto-table-stage').evaluate(el => getComputedStyle(el).transform), 'none');
      assert.ok(Math.abs((await rig()).scale - 5.95) < .01, 'flat restores its 350% cap');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Desktop 3x screenshots: touch descent through 265%, wheel to 400% / 82 degrees, actor visibility, light alignment, pointer inversion, mouse/touch actor drag, reverse zoom, spin, reset, layout and flat restore passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
