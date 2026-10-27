const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const url = process.env.PROTO_URL || 'http://127.0.0.1:5194/proto.html';
  const output = 'artifacts/automatic-tile-spill';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('[data-tile-spill]').first().waitFor();
      for (const mode of ['flat', 'immersion']) {
        if (mode === 'immersion') await page.keyboard.press('Space');
        await page.waitForTimeout(800);
        for (const style of ['paint', 'pixel']) {
          await page.getByRole('button', { name: 'Game settings', exact: true }).click();
          await page.getByLabel('Art style', { exact: true }).selectOption(style);
          await page.getByRole('button', { name: 'Game settings', exact: true }).click();
          await page.waitForFunction(() => [...document.querySelectorAll('[data-tile-spill]')]
            .every(image => image.complete && image.naturalWidth > 0));
          const decals = await page.locator('[data-tile-spill]').evaluateAll(images => images.map(image => ({
            id: image.dataset.tileSpill, from: image.dataset.spillFrom, onto: image.dataset.spillOnto,
            relief: Number(image.dataset.spillRelief), src: image.src,
            input: getComputedStyle(image).pointerEvents, sampling: getComputedStyle(image).imageRendering,
          })));
          assert.equal(new Set(decals.map(d => d.id)).size, decals.length);
          assert.ok(decals.some(d => d.from === 'impassable-mountain' && d.onto === 'berry-patch'));
          assert.ok(decals.some(d => d.from === 'berry-patch' && d.onto === 'impassable-mountain'));
          assert.ok(decals.every(d => d.input === 'none' && d.sampling === (style === 'paint' ? 'auto' : 'pixelated')));
          assert.ok(decals.every(d => style === 'paint' ? d.src.includes('/watercolor/v1/') : d.src.includes('/spill/')));
          assert.ok(decals.filter(d => d.from === 'impassable-mountain' || d.from === 'hero-den')
            .every(d => d.relief === (mode === 'flat' ? 0 : 1)));
          await page.locator('.proto-map-viewport').screenshot({ path: `${output}/${width}-${mode}-${style}-3x.png` });
        }
        const positions = () => page.locator('[data-tile-spill]').evaluateAll(images => images
          .filter(image => image.dataset.spillFrom === 'impassable-mountain')
          .map(image => [image.dataset.tileSpill, image.style.left, image.style.top]));
        const before = await positions();
        await page.keyboard.press('e');
        await page.waitForTimeout(700);
        // OTT retries placement around the camera-facing printed labels.
        if (mode === 'immersion') assert.deepEqual(await positions(), before);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}x${height}: automatic mountain/berry spill, both cameras/styles, fixed anchors, passive input, loaded art`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
