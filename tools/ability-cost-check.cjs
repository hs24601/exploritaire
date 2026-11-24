const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('artifacts/ability-cost', { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1912, 914], [1280, 720], [390, 844], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('.battle-move').first().waitFor({ state: 'attached' });
      const table = page.getByRole('button', { name: 'Tableau', exact: true });
      if (await table.isVisible()) await table.click();
      assert.deepEqual(await page.locator('.battle-move__cost').allTextContents(), ['1 AP', '3 AP', '3 AP', '3+ AP', '1 AP', '4 AP', '7 AP']);
      for (let index = 0; index < await page.locator('.ability-tray').count(); index++) {
        await page.locator('.ability-tray').nth(index).evaluate((el, index) => el.id = `cost-tray-${index}`, index);
        assert.deepEqual(await findLayoutDefects(page, `#cost-tray-${index}`, { parts: '.battle-move, .battle-move__name, .battle-move__cost' }), []);
      }
      assert.ok(await page.locator('.battle-move__cost').evaluateAll(costs => costs.every(cost => Math.abs(cost.parentElement.getBoundingClientRect().right - cost.getBoundingClientRect().right - 2) < 1)));
      await page.screenshot({ path: `artifacts/ability-cost/${width}.png` });
      await page.locator('.ability-tray').first().evaluate(el => { el.style.transformOrigin = 'top left'; el.style.transform = 'scale(3)'; });
      await page.screenshot({ path: `artifacts/ability-cost/${width}-3x.png` });
      console.log(`${width} passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

