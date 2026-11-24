const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
async function center(el) { const r = await el.boundingBox(); assert.ok(r); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
async function drag(page, from, to, touch) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
  if (touch) await send('touchStart', from); else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 10; i++) { const p = { x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10 }; if (touch) await send('touchMove', p); else await page.mouse.move(p.x, p.y); }
  if (touch) await send('touchEnd', to); else await page.mouse.up();
  await cdp?.detach();
}
async function camera(page) { return page.locator('.proto-map-viewport').evaluate(el => ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw'].map(name => parseFloat(el.style.getPropertyValue(name)))); }
async function speed(page, value) { await page.getByRole('slider', { name: 'Travel speed' }).fill(String(value)); }
async function travel(page, touch) {
  const from = await center(page.locator('[data-cell-grip="actor-hero"]'));
  // An open cell due north of the den: use the rendered grid rather than a biome encounter.
  await drag(page, from, { x: from.x, y: from.y - 48 * 1.7 * 3 }, touch);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: 3 });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL); await page.waitForTimeout(1000);
      const slider = page.getByRole('slider', { name: 'Travel speed' });
      const follow = page.getByRole('checkbox', { name: 'Follow traveling actor' });
      assert.equal(await slider.inputValue(), '100'); assert.equal(await follow.isChecked(), true);
      assert.equal(await slider.getAttribute('min'), '5'); assert.equal(await slider.getAttribute('max'), '500');
      assert.deepEqual(await findLayoutDefects(page, '.proto-travel-controls', { parts: 'label,input,output' }), []);
      await page.locator('.proto-travel-controls').screenshot({ path: `artifacts/travel-controls-${width}-${touch ? 'touch' : 'mouse'}-3x.png` });
      // Real pointer interaction with the slider and checkbox must leave framing alone.
      const before = await camera(page); const box = await slider.boundingBox();
      await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width - 2, y: box.y + box.height / 2 }, touch);
      assert.ok(Number(await slider.inputValue()) >= 490);
      assert.deepEqual(await camera(page), before);
      if (touch) { const p = await center(follow); await page.touchscreen.tap(p.x, p.y); } else await follow.click();
      assert.equal(await follow.isChecked(), false);
      await speed(page, 100);
      await travel(page, touch); await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-route-line]').count(), 1);
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'tabletop');
      assert.deepEqual(await camera(page), before);
      await page.waitForTimeout(1400);
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,2', 'opening remains slow regardless of 100% slider');
      assert.equal(await slider.inputValue(), '100', 'temporary pace preserves slider');
      await page.locator('[data-route-line]').waitFor({ state: 'detached' });
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,-1');
      // A slow trip gives enough time to verify follow and live speed changes.
      await page.reload(); await page.waitForTimeout(700); await speed(page, 5);
      await travel(page, touch); await page.waitForTimeout(1300);
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'immersive');
      const followed = await camera(page);
      assert.ok(Math.abs(followed[2] - 5.1) < .02, `300% zoom: ${followed}`);
      assert.ok(Math.abs(followed[3] % 360) < 1, `behind northward actor: ${followed}`);
      await page.screenshot({ path: `artifacts/travel-follow-${width}-${touch ? 'touch' : 'mouse'}.png` });
      await page.waitForTimeout(500); const moved = await camera(page); assert.ok(moved[1] > followed[1], 'camera follows live position');
      await page.getByRole('checkbox', { name: 'Follow traveling actor' }).uncheck();
      await page.waitForTimeout(100); const stopped = await camera(page); await page.waitForTimeout(350); assert.deepEqual(await camera(page), stopped);
      await page.getByRole('checkbox', { name: 'Follow traveling actor' }).check();
      await page.waitForTimeout(400); assert.notDeepEqual(await camera(page), stopped, 'follow resumes during a trip');
      await page.keyboard.press('Space'); await page.waitForTimeout(700);
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'tabletop', 'manual mode switch takes over');
      const manual = await camera(page); await page.waitForTimeout(300); assert.deepEqual(await camera(page), manual);
      await speed(page, 500); await page.locator('[data-route-line]').waitFor({ state: 'detached', timeout: 3000 });
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,-1');
      assert.deepEqual(errors, []); console.log('PASS travel controls', width, touch ? 'touch' : 'mouse');
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); await page.goto(URL); await page.waitForTimeout(700); await speed(page, 5);
    await travel(page, false); await page.waitForTimeout(150);
    assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'immersive');
    assert.ok(Math.abs((await camera(page))[2] - 5.1) < .001, 'reduced motion enters 300% without easing');
    await speed(page, 500); await page.waitForTimeout(1400);
    assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,2', 'opening remains slow after slider changes to 500%');
    assert.equal(await page.getByRole('slider', { name: 'Travel speed' }).inputValue(), '500');
    await page.locator('[data-route-line]').waitFor({ state: 'detached', timeout: 8000 });
    console.log('PASS reduced motion'); await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
