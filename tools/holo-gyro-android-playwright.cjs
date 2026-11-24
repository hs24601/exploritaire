const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const startupOnly = process.argv.includes('--startup-only');
const diagnostics = page => page.locator('[data-gyro-diagnostics]');
const face = page => page.locator('.details-card-viewer .trading-card');
const pose = page => face(page).evaluate(el => ['--tilt-x', '--tilt-y'].map(key => parseFloat(el.style.getPropertyValue(key)) || 0));
// Exercise Android's no-requestPermission path with controlled orientation
// events. These verify game handling, not physical handset sensor delivery.
const sensor = (page, beta, gamma) => page.evaluate(({ beta, gamma }) => {
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma }));
}, { beta, gamma });
async function moved(page) {
  await page.waitForFunction(() => {
    const card = document.querySelector('.details-card-viewer .trading-card');
    return Math.abs(parseFloat(card?.style.getPropertyValue('--tilt-y')) || 0) > 4;
  });
}
async function strongTiltBounds(page, width, height, state) {
  for (const [beta, gamma] of [[90, 80], [0, -80], [90, -80], [0, 80]]) {
    await sensor(page, beta, gamma);
    await page.waitForFunction(() => {
      const card = document.querySelector('.details-card-viewer .trading-card');
      return Math.abs(Math.abs(parseFloat(card.style.getPropertyValue('--tilt-x'))) - 36) < .01
        && Math.abs(Math.abs(parseFloat(card.style.getPropertyValue('--tilt-y'))) - 42) < .01;
    });
    const box = await face(page).boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height,
      `${width}x${height} ${state} stronger corner tilt must fit: ${JSON.stringify(box)}`);
  }
  await sensor(page, 45, 0);
}

(async () => {
  fs.mkdirSync('artifacts/holo-gyro', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    // A sensor can already be producing readings when an inspection mounts.
    // Force delivery during subscription to exercise React's effect replay and
    // cancellation before the first animation frame, not just settled input.
    const startup = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await startup.addInitScript(() => {
      const add = window.addEventListener.bind(window);
      window.addEventListener = (type, listener, options) => {
        add(type, listener, options);
        if (type === 'deviceorientation') {
          window.dispatchEvent(new DeviceOrientationEvent(type, { beta: 45, gamma: 0 }));
          window.dispatchEvent(new DeviceOrientationEvent(type, { beta: 60, gamma: 16 }));
        }
      };
    });
    await startup.goto(`${URL}?gyrolog`);
    await startup.locator('[data-board-piece="actor"]').first().tap();
    await face(startup).waitFor();
    await sensor(startup, 45, 0); await sensor(startup, 60, 16);
    await moved(startup);
    console.log('Readings during card mounting/effect replay cannot leave the animation frozen');
    await startup.close();
    if (startupOnly) return;
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await context.grantPermissions(['accelerometer', 'gyroscope'], { origin: new globalThis.URL(URL).origin });
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true,
        screenOrientation: { type: width > height ? 'landscapePrimary' : 'portraitPrimary', angle: width > height ? 90 : 0 } });
      await page.goto(`${URL}?gyrolog`);
      await page.bringToFront();
      assert.equal(await page.evaluate(() => typeof DeviceOrientationEvent.requestPermission), 'undefined', 'Android path has no Safari permission method');
      await page.locator('[data-board-piece="actor"]').first().tap();
      await face(page).waitFor();
      await sensor(page, 45, 0);
      await page.waitForFunction(() => /Valid: [1-9]/.test(document.querySelector('[data-gyro-diagnostics]').textContent));
      assert.ok((await pose(page)).every(value => Math.abs(value) < .1), 'First orientation event calibrates');
      await sensor(page, 60, 16); await moved(page);
      await diagnostics(page).getByText('Orientation readings are arriving.').waitFor();
      await page.waitForFunction(() => {
        const report = document.querySelector('[data-gyro-diagnostics]').textContent;
        return report.includes('Card hook: tracking') && report.includes('Input: sensor') && /Paints: [1-9]/.test(report);
      });
      await strongTiltBounds(page, width, height, 'compact');
      await face(page).tap();
      await page.locator('[data-card-state="jumbo"]').waitFor();
      await sensor(page, 45, 0); await page.waitForTimeout(100);
      await sensor(page, 60, 16); await moved(page);
      // A real touch release must return ownership to the orientation stream.
      const stage = await page.locator('.details-card-viewer .trading-card-stage').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sensor(page, 61, 17); await moved(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await diagnostics(page).getByText('Tilt paused: Reduce Motion is enabled.').waitFor();
      await sensor(page, 10, 10);
      await page.waitForFunction(() => document.querySelector('[data-gyro-diagnostics]').textContent.includes('Card hook: reduced motion'))
        .catch(async error => { console.log(await diagnostics(page).innerText()); throw error; });
      assert.equal(await face(page).evaluate(el => getComputedStyle(el).transform), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await sensor(page, 45, 0); await page.waitForTimeout(100);
      await sensor(page, 60, 16); await moved(page);
      await page.waitForFunction(() => {
        const report = document.querySelector('[data-gyro-diagnostics]').textContent;
        return report.includes('Reduce Motion: off') && report.includes('Card hook: tracking');
      });
      await strongTiltBounds(page, width, height, 'jumbo');
      await sensor(page, 60, 16); await moved(page);
      const bounds = await diagnostics(page).boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, 'Diagnostic text stays inside phone viewport');
      await page.screenshot({ path: `artifacts/holo-gyro/android-${width}-diagnostics.png` });
      assert.deepEqual(errors, []);
      await page.goto(URL);
      assert.equal(await diagnostics(page).count(), 0, 'No diagnostic UI without opt-in flag');
      console.log(`${width}x${height}: simulated Android orientation, touch opening/release, compact/jumbo, reduced motion and diagnostic bounds passed`);
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    const browserContextId = targetInfo.browserContextId;
    await cdp.send('Browser.setPermission', { permission: { name: 'accelerometer' }, setting: 'denied', origin: new globalThis.URL(URL).origin, browserContextId });
    await page.goto(`${URL}?gyrolog`);
    await diagnostics(page).getByText('Blocked: allow Motion sensors in Edge.').waitFor();
    await cdp.send('Browser.setPermission', { permission: { name: 'accelerometer' }, setting: 'granted', origin: new globalThis.URL(URL).origin, browserContextId });
    await diagnostics(page).getByText('No readings yet. Check Edge’s Motion sensors setting.').waitFor();
    console.log('Denied sensors and live permission changes are reported without claiming missing readings prove denial');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
