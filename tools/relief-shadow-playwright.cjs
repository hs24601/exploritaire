const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/relief-shadow';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: 914 }, hasTouch: true, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html');
      await page.waitForTimeout(1600);
      for (let turn = 0; turn < 8; turn++) {
        const layers = await page.evaluate(() => {
          const shadows = [...document.querySelectorAll('[data-shadow-owner]')];
          return { count: shadows.length, grounded: shadows.every(el => el.closest('[data-ground-world]')),
            volumes: document.querySelectorAll('[data-physical-world] [data-prop-volume]').length };
        });
        assert.ok(layers.count > 5 && layers.volumes >= 5);
        assert.ok(layers.grounded, 'Every ground shadow composites behind the complete relief raster');
        if (turn < 3) await page.screenshot({ path: `${out}/${width}-${turn * 45}.png` });
        const button = page.getByRole('button', { name: 'Turn table right', exact: true });
        if (turn % 2) await button.tap(); else await button.click();
        await page.waitForTimeout(450);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: ground shadows remain behind reliefs through a full mouse/touch orbit`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
