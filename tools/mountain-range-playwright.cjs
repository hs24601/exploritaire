const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

async function checkPrint(page) {
  const result = await page.locator('[data-connected-terrain]').evaluate(async svg => {
    const clone = svg.cloneNode(true);
    const source = await (await fetch(clone.querySelector('image').getAttribute('href'))).text();
    for (const image of clone.querySelectorAll('image')) image.setAttribute('href', `data:image/svg+xml;base64,${btoa(source)}`);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 288;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 720, 288).data;
    let holes = 0, outerTransparent = 0;
    for (let y = 0; y < 288; y++) for (let x = 0; x < 720; x++) {
      const alpha = pixels[(y * 720 + x) * 4 + 3];
      if (x >= 24 && x < 696 && y >= 24 && y < 264 && !(x >= 336 && x < 384 && y < 48) && alpha !== 255) holes++;
      if ((x < 24 || x >= 696 || y < 24 || y >= 264) && alpha === 0) outerTransparent++;
    }
    return { holes, outerTransparent, corner: pixels[3], den: pixels[(24 * 720 + 360) * 4 + 3] };
  });
  assert.equal(result.holes, 0, 'No transparent interior gutters or holes');
  assert.ok(result.outerTransparent > 0, 'Keep the outside rocky silhouette transparent');
  assert.equal(result.corner, 0);
  assert.equal(result.den, 0, 'The den notch is clear of mountain artwork');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL); await page.locator('[data-connected-terrain]').waitFor();
      assert.equal(await page.locator('[data-biome-id="hero-den"]').getAttribute('data-grid-reference'), 'table:0,2');
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,2');
      assert.equal(await page.locator('[data-biome-id="mountain-0-2"]').count(), 0);
      assert.equal(await page.locator('[data-tile-type="impassable-mountain"]').count(), 89);
      assert.equal(await page.locator('[data-connected-terrain] image').count(), 89);
      await checkPrint(page);
      const map = await page.locator('.proto-map-viewport').boundingBox();
      const x = map.x + map.width * .55, y = map.y + map.height * .55;
      await page.mouse.move(x, y); await page.mouse.wheel(0, 550); await page.waitForTimeout(300);
      await page.mouse.down({ button: 'right' }); await page.mouse.move(x, y - 160, { steps: 8 }); await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `artifacts/mountain-connected-${width}-flat-3x.png` });
      await page.keyboard.press('Space');
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('[data-connected-terrain]').count(), 0, 'Overhead peaks disappear in immersion');
      const mountains = page.locator('[data-biome-popup^="mountain-"]');
      assert.equal(await mountains.count(), 89, 'Every mountain has an upright prop');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-biome-popup^="mountain-"]')].every(el => el.querySelector('.proto-sprite-standee__art')));
      assert.ok(await mountains.evaluateAll(els => els.every(el => +el.dataset.sceneryWidth > 48)), 'Mountain faces overlap neighboring cells');
      for (let turn = 0; turn < 4; turn++) {
        assert.equal(await mountains.count(), 89);
        assert.equal(await page.locator('[data-immutable-region]').count(), 3);
        assert.deepEqual(await findLayoutDefects(page, '[data-immutable-region]', { parts: '.proto-tile-title', minFontSize: 0 }), []);
        assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
        if (turn < 2) await page.screenshot({ path: `artifacts/mountain-connected-${width}-tilt-${turn * 45}-3x.png` });
        await page.keyboard.press('e'); await page.waitForTimeout(450);
      }
      assert.deepEqual(errors, []); await page.close();
      console.log(`${width}: opaque connected interior, transparent outside, 89 overlapping upright mountains and title/toolbar layout passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
