const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 500 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      const field = page.locator('.battle-field');
      await field.getByRole('button', { name: 'Auto-Solve', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.battle-field')?.dataset.result, { timeout: 30000 });
      assert.equal(await field.getAttribute('data-result'), 'won');
      await field.getByRole('button', { name: 'Auto-Solve', exact: true }).waitFor();
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.getByRole('checkbox', { name: 'Follow traveling actor' }).uncheck();
      const actor = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const berry = await page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]').boundingBox();
      assert(actor && berry);
      await page.mouse.move(actor.x + actor.width / 2, actor.y + actor.height / 2);
      await page.mouse.down();
      await page.mouse.move(berry.x + berry.width / 2, berry.y + berry.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.getByRole('button', { name: 'Confirm travel', exact: true }).click();
      const tab = page.getByRole('button', { name: 'Tableau', exact: true });
      if (await tab.isVisible()) await tab.click();
      const travel = page.locator('.travel-tableau');
      await travel.getByRole('button', { name: 'Pause journey' }).click();
      assert(await travel.getByRole('button', { name: 'Auto-Solve', exact: true }).isDisabled());
      await travel.getByRole('button', { name: 'Resume journey' }).click();
      await travel.getByRole('button', { name: 'Best Move', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.travel-summary strong')?.textContent.includes('1/'));
      await travel.getByRole('button', { name: 'Auto-Solve', exact: true }).click();
      await travel.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
      console.log('PASS battle victory and travel auto-solve', viewport.width);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
