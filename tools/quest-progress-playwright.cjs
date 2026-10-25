const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('artifacts/quest-progress', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height, reducedMotion] of [[1280, 800, 'no-preference'], [390, 844, 'reduce']]) {
      if (process.env.CHECK_WIDTH && Number(process.env.CHECK_WIDTH) !== width) continue;
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
      page.setDefaultTimeout(30000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.waitForTimeout(5000);
      await page.getByRole('button', { name: /^Scenes/ }).click();
      await page.getByRole('complementary', { name: 'Tutorial scene tree' }).getByRole('button', { name: /Clear the den exit/ }).click();
      const close = page.getByRole('button', { name: 'Close scene tree' }); if (await close.count()) await close.click();
      const found = page.locator('.proto-tableau-field [data-found-quest="first-berry"]');
      await found.waitFor(); await found.click(); await found.waitFor({ state: 'detached' });
      await page.waitForFunction(() => [...document.querySelectorAll('.travel-free-layout [data-arrival-face]')].every(node => node.dataset.arrivalFace === 'up'));
      const progress = page.locator('.quest-subtask-deck__active [data-quest-progress-dock]');
      await page.screenshot({ path: `artifacts/quest-progress/before-play-${width}.png` });
      assert.equal(await progress.getAttribute('aria-valuenow'), '0');
      await page.evaluate(async reduced => {
        const { gameTime } = await import('/src/gameTime.ts');
        window.questClock = gameTime;
        gameTime.setPaused(false);
        window.berryStarts = 0;
        window.addEventListener('proto-quest-receipt-start', () => {
          if (document.querySelector('.quest-berry-receipt')) {
            window.berryStarts++;
            if (reduced) gameTime.setPaused(true);
            else gameTime.setTimeout(() => gameTime.setPaused(true), 80);
          }
        });
      }, reducedMotion === 'reduce');
      await page.getByRole('button', { name: 'Auto-S Tile', exact: true }).click();
      await page.waitForFunction(() => window.berryStarts === 1 && window.questClock.isPaused());
      assert.equal(await page.locator('.quest-berry-receipt').count(), 1);
      assert.equal(await progress.getAttribute('aria-valuenow'), '0', 'Count waits for berry arrival');
      assert.equal(await page.locator('.quest-subtask-deck').getAttribute('data-step-id'), 'first-berry');
      assert.equal(await page.locator('.quest-subtask-deck').getAttribute('data-phase'), 'idle', 'Completion waits for receipt');
      const before = await page.locator('.quest-berry-receipt').getAttribute('style');
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.quest-berry-receipt').getAttribute('style'), before, 'Pause freezes receipt');
      await page.screenshot({ path: `artifacts/quest-progress/berry-flight-${width}.png` });
      await page.evaluate(async () => {
        window.progressArrivals = [];
        new MutationObserver(() => { const dock = document.querySelector('.quest-subtask-deck__active [data-quest-progress-dock]'); if (dock) window.progressArrivals.push(dock.getAttribute('aria-valuenow')); }).observe(document.querySelector('.quest-subtask-deck'), { subtree: true, attributes: true, attributeFilter: ['aria-valuenow'] });
        (await import('/src/gameTime.ts')).gameTime.setPaused(false);
      });
      await page.locator('.quest-berry-receipt').waitFor({ state: 'detached' }).catch(async error => {
        console.log(await page.evaluate(() => ({ paused: window.questClock.isPaused(), starts: window.berryStarts, journeyPaused: document.querySelector('.travel-tableau')?.getAttribute('data-journey-paused'), progress: document.querySelector('[data-quest-progress-dock]')?.outerHTML, ghost: document.querySelector('.quest-berry-receipt')?.outerHTML })));
        throw error;
      });
      await page.waitForFunction(() => window.progressArrivals.includes('1'));
      assert.equal(await page.evaluate(() => window.berryStarts), 1, 'Exactly one berry receipt');
      await page.waitForFunction(() => document.querySelector('.quest-subtask-deck')?.dataset.stepId === 'denser-patch');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} ${reducedMotion}: accepted berry, delayed progress, completion ordering, pause and cleanup`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
