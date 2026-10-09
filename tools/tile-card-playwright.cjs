const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
const card = (page, id) => page.locator(`.details-card-viewer[data-inspection-id="${id}"]`);
const center = async locator => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function pair(page, width, height) {
  await card(page, 'hero-den').waitFor();
  await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('.details-card-viewer').evaluateAll(els => els.map(el => el.dataset.inspectionId)), ['hero', 'hero-den']);
  const a = await card(page, 'hero').boundingBox(), t = await card(page, 'hero-den').boundingBox();
  assert.ok(t.x >= a.x + a.width + 20, 'Tile card sits to the right without overlap');
  assert.ok(Math.abs(t.y - a.y) < 1, 'Cards share a row');
  for (const id of ['hero', 'hero-den']) {
    const box = await card(page, id).boundingBox();
    assert.ok(Math.abs(box.width / box.height - 63 / 88) < .001, 'Playing-card proportions');
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, 'Card fits viewport');
    assert.deepEqual(await findLayoutDefects(page, `[data-inspection-id="${id}"] .trading-card`, {
      parts: '.trading-card__header, .trading-card__body, .trading-card__description, .trading-card__sections, .trading-card__section, .trading-card__footer',
    }), []);
  }
  assert.equal(await page.locator('.biome-closed-note').count(), 0, 'No parchment tile popup');
}
(async () => {
  fs.mkdirSync('artifacts/tile-cards', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) for (const tilted of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      if (tilted) { await page.keyboard.press('Space'); await page.waitForTimeout(650); }
      const den = page.locator('button[data-biome-id="hero-den"]');
      // The square's actor grab owns pointer input; a stationary press inspects both objects.
      let point = await center(page.locator('[data-cell-grip="actor-hero"]'));
      await page.mouse.click(point.x, point.y);
      await pair(page, width, height);
      await page.mouse.move(1, 1);
      await page.screenshot({ path: `artifacts/tile-cards/${width}-${tilted ? 'immersion' : 'ott'}-pair-3x.png` });
      // Clicking either card enlarges only that card and returns to the same pair.
      await card(page, 'hero-den').locator('.trading-card__art').click();
      await page.locator('[data-object-id="hero-den"][data-card-state="jumbo"]').waitFor();
      assert.equal(await page.locator('.details-card-viewer').count(), 1);
      assert.match(await page.locator('.trading-card__full-description').innerText(), /Den tile at table:0,2/);
      assert.ok(await page.locator('#root').evaluate(el => el.inert));
      await page.getByRole('button', { name: 'Close jumbo card' }).click();
      await pair(page, width, height);
      assert.equal(await page.locator('#root').evaluate(el => el.inert), false);
      await card(page, 'hero-den').getByRole('button', { name: 'Close details card' }).click();
      assert.equal(await card(page, 'hero').count(), 1, 'Closing tile keeps actor');
      assert.equal(await card(page, 'hero-den').count(), 0);
      await page.keyboard.press('Escape');
      // Keyboard activation of the tile also includes its occupant.
      await den.focus(); await page.keyboard.press('Enter');
      await pair(page, width, height);
      await card(page, 'hero').getByRole('button', { name: 'Close details card' }).tap();
      assert.equal(await card(page, 'hero').count(), 0);
      assert.equal(await card(page, 'hero-den').count(), 1, 'Closing actor keeps tile');
      await page.keyboard.press('Escape');
      point = await center(page.locator('[data-cell-grip="actor-hero"]'));
      await page.touchscreen.tap(point.x, point.y);
      await pair(page, width, height);
      await card(page, 'hero-den').locator('.trading-card__art').tap();
      await page.locator('[data-object-id="hero-den"][data-card-state="jumbo"]').waitFor();
      await page.keyboard.press('Escape');
      await pair(page, width, height);
      await page.keyboard.press('Escape');
      // Impassable terrain is inspectable as a tile card, with no exploration action.
      const mountain = page.locator('button[data-tile-type="impassable-mountain"]').first();
      const mountainId = await mountain.getAttribute('data-biome-id');
      await mountain.focus(); await page.keyboard.press('Enter');
      await card(page, mountainId).waitFor();
      assert.equal(await page.locator('.details-card-viewer').count(), 1);
      assert.match(await card(page, mountainId).locator('.trading-card__description').getAttribute('aria-label'), /Impassable mountain/);
      assert.equal(await card(page, mountainId).locator('.tile-card-action').count(), 0);
      assert.deepEqual(await findLayoutDefects(page, `[data-inspection-id="${mountainId}"] .trading-card`, {
        parts: '.trading-card__header, .trading-card__body, .trading-card__description, .trading-card__sections, .trading-card__section',
      }), []);
      await card(page, mountainId).screenshot({ path: `artifacts/tile-cards/${width}-${tilted ? 'immersion' : 'ott'}-mountain-3x.png` });
      await page.keyboard.press('Escape');
      // Unknown squares still open nothing.
      const unknown = page.locator('[data-unexplored="true"]').first();
      await unknown.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.details-card-viewer').count(), 0);
      // Camera/object drags retain their input ownership and do not inspect.
      point = await center(page.locator('[data-cell-grip="actor-hero"]'));
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x + 18, point.y, { steps: 4 });
      await page.locator('[data-cell-grip="actor-hero"]').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
      await page.mouse.up();
      assert.equal(await page.locator('.details-card-viewer').count(), 0, 'Cancelled actor drag opens no card');
      // The existing tableau action lives on the tile card, separate from inspection.
      await den.focus(); await page.keyboard.press('Enter');
      const action = card(page, 'hero-den').getByRole('button', { name: 'Open tableau' });
      if (tilted) await action.tap();
      else if (width === 1280) await action.click();
      else { await action.focus(); await page.keyboard.press('Enter'); }
      await page.waitForFunction(() => document.querySelector('[data-biome-id="hero-den"]')?.dataset.selected === 'true');
      assert.equal(await page.locator('.details-card-viewer').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${width}x${height} ${tilted ? 'immersion' : 'OTT'}: paired order, ratio, layout, mouse/touch/keyboard, independent close, jumbo, fog, drag and tableau action passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
