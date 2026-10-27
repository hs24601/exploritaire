const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const page = await context.newPage();
      assert.equal((await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html')).status(), 200);
      await page.waitForTimeout(900);
      const card = page.locator('.proto-story-card');
      const artwork = card.locator('.quest-artwork--scene img');
      await artwork.waitFor();
      assert.ok(await artwork.evaluate(el => el.complete && el.naturalWidth > 0 && el.src.includes('hero-snuffling-berries-v1.png')));
      const box = await card.boundingBox();
      assert.ok(Math.abs(box.width - 163.8) < 1);
      assert.ok(Math.abs(box.height - 228.8) < 1);
      assert.deepEqual(await findLayoutDefects(page, '.proto-ordinary-day', { parts: 'strong,.quest-artwork,.proto-ordinary-day__thought > span,.proto-ordinary-day__actions > span,button' }), []);
      const thought = page.locator('.proto-ordinary-day__thought');
      const text = await thought.innerText();
      if (touch) {
        const r = await thought.boundingBox();
        await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      } else await thought.hover();
      await page.getByRole('tooltip').waitFor();
      assert.equal(await page.getByRole('tooltip').innerText(), text);
      await page.mouse.move(10, 10);
      const header = page.locator('.proto-ordinary-day__heading');
      const r = await header.boundingBox();
      const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      const cdp = touch ? await context.newCDPSession(page) : null;
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
      await page.locator('[data-held-visual]').waitFor();
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 30, y: point.y + 20 }] });
      else await page.mouse.move(point.x + 30, point.y + 20);
      await page.locator('[data-held-visual]').screenshot({ path: `artifacts/compact-quest-${width}-${touch ? 'touch' : 'mouse'}-3x.png` });
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      else await page.mouse.up();
      assert.equal(await page.locator('[data-held-visual]').count(), 0);
      console.log('PASS compact quest', width, touch ? 'touch' : 'mouse');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
