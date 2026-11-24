const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion });
      await page.goto((process.env.PROTO_URL ?? 'http://127.0.0.1:5201/proto.html') + '?combatsbx&scenario=1000');
      await page.locator('[data-status="duskscale"]').waitFor();
      assert.equal(await page.locator('[data-status-change]').count(), 0, 'initial statuses are quiet');
      await page.evaluate(() => {
        window.statusCueEvents = [];
        new MutationObserver(() => {
          document.querySelectorAll('[data-status-change]').forEach(el => {
            window.statusCueEvents.push(el.getAttribute('data-status-change'));
          });
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status-change'] });
      });
      await page.locator('.battle-end-turn').click();
      await page.mouse.move(3, 3);
      const gained = page.locator('[data-status="deep-breath"][data-status-change="gained"]');
      await gained.waitFor();
      const icon = page.locator('[data-status="deep-breath"]');
      await icon.hover();
      await page.waitForTimeout(250);
      assert.equal(await icon.evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
      fs.mkdirSync('artifacts/status-cues', { recursive: true });
      await page.screenshot({ path: `artifacts/status-cues/${reducedMotion}.png` });
      await page.mouse.move(3, 3);
      await page.waitForFunction(() => !document.querySelector('[data-status-change]'));
      const events = await page.evaluate(() => window.statusCueEvents);
      assert.ok(events.includes('gained') && events.includes('lost'), 'gain and loss cues observed');
      await page.close();
    }
    console.log('PASS: initial state, gain/loss, inspection pause, cleanup and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

