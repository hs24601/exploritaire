const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/berry-tableau-framing';
const url = process.env.PROTO_URL || 'http://localhost:5178/proto.html?atmosphere=off';

async function openBerry(page) {
  await page.goto(url);
  await page.waitForSelector('.proto-game-root');
  // Scene setup only: all plays below use the actual public UI.
  await page.evaluate(() => {
    const root = document.querySelector('.proto-game-root');
    let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
    while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
    fiber.memoizedState.queue.dispatch(state => {
      const tile = state.biomeTiles.find(t => t.id === 'day-one-berries');
      return { ...state, selectedBiomeId: tile.id, tableau: tile.tableau, stock: tile.stock,
        foundations: [{ card: { id: 'berry-receiving', rank: 2 }, cards: [], count: 0 }],
        biomeTiles: state.biomeTiles.map(t => t.id === tile.id ? { ...t, flags: [] } : t),
        worldActors: state.worldActors.map((a, i) => i ? a : { ...a, location: 'foundation', biomeId: tile.id, foundationIndex: 0, position: tile.position }) };
    });
  });
  await page.waitForSelector('.proto-tableau-landscape[data-ready="true"] canvas');
  await page.waitForTimeout(900);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const style of ['paint', 'pixel']) {
      const touch = style === 'pixel';
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: 3, reducedMotion: touch ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(style => localStorage.setItem('exploritaire.artStyle', style), style);
      await openBerry(page);
      const field = page.locator('.proto-tableau-field');
      const canvas = page.locator('.proto-tableau-landscape canvas');
      const beforeSway = await canvas.screenshot();
      await page.waitForTimeout(450);
      const afterSway = await canvas.screenshot();
      assert.equal(beforeSway.equals(afterSway), touch, 'independent vegetation moves unless reduced motion is selected');
      await field.screenshot({ path: `${out}/${width}-${style}${process.env.BASELINE ? '-before' : ''}-3x.png` });
      assert.equal(await page.locator('.proto-tableau-landscape').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.deepEqual(await findLayoutDefects(page, '.proto-tableau-field', { parts: '.proto-main-tableau,.proto-main-foundations', minFontSize: 0 }), []);
      assert.deepEqual(await findLayoutDefects(page, '.proto-tableau-heading', { parts: 'button,label' }), []);
      if (!process.env.BASELINE) {
        assert.deepEqual(await findLayoutDefects(page, '.proto-tableau-scene', { parts: '.proto-tableau-card-area,.proto-tableau-card-area > div', minFontSize: 0 }), []);
        const band = await page.locator('.proto-tableau-scene').evaluate(el => el.querySelector('.proto-tableau-card-area').getBoundingClientRect().top - el.getBoundingClientRect().top);
        assert.ok(band >= 48, 'bush crowns have an exposed scenery band');
        const playable = page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
        const face = await playable.boundingBox();
        assert.ok(Math.abs(face.width / face.height - 63 / 88) < .02, 'portrait geometry retained');
        if (touch) { const b = await playable.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
        else await playable.click();
        await page.waitForSelector('.proto-foundation-count-token[aria-label="1 cards collected"]');
      }
      assert.deepEqual(errors, []);
      console.log('PASS', width, style, touch ? 'touch/reduced motion' : 'mouse', 'scenery band, layout, portrait cards, play');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
