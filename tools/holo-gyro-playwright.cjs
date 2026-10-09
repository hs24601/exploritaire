const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const read = page => page.locator('.details-card-viewer .trading-card').evaluate(el =>
  Object.fromEntries(['tilt-x', 'tilt-y', 'foil-x', 'foil-y', 'card-lift'].map(key => [key, parseFloat(el.style.getPropertyValue(`--${key}`)) || 0])));
const samePose = (actual, expected, message) => {
  for (const key of Object.keys(expected)) assert.ok(Math.abs(actual[key] - expected[key]) < .01, `${message}: ${key}`);
};
async function settle(page) {
  await page.evaluate(() => { delete window.holoStable; });
  await page.waitForFunction(() => {
    const value = document.querySelector('.details-card-viewer .trading-card').style.cssText;
    if (window.holoStable?.value === value) window.holoStable.frames++;
    else window.holoStable = { value, frames: 0 };
    return window.holoStable.frames >= 6;
  });
}
async function orient(page, beta, gamma, angle = 0) {
  await page.evaluate(({ beta, gamma, angle }) => {
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: angle });
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma }));
  }, { beta, gamma, angle });
  await settle(page);
}
async function open(page) {
  await page.locator('[data-board-piece="actor"]').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-card-state="compact"]').waitFor();
  await page.mouse.move(5, 5);
}
(async () => {
  fs.mkdirSync('artifacts/holo-gyro', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.motionRequests = 0; window.orientationListeners = new Set();
        DeviceOrientationEvent.requestPermission = () => { window.motionRequests++; return Promise.resolve('granted'); };
        const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
        window.addEventListener = (type, listener, options) => { if (type === 'deviceorientation') window.orientationListeners.add(listener); add(type, listener, options); };
        window.removeEventListener = (type, listener, options) => { if (type === 'deviceorientation') window.orientationListeners.delete(listener); remove(type, listener, options); };
      });
      await page.goto(URL); await open(page);
      assert.equal(await page.evaluate(() => window.motionRequests), 1, 'Opening gesture requests permission once');
      const camera = await page.locator('.proto-map-viewport').evaluate(el => el.style.cssText);
      for (const state of ['compact', 'jumbo']) {
        if (state === 'jumbo') {
          await page.locator('.details-card-viewer').focus(); await page.keyboard.press('Enter');
          await page.locator('[data-card-state="jumbo"]').waitFor();
        }
        await orient(page, 45, 0);
        assert.ok(Math.abs((await read(page))['tilt-y']) < .1, 'Opening pose calibrates to neutral');
        await orient(page, 57, 16);
        let pose = await read(page);
        assert.ok(Math.abs(pose['tilt-y'] - 19.656) < .05 && Math.abs(pose['tilt-x'] + 12.528) < .05,
          `${state}: the same portrait movement produces exactly 3x the original tilt`);
        assert.ok(pose['foil-x'] > 65 && pose['card-lift'] > .9, 'Gyro drives foil and depth');
        const face = page.locator('.details-card-viewer .trading-card');
        const box = await face.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, 'Tilt stays in viewport');
        await page.locator('.details-card-viewer').screenshot({ path: `artifacts/holo-gyro/${width}-${state}-3x.png` });
        // Pointer owns the spring until leave; then the latest sensor pose resumes.
        const stage = await page.locator('.details-card-viewer .trading-card-stage').boundingBox();
        await page.mouse.move(stage.x + stage.width * .15, stage.y + stage.height * .2);
        await settle(page); const pointer = await read(page);
        await orient(page, 30, -20);
        assert.ok(Math.abs((await read(page))['tilt-y'] - pointer['tilt-y']) < .1, 'Sensor does not fight pointer');
        await page.mouse.move(5, 5); await settle(page);
        assert.ok((await read(page))['tilt-y'] < -5, 'Sensor resumes on pointer leave');
        // Real touch ownership, with cancellation to avoid opening/closing a card.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stage.x + stage.width * .7, y: stage.y + stage.height * .4 }] });
        await settle(page); const touching = await read(page);
        await orient(page, 60, 25);
        assert.ok(Math.abs((await read(page))['tilt-y'] - touching['tilt-y']) < .1, 'Touch takes priority');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach();
        await settle(page); assert.ok((await read(page))['tilt-y'] > 5, 'Gyro resumes after touch');
        for (const angle of [90, 270]) {
          await orient(page, 45, 0, angle); await orient(page, 60, 0, angle);
          pose = await read(page);
          assert.ok(angle === 90 ? pose['tilt-y'] > 5 : pose['tilt-y'] < -5, 'Landscape remaps handset axes');
          assert.ok(Math.abs(pose['tilt-x']) < .1);
        }
        await orient(page, 179, 0, 0); await orient(page, -179, 0, 0);
        assert.ok(Math.abs((await read(page))['tilt-x']) < 2, 'Beta wrap does not flip the card');
        const valid = await read(page); await orient(page, null, null);
        samePose(await read(page), valid, 'Missing sensor values are ignored');
        await orient(page, 90, 80);
        pose = await read(page); assert.ok(Math.abs(pose['tilt-x']) <= 36.01 && Math.abs(pose['tilt-y']) <= 42.01, 'Extreme angles remain bounded at 3x strength');
        await page.emulateMedia({ reducedMotion: 'reduce' }); await orient(page, 0, 0);
        assert.equal(await face.evaluate(el => getComputedStyle(el).transform), 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await orient(page, 80, 30); const hidden = await read(page); await orient(page, 10, -30);
        samePose(await read(page), hidden, 'Hidden page ignores sensors');
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        await orient(page, 80, 30); assert.ok(Math.abs((await read(page))['tilt-y']) < .1, 'Resuming recalibrates');
        assert.deepEqual(await findLayoutDefects(page, `.trading-card--${state}`, { parts: '.trading-card__header, .trading-card__body, .trading-card__description, .trading-card__full-description, .trading-card__sections, .trading-card__section' }), []);
      }
      assert.equal(await page.locator('.proto-map-viewport').evaluate(el => el.style.cssText), camera, 'Sensor never moves map camera');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.locator('.details-card-viewer').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => window.orientationListeners.size), 0, 'Dismissal removes sensor listener');
      await open(page); assert.equal(await page.evaluate(() => window.motionRequests), 1, 'Reopening reuses permission');
      await orient(page, 20, 20); assert.ok(Math.abs((await read(page))['tilt-y']) < .1);
      assert.deepEqual(errors, []);
      console.log(`${width}: compact/jumbo gyro, foil/depth, mouse/touch priority, landscape, wrap, bounds, reduced motion, visibility, layout and cleanup passed`);
      await page.close();
    }
    for (const outcome of ['denied', 'rejected', 'unsupported']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(outcome => {
        if (outcome === 'unsupported') Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined });
        else DeviceOrientationEvent.requestPermission = () => outcome === 'rejected' ? Promise.reject(new Error('Blocked')) : Promise.resolve('denied');
      }, outcome);
      await page.goto(URL); await open(page);
      const box = await page.locator('.trading-card-stage').boundingBox();
      await page.mouse.move(box.x + box.width * .2, box.y + box.height * .3); await settle(page);
      assert.ok((await read(page))['tilt-y'] < -5, `${outcome}: pointer fallback works`);
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('Denied, rejected and unsupported motion access preserve pointer fallback without browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
