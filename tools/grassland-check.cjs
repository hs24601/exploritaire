const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let url;
    for (const scheme of ['http', 'https']) {
      try { url = `${scheme}://localhost:5178/proto.html`; await page.goto(url); break; } catch { url = null; }
    }
    assert.ok(url, 'Proto server loads');
    await page.locator('[data-board-piece="actor"]').first().waitFor();
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      await page.setViewportSize({ width, height });
      for (const tilted of [false, true]) {
        if (tilted) await page.keyboard.press('Space');
        await page.waitForTimeout(900);
        assert.equal(await page.locator('[data-grassland-cell], [data-grassland-prop], [data-biome-edge^="table:"]').count(), 0, 'grass layer and props are removed');
        assert.equal(await page.locator('button[data-biome-id]').count(), 4, 'dedicated biomes remain');
        assert.equal(await page.locator('[data-board-piece="actor"]').count(), 1, 'Hero remains');
        assert.equal(await page.locator('[data-blocked-region]').count(), 4, 'table boundary remains');
        if (tilted) assert.ok(await page.locator('[data-biome-edge]').count() > 0, 'biome edge scenery remains');
        assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
        await page.screenshot({ path: `artifacts/no-grass-${width}-${tilted ? 'tilt' : 'flat'}-3x.png` });
        if (tilted) await page.keyboard.press('Space');
      }
    }
    assert.deepEqual(errors, []);
    console.log(`${url}: no grass in either camera, biomes/Hero/table boundary retained, desktop layouts and runtime errors passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
