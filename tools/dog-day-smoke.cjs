const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: touch });
      page.on('pageerror', error => console.error('PAGE ERROR', error.stack));
      await page.goto((process.env.PROTO_URL ?? 'http://127.0.0.1:5201/proto.html') + '?combatsbx&scenario=1000');
      const buff = page.locator('button[data-status="every-dog-has-her-day"]');
      await buff.waitFor();
      assert.equal(await page.locator('.battle-pity-button').count(), 0);
      assert.equal(await buff.locator('b').textContent(), '3');
      for (const left of [2, 1, 0]) {
        if (touch) { await buff.tap(); if (await buff.count() && await buff.locator('b').textContent() !== String(left)) await buff.tap(); }
        else await buff.click();
        if (left) await page.waitForFunction(left => document.querySelector('[data-status="every-dog-has-her-day"] b')?.textContent === String(left), left);
        else await buff.waitFor({ state: 'detached' });
      }
      assert.equal(await buff.count(), 0);
      await page.mouse.move(3, 3);
      await page.locator('[data-status-change="lost"]').waitFor({ state: 'detached' });
      await page.keyboard.press('Escape');
      await page.getByLabel('Combat scenario', { exact: true }).selectOption('020');
      await page.waitForTimeout(500);
      require('node:fs').mkdirSync('artifacts/dog-day', { recursive: true });
      await page.screenshot({ path: `artifacts/dog-day/reset-${touch}.png` });
      assert.equal(await buff.locator('b').textContent(), '3');
      await page.close();
    }
    console.log('PASS: mouse/touch activation, three charges, buff removal at zero, no Pity Flip button, fresh-fight reset');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
