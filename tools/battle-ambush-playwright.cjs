const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/battle-ambush';
fs.mkdirSync(out, { recursive: true });
const status = '.battle-field__status-text';
const actors = async page => JSON.parse(await page.locator('.combat-demo__arena').getAttribute('data-actors'));
const checkHeading = units => {
  const party = units.filter(a => a.team === 'party' && a.visible);
  const center = party.reduce((p, a) => [p[0] + a.position[0] / party.length, p[1] + a.position[1] / party.length], [0, 0]);
  for (const enemy of units.filter(a => a.team === 'enemy' && a.visible)) {
    const toward = Math.atan2(center[0] - enemy.position[0], center[1] - enemy.position[1]);
    assert.ok(Math.abs(Math.cos(enemy.heading - toward) + 1) < .001, 'Enemy faces 180 degrees away');
  }
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, touch] of [[1280, 720, false], [1912, 914, true]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: touch });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const press = locator => touch ? locator.tap() : locator.click();
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="side"]:not(:disabled)').waitFor();
      await press(page.locator('[data-view="side"]'));
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      assert.match(await page.locator(status).innerText(), /Player's ambush/);
      checkHeading(await actors(page));
      assert.equal(await page.locator('[data-team="enemy"] [data-foundation-pose="rear"]').count(), 2);
      await press(page.locator('.battle-field__column button:not(:disabled)').first());
      await page.waitForTimeout(800);
      assert.match(await page.locator(status).innerText(), /Strike when ready/);
      const clocks = async () => page.locator('[data-team="enemy"] [data-bar="timer"] .battle-bar__fill').evaluateAll(nodes => nodes.map(n => n.style.width));
      assert.deepEqual(await clocks(), ['0%', '0%']);
      await press(page.locator('.battle-ability:not(:disabled)').first());
      await press(page.locator('[data-battle-target="dark-slime"]'));
      assert.match(await page.locator(status).innerText(), /Enemy ambushed.*Free next turn: 10s/);
      await press(page.locator('.battle-field__status button', { hasText: /^Pause$/ }));
      const frozen = await page.locator(status).innerText();
      await page.waitForTimeout(1200);
      assert.equal(await page.locator(status).innerText(), frozen);
      assert.deepEqual(await clocks(), ['0%', '0%']);
      await press(page.locator('.battle-field__status button', { hasText: /^Resume$/ }));
      assert.deepEqual(await findLayoutDefects(page, '.battle-field__status', {
        parts: '.battle-field__status-text, button',
      }), [], `${width}: ambush announcement layout`);
      await page.locator('.battle-field__status').screenshot({ path: `${out}/countdown-${width}-3x.png`, scale: 'device' });
      await page.screenshot({ path: `${out}/ambush-${width}.png`, scale: 'css' });
      await page.waitForFunction(() => !document.querySelector('.battle-field__status-text')?.dataset.ambush, null, { timeout: 16000 });
      await page.waitForTimeout(500);
      assert.notDeepEqual(await clocks(), ['0%', '0%']);
      assert.equal(await page.locator('[data-team="enemy"] [data-foundation-pose="front"]').count(), 2);
      for (const enemy of (await actors(page)).filter(a => a.team === 'enemy' && a.visible)) {
        const party = (await actors(page)).filter(a => a.team === 'party' && a.visible);
        const x = party.reduce((sum, a) => sum + a.position[0], 0) / party.length;
        const z = party.reduce((sum, a) => sum + a.position[1], 0) / party.length;
        assert.ok(Math.cos(enemy.heading - Math.atan2(x - enemy.position[0], z - enemy.position[1])) > .999);
      }
      await press(page.locator('.battle-field__status button', { hasText: /^Restart$/ }));
      assert.match(await page.locator(status).innerText(), /Player's ambush/);
      assert.deepEqual(errors, []);
      console.log(`${width}: ${touch ? 'touch' : 'mouse'} ambush, pause, timer expiry, heading and layout passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
