// Keru rarity (1006–1010): feed drags to each tier in 1006, a mid-flourish
// frame, an invoke drag, the 1005 value chip beside the AP coin, the 1007–1010
// openings and a 1010 seal pour, with the shared layout check at desktop widths.
const { chromium } = require('playwright'); const assert = require('node:assert/strict'); const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const BASE = process.env.PROTO_URL || 'http://localhost:5178';
const OUT = 'artifacts/keru-rarity';
const url = id => `${BASE}/proto.html?combatsbx&scenario=${id}`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  const report = [];
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height } }), errors = [], entry = { width, errors };
      page.on('pageerror', e => errors.push(e.message));
      const openHand = async () => { await page.locator('[data-battle-actor="hero"]').click(); await page.locator('.ability-fan [data-draft-card]').first().waitFor(); await page.waitForTimeout(350); };
      const card = keru => page.locator(`.ability-fan [data-skill="familiar-${keru}"]`);
      const drag = async (from, to, hold = 0) => {
        const a = await from.boundingBox(), b = await to.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); if (hold) await page.waitForTimeout(hold);
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
      };
      const feed = async (keru, n) => { for (let i = 0; i < n; i++) { await drag(page.locator('.keru-feed-coin[data-feed-source]'), card(keru)); await page.waitForTimeout(120); } };
      const layout = (root, parts) => findLayoutDefects(page, root, { parts, minFontSize: 0 });

      // 1006: Common hand, then feeds to Rare / Epic / Legendary across two turns.
      await page.goto(url('1006')); await page.locator('[data-battle-actor="hero"]').waitFor(); await page.waitForTimeout(1200);
      await openHand();
      assert.deepEqual(await page.locator('.ability-fan [data-draft-card]').evaluateAll(n => n.map(e => e.dataset.rarity)), ['common', 'common', 'common', 'common', 'common']);
      await page.screenshot({ path: `${OUT}/${width}-1006-common.png` });
      await drag(page.locator('.keru-feed-coin[data-feed-source]'), card('dem'));
      await page.waitForTimeout(250);
      entry.flourish = await card('dem').getAttribute('data-evolving');
      await page.screenshot({ path: `${OUT}/${width}-1006-flourish.png` });
      assert.equal(await card('dem').getAttribute('data-rarity'), 'rare', 'one feed drag reaches Rare');
      await feed('mochi', 3); await feed('riv', 2);
      assert.equal(await card('mochi').getAttribute('data-rarity'), 'epic');
      await page.locator('.ability-fan__close').click(); await page.waitForTimeout(300);
      await page.locator('.battle-end-turn').first().click();
      await page.waitForFunction(() => /AP 6/.test(document.querySelector('[data-battle-actor="hero"] .battle-foundation__ap')?.textContent ?? ''), null, { timeout: 15000 });
      await page.waitForTimeout(600);
      await openHand(); await feed('riv', 4);
      assert.deepEqual(await page.locator('.ability-fan [data-draft-card]').evaluateAll(n => n.map(e => e.dataset.rarity)), ['rare', 'common', 'epic', 'legendary', 'common']);
      entry.handDefects = await layout('.ability-fan', '.ability-fan__card, .ability-fan__stored-value, .ability-fan__cost, .keru-rarity-progress');
      entry.minFooterFont = await page.locator('.keru-rarity-progress').evaluateAll(n => Math.min(...n.map(e => parseFloat(getComputedStyle(e).fontSize))));
      await page.screenshot({ path: `${OUT}/${width}-1006-all-tiers.png` });
      // Invoke drag: the Legendary Riv onto Hero.
      await drag(card('riv'), page.locator('[data-battle-target="hero"]').first(), 400); await page.waitForTimeout(500);
      assert.equal(await page.locator('.keru-harness__slot[data-invoked-keru="riv"]').getAttribute('data-rarity'), 'legendary');
      entry.partyDefects = await layout('[data-team="party"]', '.battle-party-buffs, .battle-buff-icon, .battle-field__foundation');
      await page.screenshot({ path: `${OUT}/${width}-1006-invoked.png` });

      // 1005: the stored-value chip sits beside the card's AP coin.
      await page.goto(url('1005')); await page.locator('[data-battle-actor="hero"]').waitFor(); await page.waitForTimeout(1200); await openHand();
      entry.chip1005 = await page.locator('.ability-fan [data-draft-card]').first().evaluate(c => { const v = c.querySelector('.ability-fan__stored-value').getBoundingClientRect(), a = c.querySelector('.ability-fan__cost').getBoundingClientRect(); return { gap: Math.round(a.left - v.right), overlap: Math.min(v.right, a.right) > Math.max(v.left, a.left) && Math.min(v.bottom, a.bottom) > Math.max(v.top, a.top), dy: Math.round((v.top + v.height / 2) - (a.top + a.height / 2)) }; });
      entry.hand1005Defects = await layout('.ability-fan', '.ability-fan__card, .ability-fan__stored-value, .ability-fan__cost');
      await page.screenshot({ path: `${OUT}/${width}-1005-value-chip.png` });

      // 1007–1010 openings, with the notes panel.
      entry.openings = {};
      for (const id of ['1007', '1008', '1009', '1010']) {
        await page.goto(url(id)); await page.locator('[data-battle-actor="hero"]').waitFor(); await page.waitForTimeout(1200);
        entry.openings[id] = { ap: await page.locator('[data-battle-actor="hero"] .battle-foundation__ap b').innerText(), notes: await page.locator('.scenario-notes, [class*="scenario-notes"]').count(),
          overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
        await page.screenshot({ path: `${OUT}/${width}-${id}-opening.png` });
      }
      // 1010: pour 1 AP onto the Warden from the feed coin.
      await openHand();
      await drag(page.locator('.keru-feed-coin[data-feed-source]'), page.locator('[data-team="enemy"] [data-battle-target]').first()); await page.waitForTimeout(250);
      entry.seal = await page.locator('.keru-seal__label').innerText();
      await page.locator('.ability-fan__close').click(); await page.waitForTimeout(300);
      entry.sealDefects = await layout('[data-team="enemy"]', '.keru-seal, .keru-seal__label, .keru-seal__pour');
      await page.screenshot({ path: `${OUT}/${width}-1010-poured.png` });
      report.push(entry); await page.close();
    }
  } finally { await browser.close(); console.log(JSON.stringify(report, null, 1)); }
})().catch(error => { console.error(error); process.exit(1); });
