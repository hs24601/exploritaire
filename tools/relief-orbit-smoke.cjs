const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('output/relief-orbit', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:5183/tools/live-paint-lab.html');
    const canvas = page.locator('canvas');
    await page.locator('canvas[data-ready=true]').waitFor();
    const slider = async (id, value) => {
      await page.locator(id).evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input')); }, value);
      await page.waitForTimeout(120);
    };
    for (const angle of [0, 90, 180, 270, 360]) {
      await slider('#world-yaw', angle);
      const yaw = Number(await canvas.getAttribute('data-yaw'));
      assert.ok(Math.abs(Math.sin(yaw - angle * Math.PI / 180)) < .01, `World camera reaches ${angle}°`);
      assert.ok(Math.abs(Number(await canvas.getAttribute('data-relief-angle'))) <= 8 * Math.PI / 180 + .001);
    }
    await slider('#angle', 0); await slider('#world-yaw', 90);
    assert.ok(Math.abs(Number(await canvas.getAttribute('data-relief-angle'))) < .001);
    await slider('#angle', 8); await slider('#world-yaw', 135);
    await page.waitForTimeout(450);
    await page.screenshot({ path: 'output/relief-orbit/pine-135.png' });
    const yaw = await canvas.getAttribute('data-yaw');
    await page.mouse.move(850, 350); await page.mouse.down();
    await page.mouse.move(1010, 350, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(150);
    assert.notEqual(await canvas.getAttribute('data-yaw'), yaw);
    const session = await page.context().newCDPSession(page);
    const touchYaw = Number(await canvas.getAttribute('data-yaw'));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 750, y: 320 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 850, y: 320 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    assert.ok(Math.abs(Number(await canvas.getAttribute('data-yaw')) - touchYaw) > .01);
    await page.locator('#asset').selectOption('hero');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.asset === 'hero');
    assert.equal(await page.locator('#follow').isVisible(), false);
    assert.ok(Math.abs(Number(await canvas.getAttribute('data-yaw'))) <= Math.PI / 6 + .001);
    await page.locator('#asset').selectOption('pine');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.asset === 'pine');
    await page.locator('#follow').uncheck();
    assert.equal(await page.locator('#world-yaw').isDisabled(), true);
    await page.locator('#follow').check();
    for (const width of [1280, 1912]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 914 });
      assert.deepEqual(await findLayoutDefects(page, '#depth-controls', { parts: ':scope > label,:scope > button,:scope > a' }), []);
    }
    assert.equal(await page.locator('#depth-error').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: full orbit angles, bounded relief offset, zero-offset following, mouse/touch orbit, creature camera limits, fixed/follow toggle and desktop layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
