const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch();
  try {
    const errors = [];
    for (const pitch of [20, 55, 90]) for (const pose of ['sitting', 'standing', 'walking']) {
      const page = await browser.newPage({ viewport: { width: 1912, height: 600 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto('http://localhost:5178/tools/hero-faces-preview.html');
      await page.getByRole('button', { name: `${pitch}°`, exact: true }).click();
      await page.getByRole('button', { name: pose, exact: true }).click();
      for (const emotion of ['happy', 'joyful', 'curious', 'sad']) {
        await page.getByRole('button', { name: emotion === 'sad' ? 'Sad' : `${emotion[0].toUpperCase() + emotion.slice(1)} expression`, exact: true }).click();
        try {
          await page.waitForFunction(({ pose, emotion }) => document.querySelectorAll(`canvas[data-sprite-pose=${pose}][data-actor-expression=${emotion}]`).length === 8, { pose, emotion }, { timeout: 60000 });
        } catch (error) {
          console.log({pitch,pose,emotion,errors,canvases:await page.locator('canvas').evaluateAll(cs=>cs.map(c=>({...c.dataset})))});
          throw error;
        }
        await page.waitForTimeout(100);
        assert.deepEqual(await findLayoutDefects(page, '#root', { parts: '[data-table-sectional-sprite]' }), []);
        await page.screenshot({ path: `artifacts/opening-hero-${emotion}-${pose}-${pitch}-3x.png` });
        if (pitch !== 90) await page.screenshot({ path: `artifacts/opening-hero-${emotion}-${pose}-${pitch}-detail.png`, clip: { x: 16, y: 80, width: 624, height: 260 } });
        console.log(`PASS ${emotion} ${pose} ${pitch}: eight directions, bounds, runtime`);
      }
      await page.close(); // Release all eight WebGL contexts before the next camera/pose.
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
