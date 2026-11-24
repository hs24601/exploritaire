const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const saved = JSON.parse(fs.readFileSync('src/data/protoTiles.json', 'utf8'));
const patch = saved.tiles.find(tile => tile.berryPatchVariant === 'sparse');
let browser, page;
(async () => {
  browser = await chromium.launch({ headless: true });
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true], [844, 390, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html');
    const marker = page.locator('[data-day-objective]'), button = marker.locator('.day-objective__title'), locate = marker.getByRole('button', { name: 'Center map on quest target' });
    const press = async locator => touch ? locator.tap() : locator.click();
    await button.waitFor({ state: 'visible' });
    assert.equal(await marker.getAttribute('data-day-objective'), patch.id);
    assert.equal(await button.getAttribute('data-grid-reference'), `table:${patch.column},${patch.row}`);
    const ids = await page.locator('[data-biome-id]').evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.biomeId))].sort());
    assert.deepEqual(ids, saved.tiles.map(tile => tile.id).sort());
    await press(button);
    await press(locate);
    await page.waitForTimeout(350);
    assert.equal(await marker.getAttribute('data-offscreen'), 'false');
    // Focus affects only the camera, never travel or the actor's grid position.
    assert.equal(await page.locator('[data-route-line]').count(), 0);
    const actorBefore = await page.locator('[data-board-piece="actor"][data-actor-id="hero"]').getAttribute('data-grid-reference');
    const geometry = await marker.evaluate(element => {
      const box = element.querySelector('.day-objective__tracker').getBoundingClientRect();
      const view = element.getBoundingClientRect();
      const controls = element.closest('.proto-map').querySelector('.proto-travel-controls').getBoundingClientRect();
      const circle = element.querySelector('circle');
      const pinX = view.left + Number(circle.getAttribute('cx')), pinY = view.top + Number(circle.getAttribute('cy'));
      return { contained: box.left >= view.left && box.right <= view.right && box.top >= view.top && box.bottom <= view.bottom, clear: box.top >= controls.bottom,
        pinClear: pinX < box.left || pinX > box.right || pinY < box.top || pinY > box.bottom, height: box.height };
    });
    assert.ok(geometry.contained && geometry.clear && geometry.pinClear && geometry.height >= 44, JSON.stringify(geometry));
    // Move the camera far enough to exercise the pinned edge arrow, then use keyboard to find the target again.
    const viewport = await page.locator('.proto-map-viewport').boundingBox();
    await page.mouse.move(viewport.x + viewport.width - 20, viewport.y + viewport.height / 2);
    await page.mouse.wheel(0, -1800); await page.waitForTimeout(500);
    await page.mouse.move(viewport.x + viewport.width - 25, viewport.y + viewport.height / 2);
    await page.mouse.down(); await page.mouse.move(viewport.x + 20, viewport.y + viewport.height / 2, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(500);
    assert.equal(await marker.getAttribute('data-offscreen'), 'true');
    await locate.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    assert.equal(await marker.getAttribute('data-offscreen'), 'false');
    assert.equal(await page.locator('[data-board-piece="actor"][data-actor-id="hero"]').getAttribute('data-grid-reference'), actorBefore);
    await page.screenshot({ path: `artifacts/day-objective-${width}.png` });
    if (!touch && !process.argv.includes('--layout-only')) {
      const travel = async name => {
        await page.getByRole('button', { name, exact: true }).click();
        await page.getByRole('button', { name: 'Auto-Solve', exact: true }).first().click();
        await page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first().waitFor({ timeout: 45000 });
      };
      const forage = async count => {
        for (let i = 0; i < count; i++) {
          await page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first().click();
          await page.waitForTimeout(650);
        }
      };
      await page.getByRole('button', { name: 'Visit nearby bush', exact: true }).click();
      await page.getByRole('button', { name: 'Auto-Solve', exact: true }).first().click();
      await page.waitForFunction(()=>[...document.querySelectorAll('.proto-day-panel button')].some(button=>button.textContent==='Visit denser patch'&&!button.disabled));
      await travel('Visit denser patch'); await forage(6);
      assert.equal(await marker.getAttribute('data-day-objective'), 'hero-den');
      assert.match(await button.innerText(), /Home before dark/);
      await page.getByLabel('Day scenario', { exact: true }).selectOption('day02');
      await travel('Visit manaberry patch'); await forage(3);
      const woodsId = await marker.getAttribute('data-day-objective');
      const woods = saved.tiles.find(tile => tile.id === woodsId);
      assert.equal(woods.kind, 'woods');
      assert.equal(await button.getAttribute('data-grid-reference'), `table:${woods.column},${woods.row}`);
      assert.match(await button.innerText(), /Search the darker woods/);
      console.log('PASS objective changes during real Day 01 and Day 02 forage');
    }
    for (const [day, label] of [['day02', 'Gather manaberries'], ['day03', 'Home with Banks']]) {
      await page.getByLabel('Day scenario', { exact: true }).selectOption(day);
      await page.getByRole('button', { name: new RegExp('Show objective: ' + label) }).waitFor({ state: 'visible' });
    }
    await page.getByLabel('Day scenario', { exact: true }).selectOption('sandbox');
    assert.equal(await marker.count(), 0);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
    console.log('PASS daily objective camera, coordinates, edge arrow, keyboard, touch, scenario switching', width, height);
    await context.close();
  }
  await browser.close();
})().catch(async error => {
  console.error(error);
  if (page && !page.isClosed()) await page.screenshot({ path: 'artifacts/day-objective-failure.png' });
  await browser?.close(); process.exit(1);
});
