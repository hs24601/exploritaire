const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';

async function press(page, point, touch) {
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
async function drag(page, from, to, touch) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: point.x, y: point.y }] });
  if (touch) await send('touchStart', from); else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let step = 1; step <= 10; step++) {
    const point = { x: from.x + (to.x - from.x) * step / 10, y: from.y + (to.y - from.y) * step / 10 };
    if (touch) await send('touchMove', point); else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(20);
  }
  if (touch) await send('touchEnd', to); else await page.mouse.up();
  await cdp?.detach();
}
async function center(locator) { const box = await locator.boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }
async function verifyFades(page) {
  const actor = page.locator('[data-board-piece="actor"]');
  assert.equal(await actor.getAttribute('data-actor-occluded'), 'true');
  assert.equal(await page.locator('[data-biome-popup="hero-den"]').getAttribute('data-actor-occluder'), 'true');
  assert.equal(await page.locator('[data-biome-popup="mountain--1-2"]').getAttribute('data-actor-occluder'), 'false', 'Nonoverlapping scenery stays opaque');
  const ghost = page.locator('[data-actor-ghost="hero"]');
  assert.equal(await ghost.evaluate(el => getComputedStyle(el).display), 'block');
  assert.equal(await ghost.getAttribute('aria-hidden'), 'true');
  assert.equal(await ghost.getAttribute('tabindex'), null);
  assert.ok((await ghost.locator('.proto-oversample').evaluate(el => getComputedStyle(el).filter)).includes('proto-actor-xray'));
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, hasTouch: touch, deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL); await page.waitForTimeout(1000);
      const actor = page.locator('[data-board-piece="actor"]'), grip = page.locator('[data-cell-grip="actor-hero"]');
      assert.equal(await actor.getAttribute('data-actor-pose'), 'sleeping');
      assert.equal(await actor.getAttribute('data-actor-orientation'), 'world-plane');
      assert.ok(!(await actor.evaluate(el => el.style.transform)).includes('camera-yaw'), 'Sleeping overhead body is world aligned');
      assert.ok((await actor.locator('img').getAttribute('src')).endsWith('hero-sleeping-topdown.png'));
      assert.equal(await page.locator('[data-den-overhead]').count(), 1);
      assert.equal(await page.locator('[data-biome-id="hero-den"]').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      assert.equal(await page.locator('[data-biome-id="hero-den"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('[data-den-roof]').count(), 1);
      const roof = page.locator('[data-den-roof]'), actorBox = await actor.boundingBox();
      const covered = (await page.screenshot({ clip: actorBox })).toString('base64');
      await roof.evaluate(el => el.style.visibility = 'hidden');
      const uncovered = (await page.screenshot({ clip: actorBox })).toString('base64');
      await roof.evaluate(el => el.style.visibility = 'visible');
      const difference = await page.evaluate(async ({ covered, uncovered }) => {
        const read = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); return { pixels: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width, height: img.height }; };
        const a = await read(covered), b = await read(uncovered); let upper = 0, lower = 0;
        const edge = new Map();
        for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          if ([0, 1, 2].some(c => a.pixels[i + c] !== b.pixels[i + c])) {
            // The boulders now protrude past the crown. Her muzzle and paws
            // occupy the bottom third of the sleeping sprite and stay clear.
            if (y < a.height * 2 / 3) upper++; else lower++;
            edge.set(x, y);
          }
        }
        const depths = [...edge.values()];
        return { upper, lower, edgeRelief: Math.max(...depths) - Math.min(...depths) };
      }, { covered, uncovered });
      assert.ok(difference.upper > 20, 'Roof actually paints over the upper sleeping body');
      assert.equal(difference.lower, 0, 'Face and paws in the bottom third stay visible');
      assert.ok(difference.edgeRelief > 5, 'Rendered roof overhang has an uneven rock contour');
      assert.deepEqual(await findLayoutDefects(page, '[data-den-title]', { parts: '.proto-tile-title__line', minFontSize: 6 }), []);
      await page.screenshot({ path: `artifacts/heros-den/${width}-${touch ? 'touch' : 'mouse'}-topdown-3x.png` });
      await page.getByRole('button', { name: 'Tilt camera view' }).click(); await page.waitForTimeout(1100);
      assert.equal(await page.locator('[data-den-overhead], [data-den-roof]').count(), 0, 'Immersion uses the cave, without the overhead bowl print');
      await verifyFades(page);
      const den = page.locator('[data-biome-popup="hero-den"]');
      const occupiedY = Number(await den.getAttribute('data-scenery-y'));
      const sleepingTransform = await actor.evaluate(el => getComputedStyle(el).transform);
      assert.ok(!(await actor.evaluate(el => el.style.transform)).includes('camera-yaw'), 'Sleeping immersive body is world aligned');
      await press(page, await center(grip), touch); await page.waitForTimeout(200);
      assert.equal(await page.locator('.details-card-viewer').count(), 1, 'Sleeping actor still opens details by mouse/touch');
      await page.keyboard.press('Escape');
      await actor.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
      assert.equal(await page.locator('.details-card-viewer').count(), 1, 'Sleeping actor supports keyboard inspection');
      await page.keyboard.press('Escape');
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
      await page.screenshot({ path: `artifacts/heros-den/${width}-${touch ? 'touch' : 'mouse'}-immersion-3x.png` });
      // Turn through every authored quadrant; feet stay in the owning tile,
      // foreground depth changes live and Hero's full title always remains.
      for (let step = 0; step < 8; step++) {
        await page.getByRole('button', { name: 'Turn table right' }).click(); await page.waitForTimeout(420);
        assert.equal(await actor.getAttribute('data-actor-heading'), '0', 'Camera orbit preserves authored den facing');
        assert.equal(await actor.evaluate(el => getComputedStyle(el).transform), sleepingTransform, 'Body does not counter-rotate toward the camera');
        if (!touch && width === 1280 && [0, 1, 3].includes(step)) await page.screenshot({ path: `artifacts/heros-den/sleeping-world-${(step + 1) * 45}-3x.png` });
        assert.equal(await page.locator('[data-den-title] [data-label-overflow]').getAttribute('data-label-overflow'), 'false');
      }
      await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(600);
      // Leave the den by dropping onto its adjacent path; then come home.
      await drag(page, await center(grip), await center(page.locator('[data-biome-id="unexplored--1-1"]')), touch);
      await page.waitForTimeout(1800);
      assert.equal(await actor.getAttribute('data-grid-reference'), 'table:-1,1');
      assert.equal(await actor.getAttribute('data-actor-pose'), 'standing');
      const travelHeading = Number(await actor.getAttribute('data-actor-heading'));
      assert.ok(Math.abs(travelHeading + Math.PI / 2) < .01, 'Standing Hero faces her westward travel');
      if (await page.getByRole('button', { name: 'Tilt camera view' }).count()) await page.getByRole('button', { name: 'Tilt camera view' }).click();
      await page.waitForTimeout(900);
      await actor.locator('canvas[data-world-heading]').waitFor();
      assert.ok(Math.abs(Number(await actor.locator('canvas').getAttribute('data-world-heading')) - travelHeading) < .001, 'Rig receives retained travel facing after mounting');
      await page.getByRole('button', { name: 'Flat camera view' }).click(); await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'Tilt camera view' }).click(); await page.waitForTimeout(900);
      await actor.locator('canvas[data-world-heading]').waitFor();
      assert.ok(Math.abs(Number(await actor.locator('canvas').getAttribute('data-world-heading')) - travelHeading) < .001, 'Flat/immersion remount preserves heading');
      assert.equal(await page.locator('.details-card-viewer').count(), 0, 'Dragging does not inspect');
      assert.equal(await page.locator('[data-biome-popup="hero-den"]').getAttribute('data-actor-occluder'), 'false', 'Empty den returns to opaque');
      const emptyY = Number(await den.getAttribute('data-scenery-y'));
      const ownerY = Number(await den.getAttribute('data-owner-y'));
      assert.equal(emptyY, ownerY + 24, 'Empty den requests the front edge of its tile');
      assert.ok(emptyY > occupiedY, 'Empty cave front advances from its sleeping placement');
      assert.ok((await den.evaluate(el => parseFloat(el.style.top.match(/([\d.]+)px/)[1]))) <= ownerY + 24, 'Fitted cave foot stays within its tile');
      await page.screenshot({ path: `artifacts/heros-den/${width}-${touch ? 'touch' : 'mouse'}-empty-immersion-3x.png` });
      await page.getByRole('button', { name: 'Turn table right' }).click(); await page.waitForTimeout(500);
      assert.equal(Number(await den.getAttribute('data-scenery-y')), emptyY, 'Empty cave front stays world aligned during orbit');
      await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(600);
      await drag(page, await center(grip), await center(page.locator('[data-biome-id="hero-den"]')), touch);
      await page.waitForTimeout(1800);
      assert.equal(await actor.getAttribute('data-grid-reference'), 'table:0,2');
      assert.equal(await actor.getAttribute('data-actor-pose'), 'sleeping');
      assert.equal(Number(await den.getAttribute('data-scenery-y')), occupiedY, 'Returning restores the sleeping hollow placement');
      await verifyFades(page);
      await page.getByRole('button', { name: 'Flat camera view' }).click(); await page.waitForTimeout(800);
      assert.equal(await actor.getAttribute('data-actor-occluded'), 'false');
      assert.equal(await page.locator('[data-actor-ghost]').evaluate(el => getComputedStyle(el).display), 'none');
      assert.deepEqual(errors, []);
      console.log(`${width} ${touch ? 'touch' : 'mouse'}: sleeping, depth fading, outline, inspection, orbit, leaving/returning, flat reset passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
