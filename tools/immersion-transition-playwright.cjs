const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const reduced of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.volumeDraws = 0;
        const draw = WebGLRenderingContext.prototype.drawArrays;
        WebGLRenderingContext.prototype.drawArrays = function (...args) {
          if (this.canvas.classList.contains('proto-volumetrics')) window.volumeDraws++;
          return draw.apply(this, args);
        };
      });
      await page.goto(URL + '?fx=high');
      await page.waitForFunction(() => window.volumeDraws > 0);
      await page.evaluate(() => { window.warmVolume = document.querySelector('.proto-volumetrics'); });
      const idle = await page.evaluate(() => window.volumeDraws);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.volumeDraws), idle, 'flat does not continuously render');
      for (let cycle = 0; cycle < 3; cycle++) {
        const timing = await page.evaluate(() => new Promise(resolve => {
          const start = performance.now(); let last = start; const gaps = []; let activeAt = null;
          document.querySelector('[aria-label="Tilt camera view"]').click();
          const tick = now => {
            gaps.push(now - last); last = now;
            if (activeAt === null && document.querySelector('.proto-volumetrics').dataset.active === 'true') activeAt = now - start;
            if (now - start < 1100) requestAnimationFrame(tick);
            else resolve({ activeAt, worstMs: Math.max(...gaps), p95Ms: gaps.sort((a,b)=>a-b)[Math.floor(gaps.length*.95)] });
          }; requestAnimationFrame(tick);
        }));
        assert.ok(timing.activeAt !== null);
        if (!reduced) assert.ok(timing.activeAt >= 500, 'volume waits for camera lean');
        assert.ok(await page.evaluate(() => window.warmVolume === document.querySelector('.proto-volumetrics')), 'canvas survives entry');
        await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
        await page.waitForTimeout(700);
        assert.ok(await page.evaluate(() => window.warmVolume === document.querySelector('.proto-volumetrics')), 'canvas survives exit');
        const paused = await page.evaluate(() => window.volumeDraws);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => window.volumeDraws), paused, 'flat pauses draws');
        results.push({ reduced, cycle, ...timing });
      }
      // Reverse before either staged timeout fires; stale entry must not show fog.
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(80);
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(700);
      assert.equal(await page.locator('.proto-volumetrics').getAttribute('data-active'), 'false');
      assert.deepEqual(errors, []);
      await page.close();
    }
    fs.writeFileSync('artifacts/immersion-transition-timing.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
    console.log('Warm renderer reuse, delayed entry, paused flat rendering, rapid reversal and reduced motion verified.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
