const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
const directory = 'artifacts/actor-peek'; fs.mkdirSync(directory, { recursive: true });
async function center(locator) { const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
async function drag(page, from, to, touch, beforeRelease) {
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
  if (touch) await send('touchStart', from); else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let i = 1; i <= 12; i++) { const p = { x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 }; if (touch) await send('touchMove', p); else await page.mouse.move(p.x, p.y); }
  await beforeRelease?.();
  if (touch) await send('touchEnd', to); else await page.mouse.up();
  await cdp?.detach();
}
async function verifyScene(page) {
  const results = await page.evaluate(() => {
    const actor = document.querySelector('[data-board-piece="actor"]'), ar = actor.getBoundingClientRect();
    const center = { x: (ar.left + ar.right) / 2, y: (ar.top + ar.bottom) / 2 };
    const props = [...document.querySelectorAll('[data-environment-prop]')];
    return { ghosts: document.querySelectorAll('[data-actor-ghost]').length,
      actorOpacity: getComputedStyle(actor.querySelector('.proto-oversample') || actor).opacity,
      props: props.map(prop => ({ id: prop.dataset.biomePopup || prop.dataset.biomeEdge,
        active: prop.dataset.actorOccluder === 'true', opacity: getComputedStyle(prop).opacity,
        masks: [...prop.querySelectorAll('[data-actor-peek]')].map(el => {
          const r = el.getBoundingClientRect(), style = getComputedStyle(el);
          const position = style.maskPosition.split(',')[1].trim().split(' ').map(parseFloat);
          const size = style.maskSize.split(',')[1].trim().split(' ').map(parseFloat);
          const x = r.x + (position[0] + size[0] / 2) / parseFloat(el.style.width) * r.width;
          const y = r.y + (position[1] + size[1] / 2) / parseFloat(el.style.height) * r.height;
          return { error: Math.hypot(x - center.x, y - center.y), composite: style.maskComposite, position: style.maskPosition };
        }) })) };
  });
  assert.equal(results.ghosts, 0); assert.equal(results.actorOpacity, '1');
  assert.ok(results.props.every(p => p.opacity === '1'), 'Props keep opaque material coverage');
  assert.ok(results.props.every(p => p.active === (p.masks.length > 0)), 'Background art has no cutout');
  assert.ok(results.props.flatMap(p => p.masks).every(m => m.error < 1.5), `Openings track the original actor: ${JSON.stringify(results)}`);
  return results;
}
async function nativeMaskPixels(page) {
  await page.evaluate(async () => {
    const { peekMaskLayers } = await import('/src/proto/actorPeek.ts');
    const fixture = document.createElement('div'); fixture.id = 'peek-pixel-fixture'; fixture.className = 'proto-map';
    fixture.style.cssText = 'position:fixed;left:10px;top:10px;width:260px;height:200px;background:#00ff00;z-index:999999;border:0;border-radius:0';
    const art = document.createElement('div'); art.dataset.actorPeek = 'true';
    art.style.cssText = 'width:260px;height:200px;background:#ff0000';
    const mask = peekMaskLayers([{ x: 100, y: 100, rx: 48, ry: 65 }, { x: 140, y: 100, rx: 48, ry: 65 }], { x: 0, y: 0, width: 260, height: 200 });
    for (const [key, value] of Object.entries(mask)) art.style.setProperty(`--peek-${key}`, value);
    fixture.append(art); document.body.append(fixture);
  });
  await page.waitForTimeout(150);
  const png = await page.locator('#peek-pixel-fixture').screenshot({ path: `${directory}/native-union-3x.png` });
  const samples = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const scale = image.width / 260;
    return [[12, 12], [100, 100], [120, 100], [140, 100], [245, 185]].map(([x, y]) => [...ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data]);
  }, png.toString('base64'));
  assert.deepEqual(samples, [[255, 0, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255], [255, 0, 0, 255]], 'Native masks fully cut the union while leaving outside pixels opaque');
  await page.locator('#peek-pixel-fixture').evaluate(el => el.remove());
}
async function fixedPlaneFallback(page, touch = false) {
  await page.evaluate(() => {
    const actor = document.querySelector('[data-board-piece="actor"]'), x = Number(actor.dataset.actorX), y = Number(actor.dataset.actorY) + 12;
    const prop = document.createElement('div'); prop.id = 'peek-plane-fixture';
    Object.assign(prop.dataset, { environmentProp: 'true', sceneryHeading: '0', sceneryWidth: '80', sceneryHeight: '80' });
    prop.style.cssText = `position:absolute;left:calc(50% + ${x}px);top:calc(50% + ${y}px);width:480px;height:480px;transform:translate(-50%,-100%) rotateZ(0deg) rotateX(-90deg) scale(.1666666667);transform-origin:50% 100%`;
    const art = document.createElement('span'); art.className = 'proto-oversample'; art.style.cssText = 'width:80px;height:80px;zoom:6;background:#ff0000';
    prop.append(art); document.querySelector('[data-physical-world]').append(prop);
  });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#peek-plane-fixture [data-actor-peek]').count(), 1, 'Fixed sprite fallback uses the same compositor');
  const viewport = await page.locator('.proto-map-viewport').boundingBox(), actor = await page.locator('[data-board-piece="actor"]').boundingBox();
  const png = await page.locator('.proto-map-viewport').screenshot({ path: `${directory}/fixed-plane-fallback-${touch ? 'touch' : 'mouse'}-3x.png` });
  const sample = await page.evaluate(async ({ base64, x, y, width }) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const ratio = image.width / width;
    const center = [...ctx.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data];
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data; let opaqueRed = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 0) opaqueRed++;
    return { center, opaqueRed };
  }, { base64: png.toString('base64'), x: actor.x + actor.width / 2 - viewport.x, y: actor.y + actor.height / 2 - viewport.y, width: viewport.width });
  assert.notDeepEqual(sample.center, [255, 0, 0, 255], 'Actor core is open through the fixed plane');
  assert.ok(sample.opaqueRed > 1000, 'Fixed-plane material stays opaque outside the opening');
  // The elevated body is outside its ground square, and the masked prop
  // still receives native hit tests. A visible-body press must reach Hero.
  const at = { x: actor.x + actor.width / 2, y: actor.y + actor.height * .2 };
  if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
  await page.getByRole('dialog', { name: 'Hero', exact: true }).waitFor(); await page.keyboard.press('Escape');
  const camera = await page.locator('.proto-map-viewport').evaluate(el => el.style.getPropertyValue('--camera-transform'));
  await drag(page, at, { x: at.x + 25, y: at.y + 15 }, touch, async () => {
    assert.equal(await page.locator('.proto-map-viewport').evaluate(el => el.style.getPropertyValue('--camera-transform')), camera, 'A revealed-body drag takes the actor without panning');
    assert.equal(await page.locator('[data-actor-drag-preview]').count(), 1, 'Revealed body routes movement to the original actor');
  });
  await page.locator('#peek-plane-fixture').evaluate(el => el.remove());
}
(async () => {
  const browser = await chromium.launch({ headless: true }); const observations = [];
  try {
    if (process.env.PEEK_INPUT_ONLY === '1') {
      for (const width of [1280, 1912]) for (const touch of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3, hasTouch: touch });
        const page = await context.newPage(); await page.goto(URL); await page.keyboard.press('Space'); await page.waitForTimeout(1300);
        await fixedPlaneFallback(page, touch);
        console.log(`PASS revealed actor body: ${width} ${touch ? 'touch' : 'mouse'} inspection and drag.`); await context.close();
      }
      return;
    }
    for (const width of [1280, 1912]) for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3, hasTouch: touch });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL); await page.keyboard.press('Space'); await page.waitForTimeout(1800);
      const initial = await verifyScene(page); assert.ok(initial.props.some(p => p.active), 'Foreground reliefs have openings');
      if (width === 1280 && !touch) {
        await nativeMaskPixels(page); await fixedPlaneFallback(page);
        const closeup = page.getByRole('button', { name: 'Actor close-up', exact: true });
        if (await closeup.count()) {
          await closeup.click(); await page.waitForTimeout(650); await verifyScene(page);
          await page.getByRole('slider', { name: 'Actor close-up magnification' }).fill('6');
          await page.waitForTimeout(650); await verifyScene(page);
          await page.screenshot({ path: `${directory}/actor-closeup-6x-3x.png` });
          await page.getByRole('button', { name: 'Exit actor close-up', exact: true }).click(); await page.waitForTimeout(650);
        }
      }
      for (let i = 0; i < 4; i++) {
        observations.push({ width, touch, yaw: i * 90, ...await verifyScene(page) });
        await page.screenshot({ path: `${directory}/${width}-${touch ? 'touch' : 'mouse'}-${i * 90}-3x.png` });
        for (let j = 0; j < 2; j++) { const button = page.getByRole('button', { name: 'Turn table right', exact: true }); if (touch) await button.tap(); else await button.click(); await page.waitForTimeout(650); }
      }
      // Stable idle cameras must not repeatedly update masks or rerasterize SVGs.
      const writes = await page.evaluate(() => new Promise(resolve => {
        let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
        document.querySelectorAll('[data-actor-peek]').forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['style'] }));
        setTimeout(() => { observer.disconnect(); resolve(writes); }, 800);
      }));
      assert.equal(writes, 0, 'An idle cutout makes no mask style writes');
      const area = await page.locator('.proto-map-viewport').boundingBox();
      // Aim at the actor before descending; zooming the origin would leave
      // the den below the viewport and foreground props behind the eye.
      const foot = await center(page.locator('[data-cell-grip="actor-hero"]'));
      const pan = { x: area.x + area.width * .8, y: area.y + area.height * .5 };
      await page.mouse.move(pan.x, pan.y); await page.mouse.down({ button: 'right' });
      await page.mouse.move(pan.x, pan.y - (foot.y - area.y - area.height / 2), { steps: 10 });
      await page.mouse.up({ button: 'right' });
      await page.mouse.move(area.x + area.width * .8, area.y + area.height * .7);
      for (let i = 0; i < 35; i++) { await page.mouse.wheel(0, -160); await page.waitForTimeout(25); }
      await page.waitForTimeout(800); await verifyScene(page);
      await page.screenshot({ path: `${directory}/${width}-${touch ? 'touch' : 'mouse'}-low-3x.png` });
      await page.getByRole('button', { name: 'Reset View', exact: true }).click(); await page.waitForTimeout(700);
      const grip = page.locator('[data-cell-grip="actor-hero"]'), at = await center(grip);
      if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
      await page.getByRole('dialog', { name: 'Hero', exact: true }).waitFor(); await page.keyboard.press('Escape');
      await page.locator('[data-board-piece="actor"]').focus(); await page.keyboard.press('Enter'); await page.getByRole('dialog', { name: 'Hero', exact: true }).waitFor(); await page.keyboard.press('Escape');
      await page.getByRole('checkbox', { name: 'Follow traveling actor' }).uncheck();
      await page.getByRole('slider', { name: 'Travel speed' }).fill('500');
      const from = await center(grip);
      const to = await page.evaluate(() => {
        const marker = document.createElement('i'); marker.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none';
        document.querySelector('[data-physical-world]').append(marker); const r = marker.getBoundingClientRect(); marker.remove(); return { x: r.x, y: r.y };
      });
      const before = await page.locator('.proto-map-viewport').evaluate(el => el.style.getPropertyValue('--camera-transform'));
      await drag(page, from, to, touch); await page.locator('[data-route-line]').waitFor();
      assert.equal(await page.locator('.details-card-viewer').count(), 0, 'A drag never opens inspection');
      assert.equal(await page.locator('.proto-map-viewport').evaluate(el => el.style.getPropertyValue('--camera-transform')), before, 'Actor drag keeps the camera still');
      await page.locator('[data-route-line]').waitFor({ state: 'detached', timeout: 18000 });
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference'), 'table:0,0');
      await verifyScene(page);
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-readouts,.proto-map-fps,.proto-map-zoom,.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference' }), []);
      await page.keyboard.press('Space'); await page.waitForTimeout(750);
      assert.equal(await page.locator('[data-actor-peek]').count(), 0, 'OTT has no cutouts');
      assert.deepEqual(errors, []); console.log(`PASS ${width} ${touch ? 'touch' : 'mouse'}: opaque cutouts, orbit, low camera, idle caching, inspection, drag/travel and OTT.`);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); await page.goto(`${URL}?propRenderer=canvas`); await page.keyboard.press('Space'); await page.waitForTimeout(2000);
    assert.ok((await verifyScene(page)).props.some(p => p.active));
    assert.ok(await page.locator('[data-volume-engine="canvas"][data-actor-peek]').count(), 'CPU-rasterized reliefs retain cutouts with reduced motion');
    console.log('PASS reduced motion, CPU relief renderer and fixed-plane sprite fallback.'); await context.close();
    fs.writeFileSync(`${directory}/observations.json`, JSON.stringify(observations, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
