const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

const camera = page => page.locator('.proto-map-viewport').evaluate(element => {
  const style = getComputedStyle(element);
  return Object.fromEntries(['x', 'y', 'scale', 'yaw'].map(key =>
    [key, parseFloat(style.getPropertyValue(`--camera-${key}`)) || 0]));
});
// Choose actual hit-tested terrain, away from actors and viewport edges. In immersion
// a bounding-box centre can fall on another tile, so verify the rendered target.
const hitSurface = (page, selector) => page.evaluate(selector => {
  const viewport = document.querySelector('.proto-map-viewport').getBoundingClientRect();
  for (const tile of document.querySelectorAll(selector)) {
    const box = tile.getBoundingClientRect();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (x < viewport.left + 65 || x > viewport.right - 65 || y < viewport.top + 65 || y > viewport.bottom - 65) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit?.closest(selector) === tile && !hit.closest('[data-cell-grip]')) {
      return { x, y, id: tile.dataset.biomeId ?? tile.dataset.biomePopup };
    }
  }
  throw new Error(`No visible ${selector} to exercise`);
}, selector);
async function mouseDrag(page, point, button = 'left') {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button });
  await page.waitForTimeout(50);
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(point.x + step * 5, point.y + step * 2);
    await page.waitForTimeout(16);
  }
  // Pausing after movement must not turn the drag into a tile click.
  await page.waitForTimeout(450);
  await page.mouse.up({ button });
  await page.waitForTimeout(100);
}
async function touchGesture(page, points, endPoints, cancel = false) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  // Land fingers separately, as on a real phone.
  for (let count = 1; count <= points.length; count++) await send('touchStart', points.slice(0, count));
  await page.waitForTimeout(50);
  for (let step = 1; step <= 8; step++) {
    await send('touchMove', points.map((point, index) => ({ ...point,
      x: point.x + (endPoints[index].x - point.x) * step / 8,
      y: point.y + (endPoints[index].y - point.y) * step / 8 })));
    await page.waitForTimeout(16);
  }
  await send(cancel ? 'touchCancel' : 'touchEnd', []);
  await cdp.detach();
  await page.waitForTimeout(100);
}
async function reset(page) {
  await page.getByRole('button', { name: 'Reset View', exact: true }).click();
  await page.waitForTimeout(450);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    fs.mkdirSync('artifacts/biome-camera', { recursive: true });
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      if (process.env.PROTO_WIDTH && width !== Number(process.env.PROTO_WIDTH)) continue;
      for (const tilted of [false, true]) for (const surface of ['fog', 'mountains', ...(tilted ? ['scenery'] : [])]) {
        const selector = surface === 'fog' ? 'button[data-unexplored="true"]' : surface === 'mountains'
          ? 'button[data-tile-type="impassable-mountain"]' : '[data-biome-popup^="mountain-"]';
        const ground = page => hitSurface(page, selector);
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(URL);
        if (width < 900) await page.getByRole('button', { name: 'Table', exact: true }).click();
        if (tilted) {
          await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
          await page.waitForTimeout(750);
        }
        const tag = `${width}x${height} ${tilted ? 'immersion' : 'tabletop'} ${surface}`;
        for (const button of ['left', 'right', 'middle']) {
          const point = await ground(page), before = await camera(page);
          await mouseDrag(page, point, button);
          const after = await camera(page);
          assert.ok(button === 'middle' ? Math.abs(after.yaw - before.yaw) > 10
            : Math.hypot(after.x - before.x, after.y - before.y) > 20, `${tag}: ${button} drag moves camera`);
          assert.equal(await page.locator('.biome-closed-note').count(), 0, `${tag}: drag does not open discovery note`);
          assert.equal(await page.locator('[role="menu"]').count(), 0, `${tag}: right drag does not open menu`);
          await reset(page);
        }
        let point = await ground(page), before = await camera(page);
        await page.mouse.move(point.x, point.y);
        await page.mouse.wheel(0, -90);
        await page.waitForTimeout(400);
        assert.ok((await camera(page)).scale > before.scale, `${tag}: wheel zooms on fog`);
        await reset(page);

        point = await ground(page); before = await camera(page);
        await touchGesture(page, [{ ...point, id: 1 }], [{ x: point.x + 40, y: point.y + 16 }]);
        assert.ok(Math.hypot((await camera(page)).x - before.x, (await camera(page)).y - before.y) > 20, `${tag}: one finger pans on fog`);
        assert.equal(await page.locator('.biome-closed-note').count(), 0, `${tag}: finger drag does not tap tile`);
        await reset(page);

        point = await ground(page); before = await camera(page);
        await touchGesture(page, [{ x: point.x - 15, y: point.y, id: 1 }, { x: point.x + 15, y: point.y, id: 2 }],
          [{ x: point.x - 20, y: point.y + 15 }, { x: point.x + 40, y: point.y + 15 }]);
        const pinched = await camera(page);
        assert.ok(pinched.scale > before.scale * 1.5, `${tag}: two fingers pinch on fog`);
        assert.ok(Math.hypot(pinched.x - before.x, pinched.y - before.y) > 5, `${tag}: pinch also pans`);
        await reset(page);

        point = await ground(page); before = await camera(page);
        const fingers = [0, 120, 240].map(degrees => ({ x: point.x + 18 * Math.cos(degrees * Math.PI / 180),
          y: point.y + 18 * Math.sin(degrees * Math.PI / 180), id: degrees + 1 }));
        const turned = [30, 150, 270].map(degrees => ({ x: point.x + 18 * Math.cos(degrees * Math.PI / 180),
          y: point.y + 18 * Math.sin(degrees * Math.PI / 180) }));
        await touchGesture(page, fingers, turned);
        assert.ok(Math.abs((await camera(page)).yaw - before.yaw) > 20, `${tag}: three fingers spin on fog`);
        await reset(page);

        // Occupied squares retain object ownership, including a wheel or a
        // second finger while the actor is held. Cancel to avoid staffing the
        // den on release, which legitimately reframes the encounter camera.
        const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
        const actorPoint = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
        const actorCell = await page.locator('[data-board-piece="actor"]').first().getAttribute('data-grid-reference');
        before = await camera(page);
        await page.mouse.move(actorPoint.x, actorPoint.y);
        await page.mouse.down();
        await page.mouse.move(actorPoint.x + 12, actorPoint.y, { steps: 4 });
        await page.mouse.wheel(0, -90);
        await page.waitForTimeout(100);
        assert.deepEqual(await camera(page), before, `${tag}: actor grab and held wheel leave camera fixed`);
        assert.ok(await page.locator('[data-board-piece="actor"].opacity-45').count(), `${tag}: occupied square picks up actor`);
        await page.locator('[data-cell-grip="actor-hero"]').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
        await page.mouse.up();
        await page.waitForTimeout(650);
        assert.equal(await page.locator('[data-board-piece="actor"]').first().getAttribute('data-grid-reference'), actorCell, `${tag}: short actor drag stays in cell`);
        await touchGesture(page, [{ ...actorPoint, id: 1 }, { x: actorPoint.x + 20, y: actorPoint.y, id: 2 }],
          [{ x: actorPoint.x + 10, y: actorPoint.y }, { x: actorPoint.x + 40, y: actorPoint.y }], true);
        assert.deepEqual(await camera(page), before, `${tag}: second finger during actor grab cannot pinch camera`);
        await page.waitForTimeout(650);
        await page.keyboard.press('Escape');

        // After a pan, unknown tiles stay silent; discovered mountains open cards.
        const checkNote = async () => {
          if (surface === 'fog') {
            assert.equal(await page.locator('.biome-closed-note').count(), 0, `${tag}: unknown tile stays silent`);
            assert.equal(await page.locator('.details-card-viewer').count(), 0, `${tag}: unknown tile has no inspection card`);
            assert.equal(await page.locator('[role="tooltip"]').count(), 0, `${tag}: unknown tile has no hover hint`);
          } else {
            await page.locator('.details-card-viewer').waitFor();
            assert.match(await page.locator('.trading-card__description').getAttribute('aria-label'), /Impassable mountain/);
            await page.keyboard.press('Escape');
          }
        };
        point = await ground(page);
        await page.mouse.click(point.x, point.y);
        await checkNote();
        point = await ground(page);
        await page.touchscreen.tap(point.x, point.y);
        await checkNote();
        await page.locator(`button[data-biome-id="${point.id}"]`).focus();
        await page.keyboard.press('Enter');
        await checkNote();
        assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), [], `${tag}: camera controls fit`);
        await page.locator('.proto-map-viewport').screenshot({ path: `artifacts/biome-camera/${width}-${tilted ? 'immersion' : 'ott'}-${surface}-3x.png` });
        assert.deepEqual(errors, [], `${tag}: no browser errors`);
        console.log(`${tag}: mouse pan/spin/wheel, touch pan/pinch/twist, actor grab priority and mouse/touch/keyboard tile behavior pass`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
