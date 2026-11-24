const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

(async () => {
  fs.mkdirSync('output/live-paint', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(process.env.LIVE_PAINT_URL || 'http://127.0.0.1:5183/tools/live-paint-lab.html');
    await page.locator('canvas[data-ready=true]').waitFor({ timeout: 45000 });
    const canvas = page.locator('canvas');
    await page.locator('#pause').click();
    const setSlider = (id, value) => page.locator(id).evaluate((input, value) => {
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.locator('#view').selectOption('original');
    await page.waitForTimeout(150);
    const original = await canvas.screenshot();
    await page.locator('#view').selectOption('paint');
    await setSlider('#strength', '0');
    await page.waitForTimeout(150);
    assert.deepEqual(await canvas.screenshot(), original, 'Zero strength preserves the source scene');
    await setSlider('#strength', '1'); await setSlider('#brush', '6');
    await page.waitForTimeout(150);
    assert.notDeepEqual(await canvas.screenshot(), original, 'Kuwahara pass changes scene pixels');
    await page.locator('#view').selectOption('split');
    await setSlider('#strength', '0.75'); await setSlider('#brush', '3');
    await page.locator('#pause').click();
    const x = await canvas.getAttribute('data-hero-x');
    await page.mouse.move(800, 420); await page.mouse.down();
    await page.mouse.move(950, 430, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(500);
    assert.notEqual(await canvas.getAttribute('data-hero-x'), x, 'Mouse moves the sprite');
    const mouseX = await canvas.getAttribute('data-hero-x');
    await page.touchscreen.tap(400, 400); await page.waitForTimeout(500);
    assert.notEqual(await canvas.getAttribute('data-hero-x'), mouseX, 'Touch moves the sprite');
    await page.locator('#subject').selectOption('portrait');
    await page.locator('#motion').check();
    await page.locator('#resolution').selectOption('0.5');
    assert.equal(await canvas.getAttribute('width'), '640');
    await page.locator('#resolution').selectOption('0.75');
    await page.touchscreen.tap(640, 400); await page.waitForTimeout(1200);
    await page.screenshot({ path: 'output/live-paint/portrait.png' });
    await page.locator('#subject').selectOption('world');
    await page.locator('#pause').click();
    await page.screenshot({ path: 'output/live-paint/world.png' });
    for (const width of [1280, 1912]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 914 });
      assert.deepEqual(await findLayoutDefects(page, '#paint-controls', { parts: 'label,button,#performance' }), []);
    }
    await page.locator('#paint-controls').screenshot({ path: 'output/live-paint/controls.png', scale: 'css' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['zero-strength pixel equality', 'filter output differs', 'mouse movement', 'touch movement', 'sprite switch', 'wash control', 'resolution', 'desktop layout', 'no browser errors'], frameRate: await page.locator('#performance').textContent() }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

