const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const centre = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
// Probe the projected corners rather than just checking transform strings.
async function corners(card) {
  return card.evaluate(el => {
    if (el.dataset.pickedUp) {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      // All four corners must clear the table: a billboard whose lower edge
      // cuts through the plane lets the grid paint across its face.
      const lowest = m.m43 - Math.abs(m.m13) * el.clientWidth / 2 - Math.abs(m.m23) * el.clientHeight / 2;
      if (lowest <= 0) throw new Error('Picked-up card intersects the table plane');
    }
    return [[0, 0], [100, 0], [0, 100], [100, 100]].map(([x, y]) => {
      const point = document.createElement('i');
      point.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:0;height:0;pointer-events:none`;
      el.append(point);
      const r = point.getBoundingClientRect(); point.remove();
      return { x: r.x, y: r.y };
    });
  });
}
function facesCamera(points) {
  const [tl, tr, bl, br] = points;
  for (const delta of [tl.y - tr.y, bl.y - br.y, tl.x - bl.x, tr.x - br.x])
    assert.ok(Math.abs(delta) < 0.6, `Held edge must face camera: ${JSON.stringify(points)}`);
  assert.ok(Math.abs((tr.x - tl.x) / (bl.y - tl.y) - 63 / 88) < 0.005, 'Held card preserves its portrait ratio');
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1912, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1912 ? 914 : 720 }, deviceScaleFactor: 3, hasTouch: true });
      const page = await context.newPage();
      await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html');
      const actor = centre(await page.locator('[data-board-piece="actor"]').boundingBox());
      const woods = centre(await page.locator('[data-biome-id="woods-alpha"]').boundingBox());
      await page.mouse.move(actor.x, actor.y); await page.mouse.down();
      await page.mouse.move(woods.x, woods.y, { steps: 15 }); await page.mouse.up();
      const card = page.locator('[data-table-quest="0"]');
      await card.waitFor({ timeout: 15000 }); await page.waitForTimeout(750);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(700);
      for (const yaw of [0, 45, 90]) {
        if (yaw) { await page.mouse.click(5, 5); await page.keyboard.press('e'); await page.waitForTimeout(450); }
        const camera = await page.locator('.proto-map-viewport').evaluate(el => ['--camera-yaw', '--camera-x', '--camera-y', '--camera-scale'].map(k => getComputedStyle(el).getPropertyValue(k)));
        const start = centre(await card.boundingBox());
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        const target = centre(await page.locator('.proto-map-viewport').boundingBox());
        await page.mouse.move(target.x + 40, target.y + 60, { steps: 5 });
        assert.equal(await card.getAttribute('data-picked-up'), 'true'); facesCamera(await corners(card));
        assert.deepEqual(await findLayoutDefects(page, '[data-table-quest="0"]', { parts: '.quest-card__title, .quest-card__status, .quest-card__reward' }), []);
        if (yaw === 45) await card.screenshot({ path: `artifacts/quest-field/held-camera-${width}-3x.png` });
        await page.mouse.up();
        assert.equal(await card.getAttribute('data-picked-up'), null);
        assert.ok(!(await card.evaluate(el => el.style.transform)).includes('rotateX'), 'Release restores table-plane alignment');
        const [tl, tr, bl, br] = await corners(card);
        assert.ok(Math.abs((tr.x - tl.x) - (br.x - bl.x)) > 1, 'Placed card takes the table perspective again');
        assert.deepEqual(await page.locator('.proto-map-viewport').evaluate(el => ['--camera-yaw', '--camera-x', '--camera-y', '--camera-scale'].map(k => getComputedStyle(el).getPropertyValue(k))), camera, 'Card drag leaves camera fixed');
      }
      const session = await context.newCDPSession(page);
      const start = centre(await card.boundingBox());
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 50, y: start.y + 20 }] });
      await page.waitForTimeout(60); assert.equal(await card.getAttribute('data-picked-up'), 'true', 'Touch picks up the card'); facesCamera(await corners(card));
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(60); assert.equal(await card.getAttribute('data-picked-up'), null);
      const beforeCancel = await card.evaluate(el => [el.style.left, el.style.top, el.style.transform]);
      const cancelStart = centre(await card.boundingBox());
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [cancelStart] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cancelStart.x + 50, y: cancelStart.y + 20 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForTimeout(60);
      assert.equal(await card.getAttribute('data-picked-up'), null);
      assert.deepEqual(await card.evaluate(el => [el.style.left, el.style.top, el.style.transform]), beforeCancel, 'Cancelled pickup restores original pose');
      assert.equal(await page.locator('.quest-field').getAttribute('data-redeemed'), '0', 'Dragging never redeems the card');
      await context.close();
    }
    console.log('Held cards face camera at 0/45/90 degrees, preserve ratio, restore tilt on mouse/touch release and cancellation, and leave camera and rewards unchanged. Desktop layout and 3x captures checked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
