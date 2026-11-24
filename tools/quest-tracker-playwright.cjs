const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, touch] of [[1912,914,false], [1280,720,false], [1280,720,true]]) {
      const context = await browser.newContext({ viewport: {width,height}, hasTouch: touch, deviceScaleFactor: 3, reducedMotion: touch ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost:5178/proto.html');
      const tracker = page.locator('.day-objective__tracker'), marker = page.locator('.day-objective');
      const title = page.locator('.day-objective__title');
      await tracker.waitFor({state:'visible'}); await page.waitForTimeout(800);
      assert.equal(await marker.getAttribute('data-active'), 'false');
      const position = await tracker.boundingBox();
      const config = await page.locator('.proto-map .art-settings__cog').boundingBox();
      const map = await marker.boundingBox();
      assert.ok(position.y >= config.y + config.height + 8);
      assert.ok(Math.abs(position.x + position.width - map.x - map.width + 12) < 1);
      const actor = page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
      const before = await actor.getAttribute('data-grid-reference');
      if (touch) await title.tap(); else await title.hover();
      assert.equal(await marker.getAttribute('data-active'), 'true');
      assert.equal(await marker.locator('polygon').evaluate(e => e.points.numberOfItems),4);
      assert.equal(await marker.locator('svg').first().evaluate(e => getComputedStyle(e).opacity),'1');
      if (touch) {
        assert.equal(await marker.locator('polygon').evaluate(e => getComputedStyle(e).animationName),'none');
        await title.tap();
      } else await page.mouse.move(1,1);
      assert.equal(await marker.getAttribute('data-active'), 'false');
      await title.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert.equal(await marker.getAttribute('data-active'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await marker.getAttribute('data-active'), 'false');
      if(touch) await title.tap(); else await title.click();
      if (!touch) { await page.mouse.move(1,1); await title.evaluate(e => e.blur()); }
      assert.equal(await marker.getAttribute('data-active'), 'true');
      await page.locator('.day-objective__locate').click();
      await page.waitForTimeout(500);
      assert.equal(await marker.getAttribute('data-offscreen'), 'false');
      assert.equal(await actor.getAttribute('data-grid-reference'),before);
      assert.equal(await page.locator('[data-route-line]').count(),0);
      assert.deepEqual(await findLayoutDefects(page, '.day-objective__tracker', {parts:'.day-objective__heading, .day-objective__title, .day-objective__locate'}),[]);
      await page.screenshot({path:`artifacts/quest-tracker-${width}-${touch?'touch':'mouse'}.png`});
      await tracker.screenshot({path:`artifacts/quest-tracker-${width}-${touch?'touch':'mouse'}-3x.png`});
      await page.mouse.click(1,1);
      assert.equal(await marker.getAttribute('data-active'),'false');
      for (const day of ['day02','day03']) {
        await page.getByLabel('Day scenario',{exact:true}).selectOption(day);
        await tracker.waitFor({state:'visible'});
        assert.equal(await marker.getAttribute('data-active'),'false');
      }
      await page.getByLabel('Day scenario',{exact:true}).selectOption('sandbox');
      assert.equal(await marker.count(),0);
      assert.deepEqual(errors,[]);
      console.log('PASS tracker layout, targeting, mouse/touch, keyboard, reduced motion, scenarios',width,height,touch);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
