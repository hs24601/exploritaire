const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const out = 'artifacts/den-occlusion'; fs.mkdirSync(out, { recursive: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: touch });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      for (const art of ['paint', 'pixel']) {
        await page.getByRole('button', { name: 'Game settings', exact: true }).click();
        await page.getByLabel('Art style', { exact: true }).selectOption(art); await page.keyboard.press('Escape');
        for (let i = 0; i < 8; i++) {
          await page.waitForTimeout(600);
          const den = page.locator('[data-biome-popup="hero-den"]');
          assert.equal(await den.locator('[data-den-mouth-peek], [data-actor-peek]').count(), 0, 'Cave stone has no actor cutout');
          if (art === 'paint') {
            const polygons = await den.locator('clipPath').evaluateAll(nodes => nodes.map(node => node.querySelectorAll('polygon').length));
            assert.ok(polygons.every(count => count === 1), 'Interior is clipped only to the authored mouth');
          }
          await page.screenshot({ path: out + '/' + art + '-' + touch + '-' + i + '.png' });
          await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
        }
      }
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      if (touch) await page.touchscreen.tap(grip.x + grip.width / 2, grip.y + grip.height / 2);
      else await page.mouse.click(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.getByRole('dialog', { name: 'Hero', exact: true }).waitFor();
      assert.deepEqual(errors, []); await page.close();
      console.log('PASS den occlusion, Paint/Pixel orbit and ' + (touch ? 'touch' : 'mouse') + ' inspection');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
