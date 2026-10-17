const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');
const objective = 'solve enough tableaus for Hero to recover energy for the day';
const questParts = '.quest-tray__toggle, .quest-discard-counter, .quest-tray__well, .quest-foundation, .quest-foundation__cards, .quest-card, .quest-card__title, .quest-card__text, .quest-card__reward';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1912, 914], [1280, 720]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:5178/proto.html');
      const card = page.locator('.quest-tray .quest-card');
      await card.waitFor();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.quest-tray').getAttribute('data-total'), '1');
      assert.equal(await card.locator('.quest-card__title').textContent(), 'Rest');
      assert.equal(await card.locator('.quest-card__text').textContent(), objective);
      assert.equal((await card.locator('.quest-card__reward').textContent()).trim(), '⚡ Energy');
      assert.equal(await page.locator('.quest-card-back').count(), 0);
      assert.ok(!(await page.locator('.quest-tray').textContent()).includes('Happy path'));
      assert.deepEqual(await findLayoutDefects(page, '.quest-tray', { parts: questParts, cornerInset: 12 }), []);
      await card.screenshot({ path: `artifacts/rest-card-${width}-3x.png` });
      if (width === 1912) await card.click(); else await card.tap();
      const note = page.locator('.quest-note');
      await note.waitFor();
      assert.equal(await note.locator('.quest-note__text').textContent(), objective);
      assert.equal((await note.locator('.quest-note__reward').textContent()).trim(), '⚡ Energy');
      assert.deepEqual(await findLayoutDefects(page, '.quest-note', { parts: '.pinned-toast__close, .pinned-toast h3, .pinned-toast p, .pinned-toast__icon' }), []);
      await note.screenshot({ path: `artifacts/rest-note-${width}-3x.png` });
      await page.screenshot({ path: `artifacts/rest-quest-${width}.png` });
      assert.equal(await page.locator('[data-table-quest]').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${width}x${height}: single Rest card, unquantified energy, ${width === 1912 ? 'mouse' : 'touch'} details, layout and console pass`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
