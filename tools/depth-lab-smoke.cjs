const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('output/depth-lab', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5183/tools/live-paint-lab.html');
    const canvas = page.locator('canvas');
    await page.locator('canvas[data-ready=true]').waitFor({ timeout: 45000 });
    await page.locator('#spin').uncheck();
    await page.locator('#probe').uncheck();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'output/depth-lab/pine-volume.png' });
    assert.ok(fs.statSync('output/depth-lab/pine-volume.png').size > 30000, 'Pine screenshot contains rendered artwork');
    const yaw = await canvas.getAttribute('data-yaw');
    await page.mouse.move(800, 330); await page.mouse.down();
    await page.mouse.move(1000, 350, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(350);
    assert.notEqual(await canvas.getAttribute('data-yaw'), yaw);
    await page.screenshot({ path: 'output/depth-lab/pine-orbit.png' });
    for (const method of ['flat', 'layers', 'volume']) {
      await page.locator('#method').selectOption(method);
      assert.equal(await canvas.getAttribute('data-method'), method);
    }
    await page.locator('#asset').selectOption('cir');
    assert.equal(await page.locator('#method').inputValue(), 'layers');
    await page.locator('#reset').click();
    await page.locator('#rear').uncheck(); await page.locator('#front').uncheck();
    await page.locator('#rear').check(); await page.locator('#front').check();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'output/depth-lab/cir-layers.png' });
    await page.locator('#spin').tap();
    assert.equal(await page.locator('#spin').isChecked(), true);
    await page.locator('#spin').uncheck();
    for (const width of [1280, 1912]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 914 });
      assert.deepEqual(await findLayoutDefects(page, '#depth-controls', { parts: 'label,button' }), []);
    }
    await page.locator('#light').evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('input')); });
    assert.equal(await page.locator('#depth-error').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS: pine modes, mouse orbit, Cir layers, touch toggle, studio light and desktop layouts; no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
