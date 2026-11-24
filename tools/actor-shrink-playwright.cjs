const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

async function geometry(page) {
  return page.locator('.proto-map-viewport').evaluate(viewport => {
    const source = viewport.querySelector('[data-physical-world] [data-board-piece="actor"]');
    const foot = document.createElement('i');
    foot.style.cssText = 'position:absolute;left:50%;bottom:0;width:0;height:0';
    source.append(foot);
    const anchor = document.createElement('i');
    anchor.style.cssText = `position:absolute;left:${source.style.left};top:${source.style.top};width:0;height:0`;
    source.parentElement.append(anchor);
    const a = foot.getBoundingClientRect(), b = anchor.getBoundingClientRect();
    const drift = Math.hypot(a.x - b.x, a.y - b.y);
    foot.remove(); anchor.remove();
    const transform = new DOMMatrix(getComputedStyle(source).transform);
    const factor = parseFloat(getComputedStyle(viewport).getPropertyValue('--actor-world-scale'));
    const scale = parseFloat(getComputedStyle(viewport).getPropertyValue('--camera-scale'));
    const name = viewport.querySelector('.proto-projected-actor-name');
    if (viewport.querySelector('.proto-table-stage--tilted')) {
      if (!name) throw Error('Actor screen name missing');
      const nameBox = name.getBoundingClientRect(), bodyBox = source.getBoundingClientRect();
      if (getComputedStyle(name).display !== 'none' && nameBox.top < bodyBox.bottom + 7) throw Error('Actor name overlaps shrinking sprite');
      const nameSize = parseFloat(getComputedStyle(name).fontSize);
      if (nameSize < 16 || nameSize > 20) throw Error('Actor name is outside readable screen-size bounds');
    }
    const shadow = viewport.querySelector('[data-shadow-owner="actor"]');
    const shadowMatrix = shadow && new DOMMatrix(getComputedStyle(shadow).transform);
    return { factor, scale, drift, worldWidth: Math.hypot(transform.m11, transform.m12, transform.m13) * source.offsetWidth,
      shadowWidth: shadowMatrix && Math.hypot(shadowMatrix.m11, shadowMatrix.m12) * shadow.offsetWidth,
      heading: source.dataset.actorHeading, reference: source.dataset.gridReference,
      box: source.getBoundingClientRect().toJSON(), grip: viewport.querySelector('[data-cell-grip="actor-hero"]').getBoundingClientRect().toJSON() };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      assert.equal((await page.goto(URL)).status(), 200);
      await page.waitForTimeout(800);
      // Frame Hero's occupied square before zooming, using the actual pan
      // gesture so the close-up screenshots show her against the den props.
      const flatView = await page.locator('.proto-map-viewport').boundingBox();
      const flatGrip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      await page.mouse.move(flatGrip.x + flatGrip.width / 2, flatGrip.y + flatGrip.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(flatView.x + flatView.width / 2, flatView.y + flatView.height / 2, { steps: 10 });
      await page.mouse.up({ button: 'right' });
      await page.keyboard.press('Space'); await page.waitForTimeout(1200);
      const initial = await geometry(page);
      assert.equal(initial.factor, 1); assert.ok(Math.abs(initial.worldWidth - 32) < .01);
      await page.screenshot({ path: `artifacts/actor-shrink-${width}-initial-3x.png` });
      const view = await page.locator('.proto-map-viewport').boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const points = distance => [{ x: view.x + view.width / 2 - distance / 2, y: view.y + 80, id: 1 },
        { x: view.x + view.width / 2 + distance / 2, y: view.y + 80, id: 2 }];
      async function pinch(target) {
        const scale = (await geometry(page)).scale;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(100 * target / scale) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(350);
      }
      for (const scale of [3.4, 4.5, 5.65, 6.8]) {
        await pinch(scale);
        const current = await geometry(page);
        assert.ok(Math.abs(current.factor - 1.7 / scale) < .001, JSON.stringify(current));
        assert.ok(Math.abs(current.worldWidth - 32 * current.factor) < .01);
        assert.ok(Math.abs(current.shadowWidth - 32 * current.factor) < .01, 'shadow scales with body');
        assert.ok(current.drift < .5, 'feet stay planted');
        assert.equal(current.heading, initial.heading); assert.equal(current.reference, initial.reference);
      }
      const close = await geometry(page);
      assert.ok(Math.abs(close.worldWidth - 8) < .01, 'body is one-quarter world size');
      assert.ok(close.grip.width > close.box.width * 3, 'whole-square grab stays generous');
      await page.screenshot({ path: `artifacts/actor-shrink-${width}-close-3x.png` });
      await page.locator('[data-physical-world] [data-board-piece="actor"]').screenshot({ path: `artifacts/actor-shrink-${width}-body-3x.png` });
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-viewport', { parts: '.proto-projected-title' }), []);
      // Press away from the tiny body, within its cell. Both inputs retain
      // actor priority and freeze the camera throughout the drag.
      const grab = { x: close.grip.x + close.grip.width * .65, y: close.grip.y + close.grip.height * .65 };
      const camera = () => page.locator('[data-physical-world]').evaluate(el => el.style.transform);
      const frozen = await camera();
      await page.mouse.move(grab.x, grab.y); await page.mouse.down();
      await page.mouse.move(grab.x + 20, grab.y - 10, { steps: 3 });
      await page.locator('[data-actor-drag-ghost]').waitFor(); assert.equal(await camera(), frozen);
      await page.locator('[data-cell-grip="actor-hero"]').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
      await page.mouse.up();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...grab, id: 3 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: grab.x + 20, y: grab.y - 10, id: 3 }] });
      await page.locator('[data-actor-drag-ghost]').waitFor(); assert.equal(await camera(), frozen);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.getByRole('button', { name: 'Turn table right', exact: true }).click(); await page.waitForTimeout(700);
      assert.ok((await geometry(page)).drift < .5);
      await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(700);
      assert.equal((await geometry(page)).factor, 1);
      await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
      await page.mouse.wheel(0, -10000); await page.waitForTimeout(1600);
      await page.mouse.wheel(0, -1000); await page.waitForTimeout(1000);
      assert.equal((await geometry(page)).factor, .25, 'wheel uses the same shrink scale');
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click(); await page.waitForTimeout(900);
      assert.equal((await geometry(page)).factor, 1, 'OTT restores authored token size');
      await page.keyboard.press('Space'); await page.waitForTimeout(1000);
      assert.ok((await geometry(page)).factor < .3, 'switching to immersion at high zoom reapplies shrink');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: pinch/wheel shrink, body/shadow size, planted feet, heading, full-cell mouse/touch grabs, orbit, reset, OTT and layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
