// Scenario 1005 Keru Invoke: opening hand, a drag invoke onto Hero, and the
// follow-up hand at 1 AP, with the shared layout check at desktop widths.
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const BASE = process.env.PROTO_URL || 'http://localhost:5178';
const OUT = 'artifacts/keru-invoke-1005';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  const report = [];
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height } }), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${BASE}/proto.html?combatsbx&scenario=1005`);
      const hero = page.locator('[data-battle-actor="hero"]');
      await hero.waitFor(); await page.waitForTimeout(1500);
      const heroValue = () => page.locator('[data-battle-actor="hero"] .battle-foundation__value').first().innerText();
      const before = await heroValue();
      await hero.click(); await page.locator('.ability-fan [data-draft-card]').first().waitFor(); await page.waitForTimeout(400);
      assert.equal(await page.locator('.ability-fan [data-draft-card]').count(), 5);
      assert.equal(await page.locator('.ability-fan .ability-fan__stored-value').count(), 5);
      assert.deepEqual([...new Set(await page.locator('.ability-fan [data-draft-card] .ability-fan__cost-value').allInnerTexts())], ['0']);
      const hand = await findLayoutDefects(page, '.ability-fan', { parts: '.ability-fan__card, .ability-fan__stored-value, .ability-fan__cost', minFontSize: 0 });
      await page.screenshot({ path: `${OUT}/${width}-opening-hand.png` });
      // Drag the first Keru onto Hero (hold, then move).
      const card = page.locator('.ability-fan [data-draft-card]').first(), stored = await card.locator('.ability-fan__stored-value').innerText();
      const from = await card.boundingBox(), to = await page.locator('[data-battle-target="hero"]').first().boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.waitForTimeout(400);
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up();
      await page.waitForTimeout(500);
      assert.equal(await heroValue(), stored, 'Hero takes the stored value');
      await page.locator('.battle-invoke-badge').waitFor();
      await page.getByRole('button', { name: 'Highlight' }).click(); await page.waitForTimeout(300);
      const legal = await page.evaluate(() => {
        const order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const rank = order.indexOf(document.querySelector('[data-battle-actor="hero"] .battle-foundation__value').textContent.trim()) + 1;
        const fronts = [...document.querySelectorAll('.battle-field__rack > .battle-field__column')].map(col => [...col.querySelectorAll('[data-battle-card]')].pop()).filter(Boolean);
        return fronts.map(node => ({ adjacent: [1, 12].includes(Math.abs(Number(node.dataset.battleRank) - rank)), legal: !node.hasAttribute('data-gameplay-disabled') && !node.hasAttribute('data-buried') }));
      });
      assert.ok(legal.every(entry => entry.adjacent === entry.legal), 'legal highlights follow the new value ' + JSON.stringify(legal));
      const party = await findLayoutDefects(page, '[data-team="party"]', { parts: '.battle-party-buffs, .battle-buff-icon, .battle-field__foundation', minFontSize: 0 });
      await page.screenshot({ path: `${OUT}/${width}-after-invoke.png` });
      await hero.click(); await page.locator('.ability-fan [data-draft-card]').first().waitFor(); await page.waitForTimeout(400);
      assert.deepEqual([...new Set(await page.locator('.ability-fan [data-draft-card] .ability-fan__cost-value').allInnerTexts())], ['1']);
      assert.equal(await page.locator('.ability-fan [data-draft-card][data-invoked]').count(), 1);
      assert.equal(await card.locator('.ability-fan__stored-value').innerText(), before, 'the Keru remembers Hero’s old value');
      const hand2 = await findLayoutDefects(page, '.ability-fan', { parts: '.ability-fan__card, .ability-fan__stored-value, .ability-fan__cost', minFontSize: 0 });
      await page.screenshot({ path: `${OUT}/${width}-hand-1ap.png` });
      report.push({ width, before, stored, handDefects: hand, partyDefects: party, hand1apDefects: hand2, errors });
      await page.close();
    }
  } finally { await browser.close(); console.log(JSON.stringify(report, null, 1)); }
})().catch(error => { console.error(error); process.exit(1); });
