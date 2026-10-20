const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const out = 'artifacts/quest-receipt'; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const reducedMotion of process.env.QUEST_MOTION ? [process.env.QUEST_MOTION] : ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html?khad-roots-exposed');
      await page.waitForSelector('[data-travel-card]', { timeout: 60000 }).catch(async e => { await page.screenshot({path:out+'/failure.png'}); console.log(errors, await page.locator('body').innerText()); throw e; });
      console.log('Loaded', reducedMotion);
      await page.evaluate(() => {
        window.questReceipts = 0;
        window.addEventListener('proto-actor-received', () => window.questReceipts++);
      });
      for (let i = 0; i < 2; i++) {
        await page.locator('[data-travel-card]:not([data-buried]):not([data-gameplay-disabled])').first().click();
        if (i === 1 && reducedMotion === 'no-preference') {
          await page.waitForFunction(() => document.querySelector('.quest-subtask-deck')?.dataset.phase === 'check');
          await page.waitForTimeout(220);
          const progress = await page.evaluate(async () => {
            const { gameTime } = await import('/src/gameTime.ts'); gameTime.setPaused(true);
            return document.querySelector('.quest-subtask-deck').style.getPropertyValue('--quest-check-progress');
          });
          assert.ok(Number(progress) > 0 && Number(progress) < 1, 'Check is being painted over time');
          assert.equal(await page.locator('.quest-subtask-deck .quest-completion-check').evaluate(el => getComputedStyle(el).visibility), 'visible');
          await page.screenshot({ path: `${out}/painted-check.png` });
          await page.waitForTimeout(200);
          assert.equal(await page.locator('.quest-subtask-deck').evaluate(el => el.style.getPropertyValue('--quest-check-progress')), progress, 'Brushstroke freezes during pause');
          await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(false));
          await page.waitForSelector('.quest-completion-flight');
          await page.waitForFunction(() => document.querySelector('.quest-subtask-deck')?.dataset.phase === 'receive');
          const rotation = await page.evaluate(async () => {
            (await import('/src/gameTime.ts')).gameTime.setPaused(true);
            const matrix = new DOMMatrix(getComputedStyle(document.querySelector('.quest-completion-flight')).transform);
            return { x: matrix.m11, y: matrix.m22 };
          });
          assert.ok(rotation.x < 0 && rotation.y > 0, 'Turned face-down without turning the card upside-down');
          await page.screenshot({ path: `${out}/face-down-flight.png` });
          await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(false));
        }
        await page.waitForTimeout(800);
      }
      const pickup = page.locator('[data-found-quest="denser-patch"]:not([data-flying])');
      await pickup.waitFor();
      await page.waitForFunction(() => window.questReceipts === 1);
      assert.equal(await page.locator('.quest-subtask-deck__burn').count(), 0);
      assert.equal(await page.locator('.proto-callout').count(), 0, 'No dialogue before pickup');
      const before = await pickup.boundingBox();
      await page.waitForTimeout(2500);
      const after = await pickup.boundingBox();
      assert.ok(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, 'Pickup remains anchored after arrival');
      await page.screenshot({ path: `${out}/waiting-${reducedMotion}.png` });
      await pickup.click();
      const deck = page.locator('.quest-subtask-deck[data-step-id="denser-patch"]');
      await page.waitForFunction(() => !document.querySelector('[data-found-quest="denser-patch"]'));
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.proto-callout').count(), 0, 'Jumbo inspection still holds dialogue');
      assert.ok(await deck.getAttribute('data-map-jumbo'));
      assert.ok((await deck.locator('img').first().getAttribute('src')).includes('khad-roots-berry-bush-night-paint-v1'));
      await page.screenshot({ path: `${out}/jumbo-${reducedMotion}.png` });
      await deck.locator('button.quest-card').click();
      await page.waitForFunction(() => !document.querySelector('.quest-subtask-deck[data-presentation-flight]'));
      await page.waitForSelector('.proto-callout');
      assert.equal(await deck.getAttribute('data-map-jumbo'), null);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/docked-${reducedMotion}.png` });
      await page.close();
    }
    console.log('PASS: normal/reduced completion receipt, stable exposed pickup, new art, and callout after docking.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
