const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('output/forest-object-transition', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5183/tools/live-paint-lab.html');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.ready === 'true');
    const canvas = page.locator('canvas');
    const position = async () => (await canvas.getAttribute('data-camera')).split(',').map(Number);
    assert.equal(await canvas.getAttribute('data-render-mode'), 'object-only');
    await page.evaluate(() => {
      window.maxTransitions = 0;
      new MutationObserver(() => { window.maxTransitions = Math.max(window.maxTransitions, Number(document.querySelector('canvas').dataset.transitioning || 0)); }).observe(document.querySelector('canvas'), { attributes: true, attributeFilter: ['data-transitioning'] });
    });
    await canvas.focus(); const start = await position();
    await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
    await page.waitForFunction(z => Number(document.querySelector('canvas').dataset.camera.split(',')[2]) < z - .05, start[2]);
    const outward = await position();
    await page.locator('#turn-back').click();
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('canvas').dataset.yaw)) > 179);
    const turned = await position();
    turned.forEach((value, i) => assert.ok(Math.abs(value - outward[i]) < .01, 'Turn back keeps the camera position'));
    await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
    await page.waitForFunction(z => Number(document.querySelector('canvas').dataset.camera.split(',')[2]) > z + .05, turned[2]);
    await page.mouse.move(750, 340); await page.mouse.down();
    await page.mouse.move(1000, 340, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('canvas').dataset.yaw)) > 45 && Math.abs(Number(document.querySelector('canvas').dataset.yaw)) < 175);
    assert.ok(Number(await canvas.getAttribute('data-max-relief-angle')) <= 30.001);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'output/forest-object-transition/reverse-view.png' });
    assert.ok(await page.evaluate(() => window.maxTransitions > 0), 'Trees transition independently during movement');
    assert.equal(await page.locator('#forest-error').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: free orbit beyond 30°, in-place 180° turn, outward/return movement, object-local 30° pose windows and triggered transitions; no WebGL errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
