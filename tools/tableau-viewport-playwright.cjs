const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/tableau-viewport';
fs.mkdirSync(out, { recursive: true });
const url = process.env.PROTO_URL || 'http://localhost:5178/proto.html?atmosphere=off';
async function center(el) { const b = await el.boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function press(page, el, touch) { if (touch) { const p = await center(el); await page.touchscreen.tap(p.x, p.y); } else await el.click(); }
async function drag(page, from, to, touch) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 12; i++) { const p = { x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 };
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); else await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(20);
  }
  if (cdp) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); } else await page.mouse.up();
}
// Use the live component's state only for roster/finished-deal scenarios; travel
// and all player inputs below use the public game UI.
async function updateState(page, action) {
  await page.evaluate(action => {
    const root = document.querySelector('.proto-game-root');
    let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
    while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
    if (!fiber) throw Error('ProtoVariant fiber not found');
    fiber.memoizedState.queue.dispatch(state => {
      if (action === 'clear') return { ...state, tableau: state.tableau.map(() => []), stock: [] };
      if (action === 'second') return { ...state, foundations: [...state.foundations, { ...state.foundations[0], cards: [], count: 0 }], worldActors: [...state.worldActors, { ...state.worldActors[0], id: 'mochi', label: 'Mochi', foundationIndex: 1 }] };
      if (action === 'rest') {
        const den = state.biomeTiles.find(t => t.id === 'hero-den');
        return { ...state, selectedBiomeId: den.id, tableau: den.tableau, stock: den.stock, ordinaryDay: { ...state.ordinaryDay, supper: true, bedtime: true },
          foundations: [{ card: state.denRest.receivingCard, cards: [], count: 0 }], worldActors: [{ ...state.worldActors[0], location: 'foundation', biomeId: den.id, position: den.position }] };
      }
      return state;
    });
  }, action);
  await page.waitForTimeout(400);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: 3, reducedMotion: touch ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(url); await page.waitForTimeout(1200);
      const layout = page.locator('.proto-main-layout');
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'map');
      await page.keyboard.press('Escape'); await press(page, page.getByRole('button', { name: 'Reset View', exact: true }), touch);
      await page.getByRole('slider', { name: 'Travel speed', exact: true }).fill('500');
      await page.getByLabel('Follow traveling actor', { exact: true }).uncheck();
      await page.waitForTimeout(700);
      await drag(page, await center(page.locator('[data-cell-grip="actor-hero"]')), await center(page.locator('[data-biome-id="day-one-berries"]')), touch);
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'map', 'map stays primary during travel');
      await page.waitForFunction(() => document.querySelector('.proto-main-layout').dataset.primaryViewport === 'tableau', null, { timeout: 18000 });
      await page.waitForTimeout(800);
      const field = await page.locator('.proto-tableau-field').boundingBox(); const bounds = await layout.boundingBox();
      assert.ok(Math.abs(field.x + field.width / 2 - bounds.x - bounds.width / 2) < 2, 'tableau centered');
      assert.ok(Math.abs(field.width - bounds.width) < 2, 'tableau fills the play viewport');
      const mini = await page.locator('.proto-tableau-field > .proto-world-minimap').boundingBox();
      assert.ok(mini && Math.abs(mini.x + mini.width - field.x - field.width + 8) < 2 && Math.abs(mini.y - field.y - 8) < 2, 'minimap inside upper right corner');
      assert.ok(await page.locator('.proto-world-minimap').isVisible());
      const minimap = page.locator('.proto-world-minimap');
      assert.equal(await minimap.getByText('Map', { exact: true }).count(), 0);
      assert.ok(await minimap.locator('.proto-world-minimap__coordinates text').count() > 0);
      const overview = await minimap.locator('svg').getAttribute('viewBox');
      await press(page, minimap.getByRole('button', { name: 'Zoom in minimap' }), touch);
      assert.notEqual(await minimap.locator('svg').getAttribute('viewBox'), overview);
      await press(page, minimap.getByRole('button', { name: 'Zoom out minimap' }), touch);
      assert.equal(await minimap.locator('svg').getAttribute('viewBox'), overview);
      assert.ok(await minimap.getByRole('button', { name: 'Zoom out minimap' }).isDisabled());
      assert.equal(await page.locator('.proto-map').isVisible(), false);
      const mode = await page.locator('.proto-map').getAttribute('data-camera-view');
      const cards = await page.locator('.proto-main-tableau .playing-card').count();
      assert.ok(cards > 0);
      await page.waitForSelector('.proto-tableau-landscape[data-ready="true"] canvas');
      assert.equal(await page.locator('.proto-tableau-landscape').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.deepEqual(await findLayoutDefects(page, '.proto-world-minimap', { parts: '.proto-world-minimap__header,svg,button' }), []);
      assert.deepEqual(await findLayoutDefects(page, '.proto-tableau-field', { parts: '.proto-main-tableau,.proto-main-foundations', minFontSize: 0 }), [], 'tableau surfaces fit without overlap');
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-arrival-3x.png` });
      await press(page, page.getByRole('button', { name: 'View map', exact: true }), touch);
      assert.ok(await page.locator('.proto-map').isVisible());
      await press(page, page.getByRole('button', { name: 'Return to tableau', exact: true }), touch);
      await page.waitForTimeout(700);
      assert.equal(await page.locator('.proto-main-tableau .playing-card').count(), cards, 'map access preserves deal');
      const playable = page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
      await press(page, playable, touch);
      await page.waitForFunction(count => document.querySelectorAll('.proto-main-tableau .playing-card').length < count, cards, { timeout: 4000 });
      assert.ok(await page.locator('.proto-main-tableau .playing-card').count() < cards, 'tableau still plays');
      await updateState(page, 'clear');
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'tableau', 'clear deal remains focused while staffed');
      await updateState(page, 'second');
      await press(page, page.getByRole('button', { name: 'Exit tableau · Hero', exact: true }), touch);
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'tableau', 'another occupant retains focus');
      await press(page, page.getByRole('button', { name: 'Exit tableau · Mochi', exact: true }), touch);
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'map', 'last departure restores map');
      assert.ok(await page.locator('.proto-map').isVisible());
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), mode, 'immersion preserved');
      await updateState(page, 'rest');
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'tableau');
      assert.equal(await page.locator('.proto-rest-status').count(), 1);
      await page.waitForSelector('.proto-tableau-landscape[data-ready="true"] canvas');
      assert.deepEqual(await findLayoutDefects(page, '.proto-rest-status', { parts: 'span,button' }), [], 'rest controls fit');
      await page.screenshot({ path: `${out}/${width}-${touch ? 'touch' : 'mouse'}-rest-3x.png` });
      await press(page, page.getByRole('button', { name: 'Finish resting', exact: true }).filter({ visible: true }), touch);
      assert.equal(await layout.getAttribute('data-primary-viewport'), 'map', 'closing rest restores map');
      assert.deepEqual(errors, []);
      console.log('PASS', width, touch ? 'touch/reduced' : 'mouse/motion', 'arrival, play, map access, multi-actor exit, cleared deal, rest close');
      await page.close();
    }
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3 });
      await page.goto(url + '&combatdemo'); await page.waitForTimeout(4500);
      assert.equal(await page.locator('.proto-main-layout').getAttribute('data-primary-viewport'), 'tableau');
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts: '.combat-demo__header,.combat-demo__footer' }), []);
      await page.screenshot({ path: `${out}/${width}-combat-3x.png` });
      await page.locator('.combat-demo__tools > summary').click();
      await page.getByRole('button', { name: 'Escape', exact: true }).click();
      assert.equal(await page.locator('.proto-main-layout').getAttribute('data-primary-viewport'), 'map');
      console.log('PASS', width, 'combat viewport and exit'); await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
