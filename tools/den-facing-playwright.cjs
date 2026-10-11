const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const renderer of ['webgl', 'canvas']) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      assert.equal((await page.goto(`${process.env.PROTO_URL || 'http://localhost:5178/proto.html'}?propRenderer=${renderer}`)).status(), 200);
      await page.waitForTimeout(1000);
      // Move Hero away so her occlusion outline cannot hide the entrance.
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(from.x + 130, from.y - 90, { steps: 10 }); await page.mouse.up();
      await page.waitForTimeout(1800);
      if (await page.getByRole('button', { name: 'Tilt camera view', exact: true }).count()) await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      const den = page.locator('[data-biome-popup="hero-den"]');
      const canvas = den.locator('[data-prop-volume]').first();
      await canvas.waitFor();
      const sample = () => canvas.evaluate(el => {
        const data = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
        let count = 0, dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { count++; if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 30) dark++; }
        return { fraction: dark / count, yaw: Number(el.dataset.volumeYaw), engine: el.dataset.volumeEngine };
      });
      const back = await sample();
      assert.equal(back.yaw, 0);
      const placement = await den.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height]);
      for (let i = 0; i < 8; i++) {
        const turn = page.getByRole('button', { name: 'Turn table right', exact: true });
        if (i % 2) await turn.tap(); else await turn.click();
        await page.waitForTimeout(300);
        assert.equal(await den.getAttribute('data-scenery-symmetry'), 'asymmetric');
        assert.equal(await den.getAttribute('data-scenery-facing'), 'north');
        assert.equal(await den.getAttribute('data-scenery-heading'), '180');
        assert.deepEqual(await den.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height]), placement);
        if (i === 3) {
          const front = await sample();
          assert.equal(front.yaw, 180);
          assert.ok(front.fraction > back.fraction + .03, JSON.stringify({ front, back }));
          await canvas.screenshot({ path: `artifacts/den-north-mouth-${width}-${renderer}-3x.png` });
        }
      }
      const again = await sample();
      assert.equal(again.fraction, back.fraction);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference' }), []);
      assert.deepEqual(errors, []);
      console.log('PASS north-facing asymmetric den', width, renderer);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
