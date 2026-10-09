const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const tile = (page, id) => page.locator(`button[data-biome-id="${id}"]`);
async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'The interaction target exists');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function flat(page) {
  if (await page.locator('[data-camera-view="immersive"]').count()) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(650);
  }
}
async function move(page, id, reference, touch) {
  await flat(page);
  const from = await center(page.locator('[data-cell-grip="actor-hero"]'));
  const to = await center(tile(page, id));
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, point) => cdp.send('Input.dispatchTouchEvent', { type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: point.x, y: point.y }] });
  if (touch) await send('touchStart', from);
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let step = 1; step <= 12; step++) {
    const point = { x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 };
    if (touch) await send('touchMove', point); else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(16);
  }
  if (touch) await send('touchEnd', to); else await page.mouse.up();
  await cdp?.detach();
  await page.waitForFunction(reference => document.querySelector('[data-board-piece="actor"]')?.dataset.gridReference === reference, reference);
  await page.waitForTimeout(650);
  if (touch) await page.getByRole('button', { name: 'Table', exact: true }).click();
}
async function fog(page) {
  // The custom tooltip temporarily parks the title on hovered/focused tiles.
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  const result = await page.locator('[data-unexplored="true"]').evaluateAll(elements => elements.map(el => ({
    title: el.title, label: el.getAttribute('aria-label'), type: el.dataset.tileType,
    terrain: el.dataset.terrain, art: el.querySelector('img, svg, .proto-tile-title'),
    explored: el.dataset.explored,
  })));
  assert.ok(result.length > 100);
  for (const unknown of result) {
    assert.equal(unknown.title, '');
    assert.equal(unknown.label, 'Unexplored biome');
    assert.equal(unknown.type, 'unexplored');
    assert.equal(unknown.terrain, undefined);
    assert.equal(unknown.art, null);
    assert.equal(unknown.explored, '0.00');
  }
  const leaks = await page.evaluate(() => [...document.querySelectorAll('[data-biome-popup], [data-biome-edge]')]
    .filter(el => document.querySelector(`button[data-biome-id="${el.dataset.biomePopup || el.dataset.biomeEdge}"]`)?.dataset.unexplored).length);
  assert.equal(leaks, 0, 'Unknown cells have no scenery');
  const ground = await page.locator('[data-unexplored-ground]').evaluate(el => getComputedStyle(el).filter);
  assert.match(ground, /grayscale\(1\).*brightness\(0\.45\)/);
}
(async () => {
  fs.mkdirSync('artifacts/tile-discovery', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, touch] of [[1280, 720, false], [1912, 914, false], [390, 844, true], [844, 390, true]]) {
      if (process.env.PROTO_WIDTH && width !== Number(process.env.PROTO_WIDTH)) continue;
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
      await page.goto(URL);
      if (touch) await page.getByRole('button', { name: 'Table', exact: true }).click();
      await page.locator('[data-cell-grip="actor-hero"]').waitFor();
      await fog(page);
      for (const id of ['unexplored--1-1', 'unexplored-0-1', 'road-east'])
        assert.equal(await tile(page, id).getAttribute('data-unexplored'), 'true', 'Nearby paths and roads remain anonymous');
      assert.equal(await page.locator('[data-road-shape]').count(), 0, 'Unvisited road prints stay hidden');
      assert.equal(await page.locator('[data-tile-type="impassable-mountain"]').count(), 5);
      assert.equal(await page.locator('[data-connected-terrain] image').count(), 5);
      for (let row = 4; row <= 7; row++) for (let column = -7; column <= 7; column++)
        assert.equal(await tile(page, `mountain-${column}-${row}`).getAttribute('data-unexplored'), 'true');
      // Unknown tiles stay silent for keyboard, mouse and touch activation.
      const unknown = tile(page, 'mountain--3-2');
      await unknown.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.biome-closed-note').count(), 0);
      if (touch) await unknown.tap(); else await unknown.click();
      assert.equal(await page.locator('.biome-closed-note').count(), 0);
      await page.screenshot({ path: `artifacts/tile-discovery/${width}-initial.png` });
      await page.keyboard.press('Space'); await page.waitForTimeout(650);
      await fog(page);
      assert.equal(await page.locator('[data-biome-popup^="mountain-"]').count(), 5);
      await page.screenshot({ path: `artifacts/tile-discovery/${width}-immersive.png` });
      // A path visit reveals a diagonal mountain without touching that cell.
      await move(page, 'unexplored--2-1', 'table:-2,1', touch);
      assert.equal(await unknown.getAttribute('data-unexplored'), null);
      assert.equal(await unknown.getAttribute('data-explored'), '1.00');
      assert.equal(await unknown.getAttribute('data-tile-type'), 'impassable-mountain');
      assert.equal(await tile(page, 'mountain--3-3').getAttribute('data-unexplored'), 'true');
      // Going north identifies woods and water without any solitaire play.
      await move(page, 'road-center', 'table:0,0', touch);
      assert.equal(await tile(page, 'road-center').getAttribute('data-unexplored'), null);
      assert.equal(await tile(page, 'road-center').locator('[data-road-shape]').count(), 1);
      assert.equal(await tile(page, 'road-east').getAttribute('data-unexplored'), 'true', 'Adjacent road remains hidden until entry');
      for (const id of ['woods-alpha', 'woods-east', 'pond']) {
        assert.equal(await tile(page, id).getAttribute('data-unexplored'), null);
        assert.equal(await tile(page, id).getAttribute('data-explored'), '1.00');
        assert.equal(await tile(page, id).getAttribute('data-selected'), null, 'Proximity does not activate a neighbour');
      }
      assert.equal(await unknown.getAttribute('data-unexplored'), null, 'Discovery persists after departure');
      await move(page, 'road-east', 'table:1,1', touch);
      assert.equal(await tile(page, 'road-east').getAttribute('data-unexplored'), null);
      assert.equal(await tile(page, 'road-east').locator('[data-road-shape]').count(), 1);
      assert.equal(await tile(page, 'woods-danger').getAttribute('data-explored'), '1.00');
      assert.equal(await tile(page, 'woods-danger').getAttribute('data-selected'), null);
      assert.equal(await page.locator('.proto-combat-demo').count(), 0, 'Seeing danger does not start battle');
      await flat(page);
      await page.screenshot({ path: `artifacts/tile-discovery/${width}-discovered.png` });
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${width}x${height}: anonymous unvisited paths/roads, entry reveal, both views, ${touch ? 'touch' : 'mouse'} movement, silent unknown tiles and persistent discovery passed`);
    }
  } catch (error) {
    for (const page of browser.contexts().flatMap(context => context.pages())) {
      await page.screenshot({ path: 'artifacts/tile-discovery/failure.png' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
