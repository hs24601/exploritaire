const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('output/forest-phase', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5183/tools/live-paint-lab.html');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.ready === 'true');
    assert.equal(await page.locator('#blend').inputValue(), '1000');
    assert.equal(await page.locator('#blend').getAttribute('max'), '3000');
    await page.locator('#density').evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input')); });
    await page.waitForFunction(() => document.querySelector('canvas').dataset.trees === '40');
    await page.locator('#blend').evaluate(el => { el.value = '2000'; el.dispatchEvent(new Event('input')); });
    await page.mouse.move(750, 340); await page.mouse.down();
    await page.mouse.move(1000, 340, { steps: 4 }); await page.mouse.up();
    await page.waitForFunction(() => Number(document.querySelector('canvas').dataset.transitioning) > 0);
    await page.waitForTimeout(300);
    assert.ok(Number(await page.locator('canvas').getAttribute('data-transitioning')) > 0, 'The phase persists beyond the old 160ms maximum');
    await page.screenshot({ path: 'output/forest-phase/phasing.png' });
    await page.waitForFunction(() => document.querySelector('canvas').dataset.transitioning === '0');
    await page.screenshot({ path: 'output/forest-phase/settled.png' });
    assert.deepEqual(await findLayoutDefects(page, '#forest-controls', { parts: ':scope > label,:scope > button' }), []);
    assert.equal(await page.locator('canvas').getAttribute('data-render-mode'), 'object-only');
    assert.deepEqual(errors, []);
    console.log('PASS: 1000ms default, 3000ms range, sustained object-local phase followed by completion, desktop layout, no WebGL errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
