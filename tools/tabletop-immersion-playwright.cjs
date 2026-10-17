const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
const OUT = 'artifacts/tabletop-immersion';
fs.mkdirSync(OUT, { recursive: true });
const centre = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const camera = page => page.locator('.proto-map-viewport').evaluate(el => {
  const s = getComputedStyle(el);
  return ['--camera-x', '--camera-y', '--camera-scale'].map(key => parseFloat(s.getPropertyValue(key)));
});
async function flatChecks(page) {
  await page.locator('.proto-map[data-camera-view="tabletop"]').waitFor();
  const map = page.locator('.proto-map');
  assert.equal(await map.locator('[data-biome-popup], [data-biome-edge], .proto-sprite-topdown__board, .proto-sprite-shadow, .proto-standee-base, [data-atmosphere], .proto-table-light canvas').count(), 0, 'tabletop contains no pop-ups, prop shadows or atmosphere');
  assert.equal(await map.locator('[data-biome-topdown]').count(), 4);
  assert.ok(await map.locator('.proto-biome-topdown__art').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), 'all overhead sprites load');
  assert.ok(await map.locator('[data-unexplored] .proto-reveal__shade').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).filter === 'none' && node.querySelector('img.proto-biome-topdown__art--unexplored'))), 'unexplored overhead sprites retain their terrain detail rather than becoming opaque rectangles');
  assert.ok(await map.locator('[data-board-piece]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).boxShadow === 'none')), 'table pieces cast no shadows');
  for (const id of ['pond', 'woods-alpha', 'woods-east', 'woods-danger']) {
    assert.deepEqual(await findLayoutDefects(page, `button[data-biome-id="${id}"]`, { parts: '.board-object-label' }), [], `${id} label layout`);
  }
}
async function drag(page, from, to, touch) {
  const before = await camera(page);
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
  if (cdp) await send('touchStart', from);
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 14; i++) {
    const p = { x: from.x + (to.x - from.x) * i / 14, y: from.y + (to.y - from.y) * i / 14 };
    if (cdp) await send('touchMove', p); else await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(16);
  }
  assert.deepEqual(await camera(page), before, 'actor drag never moves the camera');
  if (await page.locator('.proto-map[data-camera-view="tabletop"]').count()) {
    assert.equal(await page.locator('[data-actor-drag-preview]').evaluate(el => getComputedStyle(el).boxShadow), 'none', 'held tabletop actor casts no shadow');
  }
  if (cdp) { await send('touchEnd', to); await cdp.detach(); } else await page.mouse.up();
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: width === 1280 ? 'reduce' : 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      await page.locator('.proto-biome-topdown__art').first().waitFor();
      await page.waitForTimeout(600);
      await flatChecks(page);
      await page.screenshot({ path: `${OUT}/${width}-tabletop.png` });
      const woodsBox = await page.locator('button[data-biome-id="woods-alpha"]').boundingBox();
      await page.screenshot({ path: `${OUT}/${width}-tiles-3x.png`, clip: { x: woodsBox.x - woodsBox.width - 2, y: woodsBox.y - 2, width: woodsBox.width * 3 + 4, height: woodsBox.height + 4 } });
      // Clicking an unexplored sprite remains a closed note, never an encounter.
      await page.locator('button[data-biome-id="woods-alpha"]').click();
      await page.locator('.biome-closed-note').waitFor();
      await flatChecks(page);
      await page.keyboard.press('Escape');
      // Mouse movement on open ground keeps the static table framing.
      const initialRef = await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');
      const grip = centre(await page.locator('[data-cell-grip="actor-hero"]').boundingBox());
      await drag(page, grip, { x: grip.x + 82, y: grip.y }, false);
      await page.waitForFunction(ref => document.querySelector('[data-board-piece="actor"]').dataset.gridReference !== ref, initialRef);
      await flatChecks(page);
      // A touch visit enters the world only after travel finishes.
      await page.reload();
      await page.locator('[data-board-piece="actor"]').waitFor();
      await page.waitForTimeout(300);
      const tabletop = await camera(page);
      await drag(page, centre(await page.locator('[data-cell-grip="actor-hero"]').boundingBox()), centre(await page.locator('button[data-biome-id="woods-alpha"]').boundingBox()), true);
      await page.waitForFunction(() => document.querySelector('.proto-map').dataset.cameraView === 'immersive', null, { timeout: 15000 });
      await page.waitForTimeout(1300);
      const zoomed = await camera(page);
      assert.ok(zoomed[2] >= 3.09, 'engagement zooms in');
      assert.ok(await page.locator('[data-biome-popup], [data-biome-edge]').count(), 'immersive scenery returns');
      assert.ok(await page.locator('.proto-map [data-atmosphere]').count(), 'immersive atmosphere returns');
      assert.equal(await page.locator('[data-biome-topdown]').count(), 0, 'printed art is exclusive to top-down');
      assert.equal(await page.locator('button[data-biome-id="woods-alpha"]').getAttribute('data-unexplored'), null);
      await page.screenshot({ path: `${OUT}/${width}-engaged.png` });
      // Manual override holds while the encounter remains staffed.
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(1100);
      await flatChecks(page);
      assert.deepEqual(await camera(page), tabletop, 'manual flat restores tabletop camera');
      await page.screenshot({ path: `${OUT}/${width}-revealed-tiles.png` });
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /^Exit tableau/ }).first().click();
      await page.waitForTimeout(1700);
      await flatChecks(page);
      assert.deepEqual(await camera(page), tabletop, 'leaving restores prior tabletop framing');
      await drag(page, centre(await page.locator('[data-cell-grip="actor-hero"]').boundingBox()), centre(await page.locator('button[data-biome-id="pond"]').boundingBox()), false);
      await page.waitForFunction(() => document.querySelector('button[data-biome-id="pond"]').dataset.explored === '1.00', null, { timeout: 15000 });
      await page.waitForTimeout(1100);
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      await flatChecks(page);
      assert.equal(await page.locator('button[data-biome-id="pond"] .board-object-label__text').textContent(), 'Pond', 'pond keeps its explored name top-down');
      await page.screenshot({ path: `${OUT}/${width}-pond-revealed.png` });
      // Night and high FX never add effects to the tabletop.
      const time = page.locator('input[type="range"]').first();
      if (await time.count()) await time.fill('23');
      await page.waitForTimeout(300);
      await flatChecks(page);
      assert.deepEqual(errors, [], 'no browser errors');
      await page.close();
    }
    console.log('Tabletop sprites, no props/shadows/FX, label layout, mouse/touch movement, encounter zoom, manual override, and return framing pass at 1912 and 1280 desktop widths.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
