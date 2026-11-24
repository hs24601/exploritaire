const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

(async () => {
  fs.mkdirSync('artifacts/combat-inspection', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height, touch] of [[1280,720,false],[390,844,true],[844,390,true]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=005');
      const buff = page.locator('[data-buff="ironbark"]');
      await buff.waitFor();
      const clock = () => page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.now());
      if (touch) await buff.tap(); else await buff.hover();
      await page.locator('.combat-inspection').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-global-paused'), 'true');
      await page.waitForSelector('[data-value-concealed="true"]');
      assert.equal(await page.locator('[data-value-concealed="true"]').count() > 0, true);
      const time = await clock(); await page.waitForTimeout(300); assert.equal(await clock(), time);
      assert.match(await page.locator('.combat-inspection').innerText(), /Ironbark/);
      assert.deepEqual(await findLayoutDefects(page, '.combat-inspection', { parts: ':scope > *' }), []);
      const anchor = await buff.boundingBox(), tooltip = await page.locator('.combat-inspection').boundingBox();
      assert.ok(tooltip.x >= 0 && tooltip.y >= 0 && tooltip.x + tooltip.width <= width && tooltip.y + tooltip.height <= height, 'tooltip fits viewport');
      const verticalGap = Math.max(0, tooltip.y - anchor.y - anchor.height, anchor.y - tooltip.y - tooltip.height);
      assert.ok(verticalGap <= 9, 'tooltip sits beside the inspected element');
      assert.equal(await page.locator('.combat-inspection').getAttribute('role'), 'tooltip');
      await page.screenshot({ path: `artifacts/combat-inspection/${width}.png`, scale: 'css' });
      await page.locator('.combat-inspection').screenshot({ path: `artifacts/combat-inspection/${width}-3x.png` });
      if (touch) await page.touchscreen.tap(2, 2);
      else await page.mouse.move(0, 0);
      await page.waitForFunction(() => !document.documentElement.dataset.globalPaused);
      assert.equal(await page.locator('[data-value-concealed="true"]').count(), 0);
      // A separately chosen pause must survive inspecting and dismissing a buff.
      await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(true));
      if (touch) await buff.tap({ force: true }); else await buff.hover();
      await page.locator('.combat-inspection').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('html').getAttribute('data-global-paused'), 'true');
      await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(false));
      if (!touch) {
        await page.mouse.move(0, 0);
        await page.getByRole('button', { name: 'Open Momentum abilities', exact: true }).click();
        const ability = page.locator('[data-skill="withdraw"]');
        await ability.hover();
        await page.locator('.combat-inspection').waitFor();
        const bounds = await ability.boundingBox();
        await page.mouse.move(bounds.x + bounds.width/2, bounds.y + bounds.height/2);
        await page.mouse.down(); await page.waitForTimeout(400);
        await page.locator('.ability-fan__drag').waitFor();
        const target = await page.locator('[data-skill-target="tableau"]').boundingBox();
        await page.mouse.move(target.x + target.width/2, target.y + target.height/2, { steps: 5 });
        await page.mouse.up();
        await page.waitForSelector('.ability-fan', { state: 'detached' });
      }
      assert.deepEqual(errors, []);
      console.log(`${width}x${height}: inspection pause, concealment, dismissal, manual pause and layout passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
