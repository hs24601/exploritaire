const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto('http://localhost:5178/proto.html');
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(900);
      const view = await page.locator('.proto-map-viewport').boundingBox();
      await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.waitForTimeout(1800);
      const scale = await page.locator('.proto-map-world').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11);
      assert.ok(Math.abs(scale - 4.5) < .01, `maximum zoom: ${scale}`);
      const angle = await page.locator('.proto-table-stage').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--table-tilt')));
      assert.equal(angle, 60);
      const defects = await findLayoutDefects(page, '.proto-map', { parts: '.proto-map-camera-button' });
      assert.deepEqual(defects, []);
      await page.screenshot({ path: `artifacts/props-after-${width}.png` });
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.proto-table-stage').evaluate(el => getComputedStyle(el).transform), 'none');
      await page.close();
    }
    console.log('Desktop close-up: 4.5x zoom, 60 degree tilt, camera control layout, flat restore passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
