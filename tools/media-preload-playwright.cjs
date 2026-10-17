const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html?atmosphere=off';

(async () => {
  fs.mkdirSync('artifacts/media-preload', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [style, touch, missing] of [['paint', false, false], ['pixel', true, false], ['paint', true, true]]) {
      const page = await browser.newPage({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: touch });
      await page.addInitScript(style => localStorage.setItem('exploritaire.artStyle', style), style);
      const errors = [], failed = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && r.url().includes('/assets/')) failed.push(r.url()); });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: -1, uploadThroughput: -1 });
      if (missing) await page.route('**/hero-den-overhead-v2.png', route => route.fulfill({ status: 404, body: '' }));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-media-loading]');
      await page.screenshot({ path: `artifacts/media-preload/${style}-${touch}-loading.png` });
      await page.waitForSelector('.proto-game-root', { timeout: 12000 });
      assert.equal(await page.locator('[data-media-loading]').count(), 0);
      if (!missing) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const ready = await page.locator('[data-den-overhead]').evaluate(img => img.complete && img.naturalWidth > 0);
        assert.ok(ready, 'opening den art is already loaded');
      }
      // Verify all manifest paths exist and both renderers share an image while
      // still owning independently disposable textures.
      const result = await page.evaluate(async style => {
        const { protoMediaAssets } = await import('/src/proto/mediaAssets.ts');
        const { loadMediaImage } = await import('/src/proto/mediaCache.ts');
        const { loadMediaTexture } = await import('/src/proto/mediaTexture.ts');
        const list = protoMediaAssets(style);
        const responses = await Promise.all([...list.opening, ...list.background].map(async src => ({ src, ok: (await fetch(src, { method: 'HEAD' })).ok })));
        const src = list.background[0];
        const [image, a, b] = await Promise.all([loadMediaImage(src), loadMediaTexture(src), loadMediaTexture(src)]);
        const shared = a.image === image && b.image === image && a !== b;
        a.dispose(); b.dispose();
        const root = document.querySelector('.proto-game-root');
        const { setArtStyle } = await import('/src/proto/artStyle.ts');
        setArtStyle(style === 'paint' ? 'pixel' : 'paint');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { responses, shared, preserved: root === document.querySelector('.proto-game-root') };
      }, style);
      assert.ok(result.shared); assert.ok(result.preserved, 'style switch keeps game mounted');
      assert.deepEqual(result.responses.filter(r => !r.ok).map(r => r.src), missing ? ['/assets/biomes/watercolor-v1/hero-den-overhead-v2.png'] : []);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `artifacts/media-preload/${style}-${touch}-${missing}-ready.png` });
      console.log(JSON.stringify({ style, touch, missing, shared: result.shared, preserved: result.preserved, failed }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
