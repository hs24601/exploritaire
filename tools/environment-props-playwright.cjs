const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const DEVICE_SCALE_FACTOR = Number(process.env.DEVICE_SCALE_FACTOR || 3);

async function dragOverMountain(page, touch) {
  const actor = page.locator('[data-board-piece="actor"]').first();
  const cell = await actor.getAttribute('data-grid-reference');
  const box = await page.locator('[data-cell-grip]').first().boundingBox();
  const start = { x: box.x + box.width * .18, y: box.y + box.height * .82 };
  const transform = () => page.locator('.proto-map-viewport').evaluate(el => el.style.getPropertyValue('--camera-transform'));
  const before = await transform();
  const destination = await page.locator('[data-biome-id="mountain-1-2"]').boundingBox();
  const end = { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const sendTouch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: point.x, y: point.y }],
  });
  if (touch) await sendTouch('touchStart', start);
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  for (let i = 1; i <= 6; i++) {
    const point = { x: start.x + (end.x - start.x) * i / 6, y: start.y + (end.y - start.y) * i / 6 };
    if (touch) await sendTouch('touchMove', point);
    else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(16);
  }
  assert.ok(await actor.evaluate(el => el.classList.contains('opacity-45')), 'Occupied square picks up its actor');
  assert.equal(await transform(), before, 'Actor drag does not move the camera');
  if (touch) await sendTouch('touchEnd', end);
  else await page.mouse.up();
  await page.waitForTimeout(450);
  assert.equal(await actor.getAttribute('data-grid-reference'), cell, 'Impassable mountains reject actor placement');
  assert.ok((await page.locator('body').innerText()).includes('No clear route.'));
  assert.equal(await page.locator('[role="dialog"]').count(), 0, 'A completed drag does not inspect the actor');
  await cdp?.detach();
}

async function checkLiveFootprints(page) {
  const result = await page.evaluate(() => new Promise((resolve, reject) => {
    const problems = []; let frames = 0;
    const turn = setInterval(() => document.querySelector('[aria-label="Turn table right"]').click(), 400);
    const start = performance.now();
    function tick(now) {
      try {
        const root = document.querySelector('.proto-map-viewport');
        const yaw = parseFloat(getComputedStyle(root).getPropertyValue('--camera-yaw')) * Math.PI / 180;
        const coordinate = value => { const m = value.match(/50% ([+-]) ([\d.]+)px/); return Number(m[2]) * (m[1] === '-' ? -1 : 1); };
        for (const el of root.querySelectorAll('[data-environment-prop]')) {
          const d = el.dataset, x = coordinate(el.style.left), y = coordinate(el.style.top);
          const width = Number(d.sceneryWidth) * Number(el.style.getPropertyValue('--scenery-fit-scale') || 1);
          for (const end of [-1, 1]) {
            const px = x + end * width / 2 * Math.cos(yaw), py = y - end * width / 2 * Math.sin(yaw);
            if (Math.abs(px - Number(d.ownerX)) > Number(d.ownerWidth) / 2 + .01
              || Math.abs(py - Number(d.ownerY)) > Number(d.ownerHeight) / 2 + .01) problems.push(d.biomePopup || d.biomeEdge);
          }
        }
        frames++;
        // Collect enough live camera samples even on a software-rendered
        // headless browser; elapsed time is reported separately from geometry.
        if (now - start < 1800 || frames <= 10 && now - start < 10000) requestAnimationFrame(tick);
        else { clearInterval(turn); resolve({ problems, frames, elapsed: now - start }); }
      } catch (error) { clearInterval(turn); reject(error); }
    }
    requestAnimationFrame(tick);
  }));
  assert.deepEqual(result.problems, []);
  assert.ok(result.frames > 10);
  console.log(`Live footprint sampling: ${result.frames} frames in ${Math.round(result.elapsed)}ms`);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: DEVICE_SCALE_FACTOR });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL); await page.waitForTimeout(800);
      assert.equal(await page.evaluate(async () => {
        const image = new Image(); image.src = '/assets/biomes/impassable-mountain_topdown.svg'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, 1, 1).data[3];
      }), 0, 'Overhead art has transparent background pixels');
      assert.equal(await page.locator('[data-unexplored-ground]').getAttribute('data-ground-cell-count'), String(await page.locator('[data-unexplored="true"]').count() + await page.locator('[data-tile-type="impassable-mountain"]').count() + 1));
      assert.ok(await page.locator('[data-tile-type="impassable-mountain"]').evaluateAll(tiles => tiles.every(tile => getComputedStyle(tile).backgroundColor === 'rgba(0, 0, 0, 0)')));
      await dragOverMountain(page, touch);
      await page.screenshot({ path: `artifacts/environment-${width}-flat-${touch ? 'touch' : 'mouse'}-${DEVICE_SCALE_FACTOR}x.png` });
      await page.getByRole('button', { name: 'Tilt camera view' }).click(); await page.waitForTimeout(900);
      await checkLiveFootprints(page);
      await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(500);
      await dragOverMountain(page, touch);
      assert.equal(await page.locator('[data-physical-world] [data-board-piece="actor"]').count(), await page.locator('[data-board-piece="actor"]').count());
      assert.equal(await page.locator('.proto-table-actor-layer [data-actor-ghost]').count(), await page.locator('[data-board-piece="actor"]').count());
      const actor = page.locator('[data-board-piece="actor"]').first(); const box = await actor.boundingBox();
      if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * .65);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height * .65);
      await page.waitForTimeout(300);
      assert.ok(await page.locator('.details-card-viewer, [role="dialog"]').count(), 'Actor inspection stays available');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
      await page.screenshot({ path: `artifacts/environment-${width}-tilt-${touch ? 'touch' : 'mouse'}-${DEVICE_SCALE_FACTOR}x.png` });
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Transparent shared ground, physical actors and shared occlusion pass, mouse/touch inspection and occupied-cell dragging, live scenery containment, desktop layout, and ${DEVICE_SCALE_FACTOR}x previews passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
