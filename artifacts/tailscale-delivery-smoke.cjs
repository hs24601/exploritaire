const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    let localBuild;
    for (const [name, url] of [
      ['local', 'http://127.0.0.1:5178/proto.html'],
      ['tailscale', 'https://zenduo.tail867eff.ts.net/proto.html'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
      const errors = [];
      const failedResponses = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      assert.equal(response.status(), 200);
      await page.locator('[data-cell-grip="actor-hero"]').waitFor();
      await page.locator('.proto-build-label').waitFor();
      const build = await page.locator('.proto-build-label').innerText();
      if (name === 'local') localBuild = build;
      else assert.equal(build, localBuild, 'Tailscale serves the same current source revision');
      const initialView = await page.locator('[data-camera-view]').getAttribute('data-camera-view');
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
      assert.notEqual(await page.locator('[data-camera-view]').getAttribute('data-camera-view'), initialView, 'Immersion toggles');
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
      assert.equal(await page.locator('[data-camera-view]').getAttribute('data-camera-view'), initialView);
      const state = await page.evaluate(() => ({
        secure: window.isSecureContext,
        brokenImages: [...document.images].filter(image => image.currentSrc && (!image.complete || image.naturalWidth === 0)).map(image => image.currentSrc),
        pageOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      }));
      assert.equal(state.secure, true);
      assert.deepEqual(state.brokenImages, []);
      assert.equal(state.pageOverflow, false);
      assert.deepEqual(errors, []);
      assert.deepEqual(failedResponses, []);
      await page.screenshot({ path: `artifacts/tailscale-delivery-${name}.png` });
      console.log(JSON.stringify({ name, url, build, ...state, errors, failedResponses }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
