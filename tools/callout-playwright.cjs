const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.CALLOUT_PREVIEW_URL || 'http://127.0.0.1:5186'}/tools/callout-preview.html`);
      await page.locator('.proto-callout').first().waitFor();
      await page.waitForTimeout(200);
      const bubbles = await page.locator('.proto-callout').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
          below: node.dataset.below, animation: getComputedStyle(node.firstElementChild).animationName,
          pointerEvents: getComputedStyle(node).pointerEvents };
      }));
      assert.equal(bubbles.length, 2);
      for (const bubble of bubbles) {
        assert(bubble.x >= 11 && bubble.right <= width - 11);
        assert(bubble.y >= 11 && bubble.bottom <= 789);
        assert.equal(bubble.animation, 'none');
        assert.equal(bubble.pointerEvents, 'none');
      }
      assert.equal(bubbles[0].below, 'true');
      await page.getByRole('button', { name: 'Speak' }).click();
      await page.getByRole('button', { name: 'Speak' }).click();
      assert.equal(await page.locator('.proto-callout').count(), 3, 'same speaker replaces existing message');
      const moving = page.locator('.proto-callout').last();
      const before = await moving.boundingBox();
      await page.waitForTimeout(250);
      const after = await moving.boundingBox();
      assert.notEqual(before.y, after.y, 'live anchor follows without rerender');
      await page.screenshot({ path: `artifacts/callout-${width}.png` });
      await page.waitForTimeout(5100);
      assert.equal(await page.locator('.proto-callout').count(), 2, 'expiry removes message');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Callout: viewport fit, flip, reduced motion, input passthrough, replacement, tracking and expiry passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
