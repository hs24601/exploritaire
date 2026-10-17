const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/actor-peek-regression';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, touch, reduced] of [[1280, 720, false, false], [1912, 914, true, false], [1280, 720, true, true]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 3, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click(); await page.waitForTimeout(700);
      assert.equal(await page.locator('[data-actor-id="hero"]').getAttribute('data-den-interior-owner'), 'hero-den');
      assert.equal(await page.locator('[data-biome-popup="hero-den"] [data-actor-peek]').count(), 0, 'Den interior keeps its authored wall occlusion');
      await page.keyboard.press('Space'); await page.waitForTimeout(700);
      await page.getByRole('slider', { name: 'Travel speed', exact: true }).fill('500');
      const from = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const to = await page.locator('[data-biome-id="day-one-berries"]').boundingBox();
      const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * i / 12, y: start.y + (end.y - start.y) * i / 12 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up();
      }
      await page.waitForFunction(() => document.querySelector('[data-board-piece="actor"]')?.dataset.gridReference === 'table:-1,1', null, { timeout: 18000 });
      await page.keyboard.press('Space'); await page.waitForTimeout(900);
      // A wrapped painted edge prop, with the same oversampling structure as
      // BiomeEdgeScenery. Place foreground and background copies at Hero.
      await page.evaluate(() => {
        const actor = document.querySelector('[data-board-piece="actor"]');
        const world = document.querySelector('[data-physical-world]');
        for (const [id, offset] of [['peek-front', 8], ['peek-back', -8]]) {
          const prop = document.createElement('div'); prop.id = id;
          Object.assign(prop.dataset, { environmentProp: 'true', sceneryBillboard: 'paint', sceneryWidth: '80', sceneryHeight: '80',
            sceneryX: actor.dataset.actorX, sceneryY: String(Number(actor.dataset.actorY) + offset),
            ownerX: actor.dataset.actorX, ownerY: actor.dataset.actorY, ownerWidth: '300', ownerHeight: '300' });
          prop.style.cssText = `position:absolute;left:calc(50% + ${actor.dataset.actorX}px);top:calc(50% + ${Number(actor.dataset.actorY) + offset}px);width:480px;height:480px;transform:translate(-50%,-100%) rotateZ(calc(-1 * var(--camera-yaw,0deg))) rotateX(calc(-1 * var(--table-tilt,0deg))) scale(.1666666667);transform-origin:50% 100%`;
          prop.innerHTML = '<span style="position:absolute;inset:0"><span class="proto-oversample" style="width:80px;height:80px;zoom:6;background:#ff0000"></span></span>';
          world.append(prop);
        }
      });
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#peek-front [data-actor-peek]').count(), 1, 'Nested painted art gets a foreground opening');
      assert.equal(await page.locator('#peek-back [data-actor-peek]').count(), 0, 'Background stays intact');
      await page.screenshot({ path: `${out}/${width}-${touch}-${reduced}.png` });
      // Camera turns reverse foreground/background depth without recreating art.
      for (let i = 0; i < 4; i++) {
        const button = page.getByRole('button', { name: 'Turn table right', exact: true });
        if (touch) await button.tap(); else await button.click(); await page.waitForTimeout(650);
      }
      assert.equal(await page.locator('#peek-front [data-actor-peek]').count(), 0);
      assert.equal(await page.locator('#peek-back [data-actor-peek]').count(), 1);
      await page.evaluate(() => { document.querySelector('#peek-front').remove(); document.querySelector('#peek-back').remove(); });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${width}-${touch}-${reduced}-scene.png` });
      await page.keyboard.press('Space'); await page.waitForTimeout(700);
      assert.equal(await page.locator('[data-actor-peek]').count(), 0, 'OTT clears cutouts');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: ${touch ? 'touch' : 'mouse'} travel, wrapped foreground art, background preservation, orbit, OTT${reduced ? ', reduced motion' : ''}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
