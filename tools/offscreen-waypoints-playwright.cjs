const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('artifacts/offscreen-waypoints', { recursive: true });
  try {
    for (const width of [1280, 1912]) {
      const context = await browser.newContext({ viewport: { width, height: 914 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto('http://localhost:5178/proto.html');
      const card = page.locator('.proto-story-card[data-offscreen-waypoint]');
      await card.waitFor();
      const marker = page.locator('.offscreen-waypoint:visible');
      assert.equal(await marker.count(), 0);
      for (const [side, x, y] of [['left', -2000, 0], ['right', 2000, 0], ['top', 0, -2000], ['bottom', 0, 2000]]) {
        await card.evaluate((el, p) => { el.style.left = `calc(50% + ${p.x}px)`; el.style.top = `calc(50% + ${p.y}px)`; }, { x, y });
        await marker.waitFor();
        await page.waitForTimeout(100);
        const box = await marker.boundingBox(), view = await page.locator('.proto-map-viewport').boundingBox();
        assert.ok(box.x >= view.x && box.y >= view.y && box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height);
        if (side === 'left') assert.ok(box.x < view.x + 60);
        if (side === 'right') assert.ok(box.x > view.x + view.width - 140);
        if (side === 'top') assert.ok(box.y < view.y + 80);
        if (side === 'bottom') assert.ok(box.y > view.y + view.height - 210);
        const preview = await marker.locator('.offscreen-waypoint__preview').boundingBox();
        const arrow = await marker.locator(':scope > svg').boundingBox();
        if (side === 'left') assert.ok(arrow.x + arrow.width < preview.x);
        if (side === 'right') assert.ok(arrow.x > preview.x + preview.width);
        if (side === 'top') assert.ok(arrow.y + arrow.height < preview.y);
        if (side === 'bottom') assert.ok(arrow.y > preview.y + preview.height);
        const angle = await marker.locator(':scope > svg').evaluate(el => parseFloat(el.style.transform.match(/rotate\(([^r]+)/)[1]));
        assert.ok(Math.abs(angle - ({left: Math.PI, right: 0, top: -Math.PI/2, bottom: Math.PI/2}[side])) < .01, 'arrow points toward the prop');
        assert.deepEqual(await findLayoutDefects(page, '.offscreen-waypoint:not([hidden])', { parts: '.offscreen-waypoint__preview, svg' }), []);
        await marker.screenshot({ path: `artifacts/offscreen-waypoints/${width}-${side}-3x.png`, scale: 'device' });
      }
      await page.screenshot({ path: `artifacts/offscreen-waypoints/${width}-table.png` });
      assert.equal(await marker.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.equal(await marker.locator('[data-waypoint-preview]').evaluate(el => el.inert), true);
      await card.evaluate(el => { el.style.left = '50%'; el.style.top = '50%'; });
      await marker.waitFor({ state: 'hidden' });
      // Both input types still pan through the passive reference layer.
      for (const touch of [false, true]) {
        const view = await page.locator('.proto-map-viewport').boundingBox();
        const start = { x: view.x + view.width * .8, y: view.y + view.height * .7 };
        if (touch) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 140, y: start.y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x - 140, start.y, { steps: 8 }); await page.mouse.up();
        }
      }
      console.log('PASS', width, 'all edges, thumbnail containment, visibility, passive mouse/touch');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
