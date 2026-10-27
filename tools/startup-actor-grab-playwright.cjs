const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html?atmosphere=off';
const actorSelector = '[data-board-piece="actor"][data-actor-id="hero"]';

async function camera(page) {
  return page.locator('.proto-map-viewport').evaluate(el =>
    ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw', '--actor-world-scale'].map(key => parseFloat(el.style.getPropertyValue(key))));
}

// Measure a point on the actual ground plane, including perspective and orbit.
async function groundPoint(page, dx, dy) {
  return page.locator(actorSelector).evaluate((actor, { dx, dy }) => {
    const marker = document.createElement('div');
    marker.style.cssText = `position:absolute;left:calc(50% + ${+actor.dataset.actorX + dx}px);top:calc(50% + ${+actor.dataset.actorY + dy}px);width:0;height:0;pointer-events:none`;
    actor.parentElement.append(marker);
    const box = marker.getBoundingClientRect();
    marker.remove();
    return { x: box.x, y: box.y };
  }, { dx, dy });
}

async function gesture(page, from, to, touch, during) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, point) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ ...point, id: 1 }],
  });
  if (touch) await send('touchStart', from);
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 12; i++) {
    const point = { x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 };
    if (touch) await send('touchMove', point); else await page.mouse.move(point.x, point.y);
  }
  await during?.(cdp);
  if (touch) await send('touchEnd', to); else await page.mouse.up();
  await cdp?.detach();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of process.argv.includes('--camera-only') ? [] : [1280, 1912, 390]) for (const touch of [false, true]) for (const pickup of ['square', 'body']) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : width === 1280 ? 720 : 914 }, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      if (width === 390) await page.getByRole('button', { name: 'Table', exact: true }).click();
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'), 'true');
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'immersive');
      const actor = page.locator(actorSelector);
      const startCell = await actor.getAttribute('data-grid-reference');
      const box = await actor.boundingBox();
      const from = pickup === 'square' ? await groundPoint(page, -18, 12) : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const to = await groundPoint(page, 0, -48);
      const before = await camera(page);
      await gesture(page, from, to, touch, async cdp => {
        assert.ok((await actor.getAttribute('class')).includes('opacity-45'), 'startup actor picked up');
        // Wheel and additional touch contacts must not zoom or orbit a held actor.
        await page.mouse.wheel(0, -500);
        if (cdp) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...to, id: 1 }, { x: to.x + 35, y: to.y, id: 2 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }, { x: to.x + 70, y: to.y, id: 2 }] });
        }
        assert.deepEqual(await camera(page), before, 'pickup and held gestures preserve camera');
        assert.equal(await page.locator('.details-card-viewer').count(), 0, 'drag never inspects');
      });
      await page.waitForFunction(selector => Number(document.querySelector(selector).dataset.actorY) < 95, actorSelector);
      assert.ok(!(await actor.getAttribute('class')).includes('opacity-45'), 'release clears pickup');
      assert.equal(await page.locator('.details-card-viewer').count(), 0);
      assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'), 'true');
      await page.waitForFunction(({ selector, startCell }) => document.querySelector(selector).dataset.gridReference !== startCell, { selector: actorSelector, startCell });
      assert.deepEqual(errors, []);
      console.log(`${width} ${touch ? 'touch' : 'mouse'} ${pickup}: startup pickup, camera lock, drop/travel and no inspection passed.`);
      await page.close();
    }
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
      await page.goto(URL);
      await page.waitForTimeout(1100);
      const at = await groundPoint(page, -18, 12);
      if (touch) await page.touchscreen.tap(at.x, at.y);
      else await page.mouse.click(at.x, at.y);
      await page.locator('.details-card-viewer[data-inspection-id="hero"]').waitFor();
      while (await page.locator('.details-card-viewer').count()) await page.locator('.details-card-viewer .trading-card__close').first().click();
      const view = await page.locator('.proto-map-viewport').boundingBox();
      const empty = { x: view.x + 24, y: view.y + view.height * 0.55 };
      const before = await camera(page);
      await page.mouse.move(empty.x, empty.y);
      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...empty, id: 1 }, { x: empty.x + 30, y: empty.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...empty, id: 1 }, { x: empty.x + 60, y: empty.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else await page.mouse.wheel(0, -300);
      assert.ok((await camera(page))[2] > before[2], 'camera zoom unlocks after actor release');
      const yaw = (await camera(page))[3];
      await page.mouse.move(empty.x, empty.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(empty.x + 45, empty.y + 10, { steps: 6 });
      await page.mouse.up({ button: 'middle' });
      assert.ok(Math.abs((await camera(page))[3] - yaw) > 1, 'close-up orbit still works');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'), 'false');
      console.log(`${touch ? 'touch' : 'mouse'}: startup inspection, zoom after release, orbit and Escape passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
