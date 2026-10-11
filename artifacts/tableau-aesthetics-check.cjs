const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('../tools/lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3, hasTouch: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost:5178/proto.html');
      await page.locator('.proto-tableau-stage .playing-card').first().waitFor();
      await page.waitForTimeout(1000);
      const cards = page.locator('.proto-tableau-stage .playing-card');
      for (let i = 0; i < await cards.count(); i++) {
        await cards.nth(i).evaluate((el, i) => el.id = `aesthetic-card-${i}`, i);
        assert.deepEqual(await findLayoutDefects(page, `#aesthetic-card-${i}`, { parts: '.proto-card-header, .proto-card-rank, .proto-card-icon' }), []);
      }
      assert.deepEqual(await cards.evaluateAll(cards => cards.flatMap(el => {
        const card = el.getBoundingClientRect(), row = el.querySelector('.proto-card-header').getBoundingClientRect();
        const next = el.nextElementSibling?.matches('.playing-card') ? el.nextElementSibling : null;
        const defects = [];
        if (row.left - card.left < 8 || card.right - row.right < 8 || row.top - card.top < 7) defects.push('Insufficient header inset');
        if (next && row.bottom > next.getBoundingClientRect().top - 2) defects.push('Header covered by next card');
        if (Math.abs(card.width / card.height - 56 / 74) > .01) defects.push('Distorted card');
        return defects;
      })), []);
      await page.locator('.proto-tableau-stage').screenshot({ path: `artifacts/tableau-polished-${width}-3x.png` });
      const playable = page.locator('.proto-tableau-stage .playing-card:not(:disabled)').first();
      if (width === 1280) await playable.tap(); else await playable.click();
      await page.waitForTimeout(700);
      assert.deepEqual(errors, []);
      console.log(`${width}: header layout, padding, card proportions, ${width === 1280 ? 'touch' : 'mouse'} activation and console passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
