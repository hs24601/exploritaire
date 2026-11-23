const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const url = process.env.ROAM_URL || 'http://127.0.0.1:5178/roam.html';
const actor = '[data-board-piece="actor"][data-actor-id="hero"]';
const camera = page => page.locator('.proto-map-viewport').evaluate(el =>
  ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw', '--table-tilt'].map(key => getComputedStyle(el).getPropertyValue(key)));
const ground = (page, dx, dy) => page.locator(actor).evaluate((el, { dx, dy }) => {
  const marker = document.createElement('div');
  marker.style.cssText = `position:absolute;left:calc(50% + ${+el.dataset.actorX + dx}px);top:calc(50% + ${+el.dataset.actorY + dy}px);width:0;height:0;pointer-events:none`;
  el.parentElement.append(marker); const rect = marker.getBoundingClientRect(); marker.remove();
  return { x: rect.x, y: rect.y };
}, { dx, dy });
async function drag(page, from, to, button = 'left') {
  await page.mouse.move(from.x, from.y); await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up({ button });
}
(async () => {
  fs.mkdirSync('output/roam', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await page.locator(actor).waitFor(); await page.waitForTimeout(1300);
    assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'), 'false');
    assert.equal(await page.locator('.day-cinema-grade,.proto-callout,.travel-tableau,.proto-quest-sidebar').count(), 0);
    const initialCamera = await camera(page);
    const startCell = await page.locator(actor).getAttribute('data-grid-reference');
    await drag(page, await ground(page, -10, 8), await ground(page, 0, -48));
    await page.waitForFunction(sel => !!document.querySelector(sel).dataset.travelSpeed, '.proto-map-viewport');
    assert.deepEqual(await camera(page), initialCamera, 'Walking does not take over the camera');
    await page.waitForFunction(({ actor, startCell }) => document.querySelector(actor).dataset.gridReference !== startCell, { actor, startCell }, { timeout: 25000 });
    await page.locator('[data-route-line="true"]').waitFor({ state: 'detached', timeout: 25000 });
    assert.deepEqual(await camera(page), initialCamera, 'Arrival does not reframe the camera');
    const moved = await page.locator(actor).getAttribute('data-grid-reference');
    assert.notEqual(moved, startCell);
    // A second pickup exercises continued navigation after the first arrival.
    const cdp = await page.context().newCDPSession(page);
    const from = await ground(page, -10, 8), to = await ground(page, 0, -48);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x-from.x)*i/8, y: from.y + (to.y-from.y)*i/8, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(({ actor, moved }) => document.querySelector(actor).dataset.gridReference !== moved, { actor, moved }, { timeout: 25000 });
    await page.locator('[data-route-line="true"]').waitFor({ state: 'detached', timeout: 25000 });
    await cdp.detach();
    const beforePan = await camera(page);
    await drag(page, { x: 180, y: 280 }, { x: 240, y: 310 }, 'right'); await page.waitForTimeout(250);
    assert.notDeepEqual(await camera(page), beforePan, 'Right drag pans');
    const beforeOrbit = await camera(page);
    await drag(page, { x: 300, y: 280 }, { x: 360, y: 320 }, 'middle'); await page.waitForTimeout(250);
    assert.notDeepEqual(await camera(page), beforeOrbit, 'Middle drag orbits and tilts');
    const beforeZoom = await camera(page);
    await page.mouse.wheel(0, -100); await page.waitForTimeout(700);
    assert.notEqual((await camera(page))[2], beforeZoom[2], 'Wheel zooms');
    await page.keyboard.press('o'); await page.waitForTimeout(700);
    assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'tabletop');
    const beforeKey = await camera(page);
    await page.keyboard.down('d'); await page.waitForTimeout(180); await page.keyboard.up('d'); await page.waitForTimeout(250);
    assert.notDeepEqual(await camera(page), beforeKey, 'WASD pans');
    await page.getByRole('button', { name: 'Turn table right', exact: true }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click(); await page.waitForTimeout(700);
    for (const width of [1280, 1912]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 914 }); await page.waitForTimeout(400);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
      await page.screenshot({ path: `output/roam/${width}.png` });
    }
    const review = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
    const zoomed = await review.newPage(); await zoomed.goto(url); await zoomed.locator(actor).waitFor(); await zoomed.waitForTimeout(1000);
    const box = await zoomed.locator('.proto-map-toolbar').boundingBox();
    await zoomed.screenshot({ path: 'output/roam/controls-3x.png', clip: box }); await review.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ url, startCell, moved, cameraControls: 'pan/orbit/tilt/zoom/WASD/turn/reset', mouseAndTouch: 'passed', layout: 'passed at 1280 and 1912', errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
