const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto('http://localhost:5178/proto.html');
      const layer = page.locator('[data-peripheral-darkness]');
      await layer.waitFor();
      const result = await layer.evaluate(el => {
        const style = getComputedStyle(el), bounds = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
        return { background: style.backgroundImage, pointer: style.pointerEvents, z: +style.zIndex, width: bounds.width, parentWidth: el.parentElement.clientWidth, valid: CSS.supports('background-image', style.backgroundImage) };
      });
      assert(result.valid); assert.equal(result.pointer, 'none'); assert(Math.abs(result.width - result.parentWidth) <= 2);
      assert(result.background.includes('0.96'));
      assert.equal(await page.locator('.proto-callout').first().evaluate(el => +getComputedStyle(el).zIndex > 44), true);
      await page.screenshot({ path: `artifacts/peripheral-darkness-${width}.png` });
      // The existing store is also the source for the settings checkbox.
      await page.evaluate(async () => { const lights = await import('/src/proto/globalLighting.ts'); lights.setGlobalLightsEnabled(false); });
      await layer.waitFor({ state: 'detached' });
      await page.evaluate(async () => { const lights = await import('/src/proto/globalLighting.ts'); lights.setGlobalLightsEnabled(true); });
      await layer.waitFor();
      console.log('PASS peripheral darkness, UI layering, viewport fit and global bypass', width, touch);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


