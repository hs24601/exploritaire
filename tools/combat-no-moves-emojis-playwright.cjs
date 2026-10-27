const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  fs.mkdirSync('artifacts/combat-no-moves', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=003');
      const faces = page.locator('.battle-foundation__emoji');
      await faces.first().waitFor();
      assert.equal(await page.locator('.battle-field__column button:not([data-gameplay-disabled])').count(), 0);
      assert.deepEqual(await faces.evaluateAll(nodes => nodes.map(node => node.dataset.emotion)), ['upset', 'upset']);
      for (const actor of ['hero', 'mochi']) assert.deepEqual(await findLayoutDefects(page, `[data-battle-actor="${actor}"] .battle-foundation__emoji`, { parts: 'img,svg' }), []);
      await faces.first().screenshot({ path: `artifacts/combat-no-moves/upset-${width}-3x.png` });
      await page.getByRole('combobox', { name: 'Combat scenario', exact: true }).selectOption('001');
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-foundation__emoji')].every(node => node.dataset.emotion === 'happy'));
      assert.ok(await page.locator('.battle-field__column button:not([data-gameplay-disabled])').count() > 0);
      await page.getByRole('combobox', { name: 'Combat scenario', exact: true }).selectOption('003');
      await page.waitForFunction(() => [...document.querySelectorAll('.battle-foundation__emoji')].every(node => node.dataset.emotion === 'upset'));
      assert.deepEqual(errors, []);
      console.log(`${width}: blocked party upset, legal deal happy, reset upset, layout and runtime passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
