const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/transition-darkness';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const [tag, query, width, height, reducedMotion, touch] of [
      ['gpu', 'fx=high', 1280, 720, 'no-preference', false],
      ['canvas', 'atmosphere=canvas', 1280, 720, 'no-preference', false],
      ['phone', 'fx=low', 390, 844, 'no-preference', true],
      ['landscape', 'fx=low', 844, 390, 'reduce', true],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion, hasTouch: touch });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:5178/proto.html?${query}`);
      await page.locator('[data-atmosphere="volume"][data-resolution]').waitFor();
      for (const direction of ['Tilt', 'Flat', 'Tilt', 'Flat']) {
        await page.evaluate(() => {
          window.darknessSamples = [];
          const end = performance.now() + 1150;
          const sample = () => {
            const el = document.querySelector('[data-atmosphere="volume"]');
            window.darknessSamples.push([el.dataset.active, getComputedStyle(el).opacity, el.width, el.height]);
            if (performance.now() < end) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        const button = page.getByRole('button', { name: `${direction} camera view`, exact: true });
        if (touch) await button.tap(); else await button.click();
        await page.waitForTimeout(180);
        await page.screenshot({ path: `${out}/${tag}-${direction.toLowerCase()}.png` });
        await page.waitForTimeout(1200);
        const samples = await page.evaluate(() => window.darknessSamples);
        assert.ok(samples.length > 3, `${tag}: sampled transition`);
        assert.ok(samples.every(([active, opacity, w, h]) => active === 'true' && Number(opacity) === 1 && w > 0 && h > 0), `${tag}/${direction}: haze must remain fully visible on every frame`);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${tag}: continuous darkness in both directions, including repeated switches`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
