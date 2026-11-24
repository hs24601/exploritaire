const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: touch });
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.getByRole('checkbox', { name: 'maxAP', exact: true }).check();
      await page.getByRole('button', { name: 'Nip', exact: true }).click();
      const card = page.locator('.ability-card-popover .ability-card');
      const target = page.locator('[data-battle-target="dark-slime"]');
      const source = await card.boundingBox(), box = await target.boundingBox();
      // The pointer stays below the foundation; only the card's top overlaps.
      const x = box.x + box.width / 2, y = box.y + box.height + 90;
      if (touch) {
        const session = await page.context().newCDPSession(page);
        const send = (type, points) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        await send('touchStart', [{ x: source.x + source.width / 2, y: source.y + source.height / 2 }]);
        await send('touchMove', [{ x, y }]);
        await page.waitForTimeout(100);
        assert.equal(await target.getAttribute('data-preview'), 'focus');
        await send('touchEnd', []);
      } else {
        await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await page.mouse.down();
        await page.mouse.move(x, y, { steps: 8 });
        assert.equal(await target.getAttribute('data-preview'), 'focus');
        await page.mouse.up();
      }
      await page.waitForTimeout(100);
      assert.match(await target.getAttribute('aria-label'), /13 of 14 HP/);
      assert.equal(await page.locator('.ability-card-popover').count(), 0);
      console.log(touch ? 'Touch card-edge drop passed' : 'Mouse card-edge drop passed');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
