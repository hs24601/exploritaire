const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const url = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const camera = page => page.locator('.proto-map-world').evaluate(el => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42, scale: m.a };
});
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      await page.goto(url);
      await page.locator('.proto-map-toolbar').waitFor();
      const footer = page.locator('.proto-map-footer');
      assert.equal(await footer.locator('button').count(), 5);
      assert.equal(await page.getByRole('button', { name: /expedition quest tracker/ }).count(), 0);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-zoom, .proto-map-toolbar, .proto-map-camera-button, .table-grid-reference' }), []);
      const mapBox = await page.locator('.proto-map').boundingBox();
      const dockBox = await footer.boundingBox();
      assert.ok(dockBox.y > mapBox.y + mapBox.height - 55, 'Controls sit at the bottom');
      await footer.screenshot({ path: `artifacts/map-controls-${width}-3x.png` });
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Flat camera view', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).tap();
      await page.waitForTimeout(700);
      const view = await page.locator('.proto-map-viewport').boundingBox();
      const x = view.x + 45, y = view.y + 70;
      await page.mouse.move(x, y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(x + 75, y + 40, { steps: 6 });
      await page.mouse.up({ button: 'right' });
      const panned = await camera(page);
      assert.ok(Math.abs(panned.x) > 30 || Math.abs(panned.y) > 30, 'Pan moved the camera before recentering');
      await page.getByRole('button', { name: 'True Center', exact: true }).click();
      const centered = await camera(page);
      assert.ok(Math.abs(centered.x) < 0.1 && Math.abs(centered.y) < 0.1);
      assert.equal(centered.scale, panned.scale, 'True Center preserves zoom');
      await page.getByRole('button', { name: 'Turn table right', exact: true }).tap();
      await page.waitForTimeout(700);
      const yaw = await page.locator('.proto-map-viewport').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--camera-yaw')));
      assert.ok(Math.abs(yaw - 45) < 0.1);
      await page.getByRole('button', { name: 'Reset View', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      const resetYaw = await page.locator('.proto-map-viewport').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--camera-yaw')));
      assert.ok(Math.abs(resetYaw) < 0.1);
      assert.match(await page.locator('.proto-map-zoom').innerText(), /100%/);
      await page.close();
    }
    console.log('Desktop dock layout, mouse/touch camera actions, keyboard reset and 3x screenshots passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
