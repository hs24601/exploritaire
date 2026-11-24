const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html?atmosphere=off';
const output = 'artifacts/tile-discovery-art';
const tileId = 'woods-danger';
const filter = page => page.locator(`filter[data-discovery-tile="${tileId}"]`);
const state = page => filter(page).evaluate(el => ({
  id: el.id, started: Number(el.dataset.discoveryStart),
  etch: el.querySelector('[result="etchMaskRGB"] feFuncR').intercept.animVal,
  fill: el.querySelector('[result="fillMaskRGB"] feFuncR').intercept.animVal,
}));
async function travel(page, touch) {
  await page.getByRole('slider', { name: 'Travel speed', exact: true }).fill('500');
  const a = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
  const t = await page.locator('[data-biome-id="dirt--2-1"]').boundingBox();
  assert.ok(a && t);
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const to = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 12; i++) {
    const point = { x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 };
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
    else await page.mouse.move(point.x, point.y);
  }
  if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
  await cdp?.detach();
}
async function finish(page) {
  await page.waitForFunction(() => !document.querySelector('filter[data-discovery-tile]'), null, { timeout: 12000 });
  assert.equal(await page.locator('[data-discovery-art]').evaluateAll(els => els.filter(el => (el.getAttribute('filter') || el.style.filter).includes('tile-discovery-')).length), 0);
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [touch, reduced, style] of [[false, false, 'paint'], [true, false, 'pixel'], [true, true, 'paint']]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(style => localStorage.setItem('exploritaire.artStyle', style), style);
      await page.goto(URL);
      await page.locator('[data-cell-grip="actor-hero"]').waitFor();
      assert.equal(await page.locator('filter[data-discovery-tile]').count(), 0, 'Startup tiles are already painted');
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'tabletop');
      await travel(page, touch);
      if (reduced) {
        await page.waitForFunction(() => document.querySelector('[data-biome-id="woods-danger"]')?.dataset.unexplored !== 'true');
        assert.equal(await page.locator('filter[data-discovery-tile]').count(), 0, 'Reduced motion reveals art immediately');
        await page.keyboard.press('Space');
        await page.waitForTimeout(800);
        assert.equal(await page.locator('filter[data-discovery-tile]').count(), 0);
      } else {
        await filter(page).waitFor({ state: 'attached' });
        const first = await state(page);
        assert.ok(first.fill < -4.9, 'Color waits until after etching');
        assert.equal(await page.locator('.proto-combat-demo').count(), 0, 'Nearby discovery never starts combat');
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${output}/${style}-ott-etch.png` });
        assert.ok(await page.locator('[data-connected-terrain] use[filter]').count() > 0, 'New connected mountain cells animate individually');
        await page.keyboard.press('Space');
        await page.waitForTimeout(800);
        const next = await state(page);
        assert.equal(next.started, first.started, 'Camera switch preserves discovery clock');
        assert.equal(next.id, first.id, 'Camera switch retains the same filter');
        assert.ok(next.etch > .9, 'Etching finishes before the fill');
        assert.ok(next.fill > first.fill && next.fill < 1, 'Fill advances slowly');
        assert.ok(await page.locator('[data-biome-edge="woods-danger"] [data-discovery-art="woods-danger"]').count() > 0);
        assert.ok(await page.locator('[data-biome-popup="woods-danger"] [data-discovery-art="woods-danger"]').count() > 0);
        await page.screenshot({ path: `${output}/${style}-immersive-etch.png` });
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${output}/${style}-immersive-fill.png` });
        await page.keyboard.press('Space');
        await page.waitForTimeout(700);
        // Pixel volumes and screenshot capture can outlast the cosmetic
        // animation; early continuity was checked while both filters existed.
        if (await filter(page).count()) assert.equal((await state(page)).started, first.started);
        await page.screenshot({ path: `${output}/${style}-ott-fill.png` });
        await finish(page);
        await page.screenshot({ path: `${output}/${style}-ott-finished.png` });
        await page.keyboard.press('Space');
        await page.waitForTimeout(800);
        assert.equal(await page.locator('filter[data-discovery-tile]').count(), 0, 'Known tiles never replay');
        await page.screenshot({ path: `${output}/${style}-immersive-finished.png` });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${style}, ${touch ? 'touch' : 'mouse'}, ${reduced ? 'reduced motion' : 'etch/fill in both views with clock continuity and cleanup'}`);
      await page.close();
    }
    // Discover while already immersed, then change art style and the motion
    // preference during the live effect. These must not create a second clock.
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL);
    await page.locator('[data-cell-grip="actor-hero"]').waitFor();
    await page.getByLabel('Follow traveling actor', { exact: true }).uncheck();
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    await travel(page, false);
    await filter(page).waitFor({ state: 'attached' });
    const first = await state(page);
    assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'immersive');
    await page.getByRole('button', { name: 'Game settings', exact: true }).click();
    await page.getByLabel('Art style', { exact: true }).selectOption('pixel');
    assert.equal((await state(page)).started, first.started, 'Art switching preserves discovery clock');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await finish(page);
    assert.equal(await page.locator('[data-biome-id="woods-danger"]').getAttribute('data-unexplored'), null);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('filter[data-discovery-tile]').count(), 0, 'Re-enabling motion never replays discovery');
    assert.deepEqual(errors, []);
    console.log('PASS discovery starting in immersion, live art switch, and live reduced-motion cleanup');
    await page.close();
  } catch (error) {
    for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
