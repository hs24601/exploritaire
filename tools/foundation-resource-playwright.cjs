const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('artifacts/foundation-resources', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) for (const touch of [false, true]) for (const scene of ['wood', 'rest', 'combat']) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: touch, reducedMotion: touch ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html?atmosphere=off' + (scene === 'combat' ? '&combatdemo' : ''));
      await page.waitForSelector('.proto-game-root');
      if (scene !== 'combat') await page.evaluate(async scene => {
        const { arriveActorAtBiome } = await import('/src/proto/biomeArrival.ts');
        const root = document.querySelector('.proto-game-root');
        let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
        while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
        fiber.memoizedState.queue.dispatch(state => {
          const id = scene === 'rest' ? 'hero-den' : 'day-one-tree', tile = state.biomeTiles.find(t => t.id === id);
          const next = arriveActorAtBiome(scene === 'rest' ? { ...state, inspiration: 0, ordinaryDay: { ...state.ordinaryDay, supper: true, bedtime: true } } : state, 'hero', id, tile.position);
          if (scene === 'rest') {
            const column = next.tableau.find(c => c.length), rank = column[column.length - 1].rank;
            return { ...next, foundations: next.foundations.map(slot => slot ? { ...slot, card: { ...slot.card, rank: rank % 13 + 1 } } : slot), denRest: { ...next.denRest, receivingCard: { ...next.denRest.receivingCard, rank: rank % 13 + 1 } } };
          }
          return next;
        });
      }, scene);
      const cards = scene === 'combat' ? '.battle-field__column' : '.proto-tableau-stage';
      const card = page.locator(`${cards} .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])`).first();
      await card.waitFor();
      assert.equal(await page.locator('[data-resource-receipt]').count(), 0, 'No startup receipt');
      if (touch) { const b = await card.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else await card.click();
      // The battle opening card targets Mochi automatically; ordinary scenes target Hero.
      const receipt = page.locator('[data-resource-receipt]').first(); await receipt.waitFor();
      const actorId = await receipt.evaluate(e => e.parentElement.dataset.actorHolocard);
      const owner = page.locator(`[data-actor-holocard="${actorId}"]`);
      assert.equal(await receipt.evaluate(e => getComputedStyle(e).pointerEvents), 'none');
      assert.equal(await receipt.locator('.food-collection-fx__berry').count(), 0);
      if (scene === 'rest') assert.equal(await receipt.locator('.food-collection-fx__mana').innerText(), '💫');
      const defects = await findLayoutDefects(page, '.actor-holocard:has([data-resource-receipt])', { parts: '.food-collection-fx' });
      assert.deepEqual(defects, []);
      await page.waitForTimeout(touch ? 80 : 350);
      const b = await owner.boundingBox();
      await page.screenshot({ path: `artifacts/foundation-resources/${width}-${touch ? 'touch' : 'mouse'}-${scene}-3x.png`, clip: b });
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('[data-resource-receipt]').count(), 0, 'Receipt cleans up');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${touch ? 'touch/reduced' : 'mouse'} ${scene} receipt, layout, cleanup`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
