const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html');
    const bubble = page.locator('.proto-callout[data-callout-id="day01.opening"]');
    await bubble.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Edit tiles', exact: true }).click();
    await page.getByRole('button', { name: 'Edit callout', exact: true }).click();
    const input = page.getByLabel('Callout text', { exact: true });
    const text = await input.inputValue();
    await input.fill(text + ' I remember this place.');
    await page.getByRole('button', { name: 'Save callout', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('exploritaire.callouts.v1'))['day01.opening']);
    assert.equal(saved.camera.id, 'story.day01.opening');
    await page.getByRole('button', { name: 'Close tile editor', exact: true }).click();
    // Reload also exercises existing browser-local edits from before this fix.
    for (let run = 0; run < 2; run++) {
      await page.reload();
      await bubble.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('.scenario-camera-details output')?.textContent.includes('Yaw 194.00'));
      await page.locator('.proto-callout-advance').click();
      assert.equal(await bubble.getAttribute('data-page'), '2');
      await page.waitForFunction(() => document.querySelector('.scenario-camera-details output')?.textContent.includes('Tilt 82.00'));
      assert.match(await bubble.innerText(), /I remember this place/);
    }
    assert.deepEqual(errors, []);
    console.log('PASS text-only edit preserves bubble 2 camera and saved text across reloads');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
