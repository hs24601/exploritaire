const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const authored = require('../src/data/questCardEdits.json');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion });
      page.setDefaultTimeout(20000);
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.waitForTimeout(5000);
      await page.getByRole('button', { name: /^Scenes/ }).click();
      await page.getByRole('complementary', { name: 'Tutorial scene tree' }).getByRole('button', { name: /Clear the den exit/ }).click();
      const closeTree = page.getByRole('button', { name: 'Close scene tree' });
      if (await closeTree.count()) await closeTree.click();
      const found = page.locator('.proto-tableau-field [data-found-quest="first-berry"]');
      await found.waitFor();
      await page.waitForTimeout(2500);
      const cards = page.locator('.travel-free-layout [data-arrival-face]');
      assert((await cards.count()) > 0);
      assert((await cards.evaluateAll(nodes => nodes.every(node => node.dataset.arrivalFace === 'down'))), 'All berry values remain hidden before docking');
      assert((await found.textContent()).includes(authored['tutorial:day01.tutorial:first-berry'].title), 'World pickup uses authored title');
      assert((await found.textContent()).includes(authored['tutorial:day01.tutorial:first-berry'].text), 'World pickup uses authored text');
      await page.evaluate(() => {
        window.berryFlightLeaks = [];
        new MutationObserver(() => {
          const pickup = document.querySelector('.proto-tableau-field [data-found-quest="first-berry"]');
          if (pickup && [...document.querySelectorAll('.travel-free-layout [data-arrival-face]')].some(node => node.dataset.arrivalFace !== 'down')) window.berryFlightLeaks.push('Revealed before docking');
        }).observe(document.querySelector('.proto-tableau-field'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-arrival-face'] });
      });
      await found.focus();
      await page.keyboard.press('Enter');
      await found.waitFor({ state: 'detached' });
      await page.waitForFunction(() => [...document.querySelectorAll('.travel-free-layout [data-arrival-face]')].every(node => node.dataset.arrivalFace === 'up'), null, { timeout: 20000 });
      assert.deepEqual(await page.evaluate(() => window.berryFlightLeaks), [], 'Pickup flight keeps values hidden');
      console.log(`PASS berry quest concealment, dock reveal and authored world preview: ${reducedMotion}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
