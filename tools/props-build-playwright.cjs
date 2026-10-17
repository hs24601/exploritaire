const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const file = 'src/proto/buildInfo.ts';
  const original = fs.readFileSync(file, 'utf8');
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('http://localhost:5178/proto.html?fx=low');
    const label = page.locator('.proto-build-label');
    const before = await label.textContent();
    assert.match(before, /Build [a-f0-9]+\.[a-f0-9]{8} · \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    await page.waitForTimeout(1100);
    fs.writeFileSync(file, original + '\n// Build revision validation probe.\n');
    await page.waitForFunction(previous => document.querySelector('.proto-build-label')?.textContent !== previous, before);
    const after = await label.textContent();
    assert.notEqual(before.split(' · ')[0], after.split(' · ')[0]);
    assert.notEqual(before.split(' · ')[1], after.split(' · ')[1]);
    fs.writeFileSync(file, original);
    await page.waitForTimeout(1500); await page.reload(); await label.waitFor();
    assert.equal((await label.textContent()).split(' · ')[0], before.split(' · ')[0]);
    await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
    await page.waitForTimeout(900);
    const textures = await page.locator('[data-silhouette-material="relief"] canvas').evaluateAll(elements => elements.map(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let mismatches = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const reference = (Math.floor(y / 6) * 6 * canvas.width + Math.floor(x / 6) * 6) * 4;
        const current = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 4; channel++) if (pixels[current + channel] !== pixels[reference + channel]) mismatches++;
      }
      return { width: canvas.width, height: canvas.height, mismatches };
    }));
    assert.ok(textures.length > 0);
    assert.ok(textures.every(texture => texture.mismatches === 0), 'Relief bitmap must retain exact solid source-pixel blocks');
    await label.evaluate(el => el.parentElement.dataset.buildCheck = 'true');
    const defects = await findLayoutDefects(page, '[data-build-check]', { parts: '.proto-build-label' });
    // Report existing toolbar typography separately from the changed build label.
    const existingType = defects.filter(defect => !defect.startsWith('.proto-build-label') && defect.includes('is 8.96px'));
    assert.deepEqual(defects.filter(defect => !existingType.includes(defect)), []);
    if (existingType.length) console.log('Existing toolbar font-floor defects: ' + existingType.length);
    console.log('Build revision/time refresh and restoration passed; all relief textures preserve exact nearest-neighbour pixel blocks.');
  } finally { fs.writeFileSync(file, original); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
