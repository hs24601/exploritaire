const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync('artifacts/dirt-tile', { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.PROTO_URL || 'http://127.0.0.1:5183/proto.html') + '?fx=low&atmosphere=off');
    const tile = page.locator('[data-biome-id="dirt-0-1"]');
    await tile.waitFor();
    assert.equal(await tile.getAttribute('data-grid-reference'), 'table:0,1');
    assert.equal(await tile.getAttribute('data-tile-type'), 'dirt');
    for (const view of ['ott', 'immersion']) {
      if (view === 'immersion') await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(600);
      assert.equal(await tile.locator('[data-dirt-ground]').evaluate(image => image.complete && image.naturalWidth > 0), true);
      assert.equal(await page.locator('[data-biome-popup="dirt-0-1"]').count(), 0);
      await page.screenshot({ path: `artifacts/dirt-tile/${view}.png` });
    }
    await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
    await page.waitForTimeout(600);
    await tile.click();
    await page.getByText('Bare earth underfoot', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Dirt is rendered at table:0,1 in OTT and immersion; inspection opens; no runtime errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
