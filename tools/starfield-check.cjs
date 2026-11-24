const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1912, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1912 ? 914 : 720 }, reducedMotion: 'reduce', deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:5178/proto.html');
      const next = page.locator('[data-callout-id="day01.opening"] .proto-callout-next');
      await next.waitFor({ timeout: 60000 }); await next.click(); await page.waitForTimeout(2500);
      const sky = page.locator('[data-starfield-sky]');
      assert.ok(Number(await sky.getAttribute('data-horizon')) > 0);
      assert.deepEqual(await findLayoutDefects(page, '[data-starfield-sky]', { parts: 'canvas' }), []);
      assert.equal(await sky.evaluate(c => getComputedStyle(c).pointerEvents), 'none');
      await page.screenshot({ path: `artifacts/starfield-${width}-3x.png` });
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(700); assert.equal(await sky.count(), 0);
      assert.deepEqual(errors, []); console.log(`PASS ${width}: steep sky horizon, bounded canvas, input transparency, tabletop removal, no runtime errors`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
