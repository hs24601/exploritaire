const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// Measure the rendered face, including its camera ancestors, rather than relying
// on a transform string to establish whether a held card is readable.
const corners = card => card.evaluate(el => [[0, 0], [100, 0], [0, 100]].map(([x, y]) => {
  const probe = document.createElement('i');
  probe.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:0;height:0;pointer-events:none`;
  el.append(probe);
  const r = probe.getBoundingClientRect(); probe.remove();
  return { x: r.x, y: r.y };
}));

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) for (const immersive of [false, true]) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html');
      const card = page.locator('.proto-story-card:not([data-held-visual])');
      await card.waitFor();
      if (immersive) await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      const resting = await card.evaluate(el => getComputedStyle(el).transform);
      await page.keyboard.press('e');
      await page.waitForTimeout(500);
      assert.equal(await card.evaluate(el => getComputedStyle(el).transform), resting, 'orbit must preserve the placed table rotation');
      const [tl, tr] = await corners(card);
      assert.ok(Math.abs(tr.y - tl.y) > 10, 'resting face turns with the table in screen projection');
      const start = await card.evaluate(el => {
        const r = el.getBoundingClientRect();
        for (const y of [.3, .5, .7]) for (const x of [.5, .3, .7]) {
          const p = { x: r.x + r.width * x, y: r.y + r.height * y };
          const hit = document.elementFromPoint(p.x, p.y);
          if (hit && el.contains(hit) && !hit.closest('button')) return p;
        }
        throw Error('No reachable quest face');
      });
      const cdp = touch ? await context.newCDPSession(page) : null;
      const input = async (type, point) => {
        if (touch) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [point] });
        else if (type === 'touchStart') { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
        else if (type === 'touchMove') await page.mouse.move(point.x, point.y, { steps: 5 });
        else await page.mouse.up();
      };
      const camera = await page.locator('.proto-map-viewport').evaluate(el => el.style.cssText);
      await input('touchStart', start);
      const face = page.locator('[data-held-visual]');
      await face.waitFor();
      const [a, b, c] = await corners(face);
      assert.ok(Math.abs(a.y - b.y) < .6 && Math.abs(a.x - c.x) < .6, 'held card faces the player upright');
      assert.ok(Math.abs((b.x - a.x) / (c.y - a.y) - 63 / 88) < .005, 'held face keeps its portrait ratio');
      await input('touchMove', { x: start.x + 20, y: start.y + 15 });
      await input('touchEnd', start);
      await page.waitForTimeout(100);
      assert.equal(await face.count(), 0);
      const placed = await card.evaluate(el => getComputedStyle(el).transform);
      const [dropA, dropB, dropC] = await corners(card);
      assert.ok(dropB.x > dropA.x && dropC.y > dropA.y, 'released card faces the player');
      assert.ok(Math.abs(dropB.y - dropA.y) / Math.abs(dropB.x - dropA.x) < .12, 'released card has only a small readable tilt');
      assert.equal(await page.locator('.card-jumbo').count(), 0, 'drag does not open inspection');
      assert.equal(await page.locator('.proto-map-viewport').evaluate(el => el.style.cssText), camera, 'pickup and drag preserve camera');
      if (touch) {
        const r = await card.boundingBox();
        await input('touchStart', { x: r.x + r.width / 2, y: r.y + r.height / 2 });
        await input('touchCancel', start);
        assert.equal(await face.count(), 0, 'cancellation removes held face');
        assert.equal(await card.evaluate(el => getComputedStyle(el).transform), placed, 'cancellation restores table rotation');
      }
      if (touch) await card.tap(); else await card.click();
      await page.getByRole('dialog', { name: 'An ordinary day jumbo card' }).waitFor();
      await page.keyboard.press('Escape');
      const inspectedAngle = await card.evaluate(el => getComputedStyle(el).transform);
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
      assert.equal(await card.evaluate(el => getComputedStyle(el).transform), inspectedAngle, 'later orbit preserves the newly placed heading');
      assert.deepEqual(errors, []);
      console.log('PASS quest rotation', width, immersive ? 'immersion' : 'OTT', touch ? 'touch' : 'mouse');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
