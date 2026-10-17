const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://127.0.0.1:5189/proto.html';
const pause = page => page.waitForTimeout(900);
const transforms = card => card.locator('.layered-card-art').evaluate(el =>
  [...el.querySelectorAll('img')].map(img => getComputedStyle(img).transform));
(async () => {
  fs.mkdirSync('artifacts/hero-watercolor-holocard', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL);
      await page.locator('[data-board-piece="actor"]').first().focus();
      await page.keyboard.press('Enter');
      const viewer = page.locator('[data-inspection-id="hero"]');
      await viewer.waitFor();
      for (const state of ['compact', 'jumbo']) {
        if (state === 'jumbo') { await viewer.focus(); await page.keyboard.press('Enter'); }
        const card = viewer.locator(`.trading-card--${state}`);
        await card.waitFor();
        await card.locator('.layered-card-art img').first().evaluate(img => img.decode());
        await card.locator('.layered-card-art img').last().evaluate(img => img.decode());
        const stage = await viewer.locator('.trading-card-stage').boundingBox();
        await page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .2);
        await pause(page);
        const active = await transforms(card);
        assert.ok(active.every(t => t !== 'none'), 'Both planes transform');
        assert.ok(new DOMMatrixReplacement(active[0]).x < 0 && new DOMMatrixReplacement(active[1]).x > 0, 'Planes move oppositely');
        // Check full overscan coverage in local art coordinates, independent of card tilt.
        const coverage = await card.locator('.layered-card-art').evaluate(el => {
          const bg = el.querySelector('img'); const m = new DOMMatrix(getComputedStyle(bg).transform);
          return {left:bg.offsetLeft + m.m41, top:bg.offsetTop + m.m42,
            right:bg.offsetLeft + m.m41 + bg.offsetWidth, bottom:bg.offsetTop + m.m42 + bg.offsetHeight,
            width:el.clientWidth, height:el.clientHeight};
        });
        assert.ok(coverage.left <= 0 && coverage.top <= 0 && coverage.right >= coverage.width && coverage.bottom >= coverage.height,
          `Background covers crop at parallax extreme: ${JSON.stringify(coverage)}`);
        await viewer.screenshot({ path: `artifacts/hero-watercolor-holocard/${width}-${state}.png` });
        await page.mouse.move(1, 1); await pause(page);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stage.x + stage.width * .2, y: stage.y + stage.height * .4 }] });
        await pause(page);
        assert.ok(new DOMMatrixReplacement((await transforms(card))[0]).x > 0, 'Touch moves background');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach();
        await page.waitForFunction(() => {
          const img = document.querySelector('[data-inspection-id="hero"] .layered-card-art__background');
          return img && Math.abs(new DOMMatrix(getComputedStyle(img).transform).m41) < .02;
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .2);
        assert.deepEqual(await transforms(card), ['none', 'none'], 'Reduced motion is static');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      assert.equal(await viewer.count(), 0, 'Dismissal works');
      assert.deepEqual(errors, []);
      console.log(`${width}: compact/jumbo images, opposing parallax, crop coverage, touch/cancel, reduced motion and dismissal passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
function DOMMatrixReplacement(value) { this.x = Number(value.slice(value.indexOf('(') + 1, -1).split(',')[4]); }
