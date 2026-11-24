// 1012 Keru Upkeep: the opening (0 AP, so chip plays bank AP first), three Keru in
// Hero's familiar squares with the upkeep pips and unpaid warning, a drag-off
// dismissal with its farewell, and a square tap opening its card,
// with the shared layout check at desktop widths. Also glances at 1010's opening.
const { chromium } = require('playwright'); const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const BASE = process.env.PROTO_URL || 'http://localhost:5178';
const OUT = 'artifacts/keru-upkeep';
const url = id => `${BASE}/proto.html?combatsbx&scenario=${id}`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  const report = [];
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height } }), errors = [], entry = { width, errors };
      page.on('pageerror', e => errors.push(e.message));
      const openHand = async () => { if (await page.locator('.ability-fan [data-draft-card]').first().isVisible().catch(() => false)) return; await page.locator('[data-battle-actor="hero"]').click(); await page.locator('.ability-fan [data-draft-card]').first().waitFor(); await page.waitForTimeout(350); };
      const card = keru => page.locator(`.ability-fan [data-skill="familiar-${keru}"]`);
      const layout = (root, parts) => findLayoutDefects(page, root, { parts, minFontSize: 0 });
      // 1012 opens at 0 AP: play exposed tableau cards onto Hero (chip hits bank AP) until none is playable.
      const playChips = async () => { for (let i = 0; i < 8; i++) { const c = page.locator('button[data-component="playing-card"]:not([disabled])').first(); if (!await c.count()) break; await c.click(); await page.waitForTimeout(700); } };
      // Invoke by lifting the hand card, then dropping it on one of Hero's Keru squares.
      const invoke = async keru => { await openHand(); const a = await card(keru).boundingBox(), x = a.x + a.width / 2, y = a.y + a.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 18, { steps: 5 }); await page.locator(`[data-drag-draft="familiar-${keru}"]`).waitFor();
        const d = await page.locator('[data-battle-target^="familiar-square:hero:"]').first().boundingBox();
        await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(500); };

      await page.goto(url('1012')); await page.locator('[data-battle-actor="hero"]').waitFor(); await page.waitForTimeout(1200);
      entry.opening = { ap: await page.locator('[data-battle-actor="hero"] .battle-foundation__ap b').innerText(), notes: await page.locator('.scenario-notes, [class*="scenario-notes"]').count(),
        overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
      await page.screenshot({ path: `${OUT}/${width}-1012-opening.png` });

      // Bank AP from chip plays (the deal varies), then three invokes at 1 AP each against upkeep 3: the pips show it reserved, or short in red with starving squares.
      await playChips(); entry.chipAP = await page.locator('[data-battle-actor="hero"] .battle-foundation__ap').getAttribute('aria-valuenow');
      for (const keru of ['riv', 'cir', 'mochi']) await invoke(keru);
      if (await page.locator('.ability-fan-overlay').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      entry.pips = await page.locator('[data-battle-actor="hero"] .battle-foundation__ap-pips').evaluate(row => ({ label: row.getAttribute('aria-label'),
        pips: [...row.children].map(e => e.tagName === 'B' ? `[${e.textContent}]` : e.dataset.upkeep === 'reserved' ? 'R' : e.dataset.upkeep === 'short' ? 's' : e.dataset.on ? 'o' : '.').join('') }));
      entry.squares = await page.locator('.keru-square[data-keru-square]').evaluateAll(n => n.map(e => ({ keru: e.dataset.keruSquare, starving: Boolean(e.dataset.starving), cost: e.querySelector('.keru-square__upkeep')?.textContent })));
      entry.upkeep = await page.locator('[data-battle-actor="hero"] .battle-foundation__upkeep').evaluate(e => ({ text: e.textContent, label: e.getAttribute('aria-label'), short: Boolean(e.dataset.short) })).catch(() => null);
      entry.partyDefects = await layout('[data-team="party"]', '.keru-square, .keru-square__upkeep, .battle-foundation__ap, .battle-foundation__ap-head, .battle-foundation__ap-pips, .battle-foundation__upkeep, .battle-field__foundation');
      await page.screenshot({ path: `${OUT}/${width}-1012-three-keru.png` });

      // Drag Cir's familiar square off Hero: dismissal and its farewell bolt.
      const hpBefore = await page.locator('[data-team="enemy"] [data-battle-target]').first().getAttribute('aria-label');
      const square = page.locator('.keru-square[data-keru-square="cir"]'), box = await square.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, Math.max(20, box.y - 260), { steps: 10 }); await page.mouse.up();
      await page.waitForTimeout(250);
      entry.farewell = { toast: await page.locator('.keru-farewell-toast').innerText().catch(() => null), foe: await page.locator('.keru-farewell-foe').innerText().catch(() => null),
        left: await page.locator('.keru-square[data-keru-square]').evaluateAll(n => n.map(e => e.dataset.keruSquare)), hpBefore,
        hpAfter: await page.locator('[data-team="enemy"] [data-battle-target]').first().getAttribute('aria-label') };
      await page.screenshot({ path: `${OUT}/${width}-1012-farewell.png` });

      // A tap on a square opens its card.
      await page.waitForTimeout(1300);
      await page.locator('.keru-square[data-keru-square="mochi"]').click(); await page.waitForTimeout(300);
      entry.jumbo = await page.locator('.card-jumbo').count();
      await page.screenshot({ path: `${OUT}/${width}-1012-card.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);

      if (process.env.SKIP_1010) { report.push(entry); await page.close(); continue; }
      // 1010 still opens with its harness.
      await page.goto(url('1010')); await page.locator('[data-battle-actor="hero"]').waitFor(); await page.waitForTimeout(1200);
      entry.opening1010 = { ap: await page.locator('[data-battle-actor="hero"] .battle-foundation__ap b').innerText(), seal: await page.locator('.keru-seal__label').innerText().catch(() => null) };
      await page.screenshot({ path: `${OUT}/${width}-1010-opening.png` });
      report.push(entry); await page.close();
    }
  } finally { await browser.close(); console.log(JSON.stringify(report, null, 1)); }
})().catch(error => { console.error(error); process.exit(1); });
