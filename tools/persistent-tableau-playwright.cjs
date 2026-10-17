const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('artifacts/persistent-tableau', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: 3 });
      await page.goto('http://localhost:5178/proto.html?atmosphere=off');
      await page.locator('.proto-map').waitFor();
      const mapBefore = await page.locator('.proto-map').boundingBox();
      assert.ok(await page.locator('.proto-tableau-field').isHidden());
      const playArea = await page.locator('.proto-main-layout').boundingBox();
      assert.ok(Math.abs(mapBefore.width - playArea.width) < 1, 'empty map fills the play area');
      await page.evaluate(() => {
        const root = document.querySelector('.proto-game-root');
        let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
        while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
        fiber.memoizedState.queue.dispatch(state => {
          const tile = state.biomeTiles.find(t => t.id === 'day-one-berries');
          return { ...state, selectedBiomeId: tile.id, tableau: tile.tableau, stock: tile.stock,
            foundations: [{ card: { id: 'layout-foundation', rank: 5, suit: 'hearts' }, cards: [], count: 0 }],
            worldActors: state.worldActors.map(a => ({ ...a, location: 'foundation', biomeId: tile.id, foundationIndex: 0, position: tile.position })) };
        });
      });
      await page.getByRole('button', { name: 'Exit tableau · Hero', exact: true }).waitFor();
      assert.ok(await page.locator('.proto-map').isVisible());
      assert.equal(await page.locator('.proto-world-minimap').count(), 0);
      const mapAfter = await page.locator('.proto-map').boundingBox();
      assert.ok(mapAfter.width < mapBefore.width, 'arrival reduces map width');
      const field = await page.locator('.proto-tableau-field').boundingBox();
      assert.ok(Math.abs(mapAfter.width / field.width - 1.7) < 0.02, 'map takes larger share');
      assert.ok(field.x + field.width <= mapAfter.x, 'tableau is left of map without overlap');
      assert.deepEqual(await findLayoutDefects(page, '.proto-main-layout', { parts: ':scope > .proto-tableau-field', minFontSize: 0 }), []);
      assert.deepEqual(await findLayoutDefects(page, '.proto-tableau-field', { parts: '.proto-main-tableau,.proto-main-foundations', minFontSize: 0 }), []);
      await page.screenshot({ path: `artifacts/persistent-tableau/${width}-${touch ? 'touch' : 'mouse'}-3x.png` });
      const exit = page.getByRole('button', { name: 'Exit tableau · Hero', exact: true });
      if (touch) await exit.tap(); else await exit.click();
      assert.ok(await page.locator('.proto-map').isVisible());
      assert.ok(await page.locator('.proto-tableau-field').isVisible());
      const mapExit = await page.locator('.proto-map').boundingBox();
      assert.ok(Math.abs(mapExit.width - mapAfter.width) < 1, 'selected unstaffed deal retains the split');
      await page.goto('http://localhost:5178/proto.html?combatdemo&atmosphere=off');
      await page.locator('.combat-demo .proto-world-minimap').waitFor();
      const combat = await page.locator('.combat-demo').boundingBox();
      const battle = await page.locator('.proto-tableau-field').boundingBox();
      const minimap = await page.locator('.proto-world-minimap').boundingBox();
      assert.ok(battle.x + battle.width <= combat.x, 'combat tableau left');
      assert.ok(Math.abs(combat.width / battle.width - 1.7) < 0.02, 'combat scene larger');
      assert.ok(minimap.x >= combat.x && minimap.x + minimap.width <= combat.x + combat.width && minimap.y >= combat.y, 'minimap overlays combat');
      await page.getByRole('button', {name:'Zoom in minimap',exact:true}).click();
      await page.getByRole('img', {name:/Overhead map.*2× zoom/}).waitFor();
      await page.screenshot({path: `artifacts/persistent-tableau/combat-${width}-${touch ? 'touch' : 'mouse'}.png`});
      await page.getByRole('button', {name:'View map',exact:true}).click();
      assert.equal(await page.locator('.combat-demo').count(), 0);
      await page.close();
    }
    console.log('Persistent map/tableau layout passed at 1280 and 1912, mouse and touch.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
