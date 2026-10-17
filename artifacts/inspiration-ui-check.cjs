const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto('http://127.0.0.1:5178/proto.html');
      assert.equal(response.status(), 200);
      assert.match(await page.locator('.proto-ordinary-day').innerText(), /INSP 6\/6/);
      assert.doesNotMatch(await page.locator('body').innerText(), /stamina|\bSTA\b/i);
      assert.deepEqual(await findLayoutDefects(page, '.proto-ordinary-day', { parts: 'strong,.proto-ordinary-day__thought > span,.proto-ordinary-day__actions > span,button' }), []);
      await page.locator('.proto-ordinary-day').screenshot({ path: `artifacts/inspiration-day-${width}-3x.png` });
      await page.locator('[data-board-piece="actor"]').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('.details-card-viewer').first().click();
      await page.locator('[data-chip="inspiration"]').waitFor();
      assert.match(await page.locator('[data-chip="inspiration"]').getAttribute('aria-label'), /^Inspiration: 4 of 4$/);
      await page.locator('.trading-card__chips').screenshot({ path: `artifacts/inspiration-stats-${width}-3x.png` });
      await page.getByRole('button', { name: 'Playtest values', exact: true }).click();
      await page.getByLabel('Inspiration reserve max', { exact: true }).fill('10');
      await page.getByLabel('Inspiration reserve current', { exact: true }).fill('7');
      await page.getByLabel('Foundation inspiration max', { exact: true }).fill('8');
      await page.getByLabel('Foundation inspiration current', { exact: true }).fill('5');
      await page.getByRole('button', { name: 'Apply', exact: true }).tap();
      await page.getByText('Applied to this session.').waitFor();
      assert.deepEqual(await findLayoutDefects(page, '.actor-playtest-panel', { parts: 'h2,p,input,button,.actor-playtest-grid > span,.actor-playtest-row > span' }), []);
      await page.locator('.actor-playtest-panel').screenshot({ path: `artifacts/inspiration-editor-${width}-3x.png` });
      await page.getByRole('button', { name: 'Back to card' }).click();
      assert.equal(await page.locator('[data-chip="inspiration"]').getAttribute('aria-label'), 'Inspiration: 5 of 8');
      assert.match(await page.locator('.proto-ordinary-day').innerText(), /INSP 7\/10/);
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      const redraw = page.locator('[data-redraw-actor="hero"]');
      assert.match(await redraw.getAttribute('aria-label'), /1 inspiration.*4 inspiration left/);
      await redraw.click();
      assert.match(await redraw.getAttribute('aria-label'), /3 inspiration left/);
      await page.locator('.battle-field__team[data-team="party"]').screenshot({ path: `artifacts/inspiration-battle-${width}-3x.png` });
      assert.deepEqual(errors, []);
      console.log(`${width}: terminology, both edited pools, redraw and layout passed; build ${await page.locator('.proto-build-label').innerText()}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
