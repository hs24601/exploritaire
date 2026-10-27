const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html?atmosphere=off');
      await page.waitForTimeout(1200);
      await page.getByRole('slider', { name: 'Travel speed', exact: true }).fill('500');
      await page.locator('[data-board-piece="actor"][data-actor-id="hero"]').press('Enter');
      const card = page.locator('[data-inspection-id="hero"]');
      await card.waitFor();
      if (touch) await card.tap(); else await card.click();
      await page.locator('.details-card-viewer--jumbo').waitFor();
      await page.getByRole('button', { name: 'Close jumbo card', exact: true }).click();
      await page.locator('.details-card-viewer--jumbo').waitFor({ state: 'detached' });
      await page.waitForTimeout(250);
      const box = await card.boundingBox();
      const tile = await page.locator('[data-biome-id="day-one-berries"]').boundingBox();
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const to = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
      const viewport = page.locator('.proto-map-viewport');
      const camera = () => viewport.evaluate(el => ['--camera-x','--camera-y','--camera-scale','--camera-yaw'].map(k => el.style.getPropertyValue(k)));
      const before = await camera();
      const cdp = touch ? await page.context().newCDPSession(page) : null;
      const send = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ ...point, id: 1 }] });
      if (touch) await send('touchStart', from);
      else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
      for (let i = 1; i <= 12; i++) {
        const point = { x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 };
        if (touch) await send('touchMove', point); else await page.mouse.move(point.x, point.y);
      }
      assert.equal(await page.locator('[data-actor-card-drag-ghost]').count(), 1);
      assert.equal(await card.evaluate(el => getComputedStyle(el).opacity), '0', 'original card hidden during drag');
      assert.equal(await page.locator('[data-actor-card-drag-ghost]').evaluate(el => getComputedStyle(el).opacity), '0.35', 'held card reveals terrain');
      assert.deepEqual(await camera(), before, 'card drag preserves camera');
      assert.equal(await page.locator('[data-actor-drag-preview]').count(), 1);
      if (touch) await send('touchEnd', to); else await page.mouse.up();
      await cdp?.detach();
      assert.equal(await page.locator('[data-actor-card-drag-ghost]').count(), 0);
      assert.equal(await card.evaluate(el => getComputedStyle(el).opacity), '1', 'original card restored on release');
      assert.equal(await page.locator('.details-card-viewer--jumbo').count(), 0);
      await page.waitForFunction(() => document.querySelector('.proto-main-layout').dataset.tableauPresent === 'true', null, { timeout: 20000 }).catch(async error => {
        console.log(await page.locator('[data-board-piece="actor"][data-actor-id="hero"]').evaluate(el => ({ ...el.dataset })));
        console.log(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.outerHTML.slice(0,700), to));
        throw error;
      });
      assert.deepEqual(errors, []);
      console.log(`PASS ${touch ? 'touch' : 'mouse'} actor card route preview, camera lock, travel and arrival`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

