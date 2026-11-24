const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: {width:1280,height:720}, hasTouch:touch });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      const arena = page.locator('.combat-demo__arena');
      const positions = async () => JSON.parse(await arena.getAttribute('data-actors')).map(actor => actor.position);
      const initial = await positions();
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      await page.waitForTimeout(2200);
      assert.deepEqual(await positions(), initial, 'Actors stay in their starting positions after the sweep');
      assert.equal(await page.locator('.combat-demo').getAttribute('data-elapsed'), '0.0');
      assert.equal(await arena.getAttribute('data-action-started'), 'false');
      assert.equal(await arena.getAttribute('data-camera-position'), '-10.000,5.200,7.500');
      const cinematic = page.locator('[data-view="cinematic"]');
      if (touch) await cinematic.tap(); else await cinematic.click();
      assert.equal(await arena.getAttribute('data-action-started'), 'true');
      await page.waitForFunction(() => Number(document.querySelector('.combat-demo')?.dataset.elapsed) > 4.5);
      assert.notDeepEqual(await positions(), initial, 'Explicit Cinematic starts the battle action');
      if (touch) await cinematic.tap(); else await cinematic.click();
      assert.ok(Number(await page.locator('.combat-demo').getAttribute('data-elapsed')) < .5, 'Cinematic restarts its own clock');
      await context.close();
      console.log(`${touch ? 'Touch' : 'Mouse'}: entry sweep stays idle; Cinematic starts and restarts action`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
