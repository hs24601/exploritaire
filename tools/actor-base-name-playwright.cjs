const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('artifacts/actor-base-name', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.locator('[data-board-piece="actor"]').waitFor();
      assert.equal(await page.locator('[data-actor-base-name]').count(), 0);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      const name = page.locator('[data-actor-base-name]').first();
      await name.waitFor({ state: 'attached' });
      for (let turn = 0; turn < 8; turn++) {
        // Curved glyph bounding rectangles overlap at their empty corners;
        // check containment and text size separately from axis-aligned overlap.
        assert.deepEqual(await findLayoutDefects(page, '.proto-map', { parts: '[data-actor-base-name]', minFontSize: 16 }), []);
        assert.equal(await name.textContent(), 'Hero');
        const box = await name.locator('span').evaluateAll(nodes => {
          const boxes = nodes.map(n => n.getBoundingClientRect());
          return { x: Math.min(...boxes.map(b => b.left)), y: Math.min(...boxes.map(b => b.top)), right: Math.max(...boxes.map(b => b.right)), bottom: Math.max(...boxes.map(b => b.bottom)) };
        });
        await page.screenshot({ path: `artifacts/actor-base-name/${width}-${turn}-3x.png`, clip: { x: box.x - 20, y: box.y - 90, width: box.right - box.x + 40, height: box.bottom - box.y + 110 } });
        await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
        await page.waitForTimeout(150);
      }
      await page.close();
    }
    console.log('Upright actor names: desktop layout, eight camera directions, sharp screenshots, and flat-mode absence passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
