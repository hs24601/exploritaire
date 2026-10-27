const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5178/proto.html');
    await page.waitForTimeout(1500);
    const a = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
    const b = await page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.mouse.up();
    await page.getByRole('button', { name: 'Confirm travel', exact: true }).click();
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'), 'immersive');
    assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'), 'false');
    const camera = () => page.locator('.proto-map').evaluate(el => {
      const viewport = el.querySelector('[style*="--camera-scale"]');
      return viewport ? ['--camera-x', '--camera-y', '--camera-scale', '--camera-yaw'].map(key => viewport.style.getPropertyValue(key)) : null;
    });
    const first = await camera(); assert(first, 'live camera variables available');
    await page.waitForTimeout(1200); assert.notDeepEqual(await camera(), first, 'shot sweeps while awaiting a play');
    await page.getByRole('button', { name: 'Pause journey', exact: true }).click();
    await page.waitForTimeout(200); const paused = await camera();
    await page.waitForTimeout(700); assert.deepEqual(await camera(), paused, 'pause freezes camera');
    await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
    await page.waitForTimeout(500); assert.notDeepEqual(await camera(), paused, 'resume continues shot');
    await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
    const manual = await camera(); await page.waitForTimeout(500);
    assert.deepEqual(await camera(), manual, 'manual orbit releases cinematic tracking');
    assert.deepEqual(errors, []);
    console.log('PASS cinematic travel: immersion, sweep, pause/resume, manual takeover');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
