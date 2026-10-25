// combatsbx party row at desktop sizes: the Momentum gauge floats in its own
// overlay, the three foundations (Hero, Mochi, the inert empty well) share one
// centered row at the same height and size, and turn controls stay on screen.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

(async () => {
  fs.mkdirSync('artifacts/combat-team-layout', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');
      await page.locator('.momentum-engine').waitFor();
      assert.equal(await page.locator('.battle-momentum-overlay .momentum-engine').count(), 1);
      assert.equal(await page.locator('[data-team="party"] .momentum-engine').count(), 0);
      const slots = await page.locator('[data-team="party"] .battle-field__foundation').evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, actor: el.dataset.battleActor };
      }));
      assert.deepEqual(slots.map(slot => slot.actor), ['hero', 'mochi', undefined]);
      assert.ok(slots.every(slot => Math.abs(slot.top - slots[0].top) < 2 && Math.abs(slot.bottom - slots[0].bottom) < 2), 'foundations share one row and height');
      assert.ok(slots[1].left > slots[0].right && slots[2].left > slots[1].right, 'foundations in party order without overlap');
      const rack = await page.locator('.battle-field__rack').boundingBox();
      assert.ok(Math.abs((slots[0].left + slots[2].right) / 2 - (rack.x + rack.width / 2)) < 2, 'party row centered under the tableau');
      assert.equal(await page.getByRole('img', { name: 'Empty player foundation' }).count(), 1);
      for (const name of ['WITHDRAW', 'END TURN', 'Restart']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${name} inside the viewport`);
      }
      await page.screenshot({ path: `artifacts/combat-team-layout/${width}.png` });
      assert.deepEqual(errors, []);
      console.log(width, 'floating gauge, three centered foundations, inert empty slot, controls within viewport passed');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
