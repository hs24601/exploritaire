const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
async function props(page) {
  return page.locator('[data-environment-prop]').evaluateAll(els => els.map(el => {
    const d = el.dataset;
    const coordinate = value => { const m = value.match(/50%\s*([+-])\s*([-\d.]+)px/); return Number(m[2]) * (m[1] === '-' ? -1 : 1); };
    const x = coordinate(el.style.left), y = coordinate(el.style.top);
    const scale = Number(el.style.getPropertyValue('--scenery-fit-scale') || 1);
    const width = Number(d.sceneryWidth) * scale;
    for (const end of [-1, 1]) {
      if (Math.abs(x + end * width / 2 - Number(d.ownerX)) > Number(d.ownerWidth) / 2 + .01
        || Math.abs(y - Number(d.ownerY)) > Number(d.ownerHeight) / 2 + .01) throw new Error('Prop foot escapes owner');
    }
    return { id: d.biomePopup || `${d.biomeEdge}/${d.edge}/${d.sceneryX}/${d.sceneryY}`,
      left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height,
      transform: getComputedStyle(el).transform, scale, heading: d.sceneryHeading };
  }).sort((a, b) => a.id.localeCompare(b.id)));
}
async function orbit(page, width, scene) {
  await page.waitForTimeout(850);
  const original = await props(page);
  const initialYaw = await page.locator('.proto-map-viewport').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--camera-yaw')) || 0);
  assert.ok(original.length > 3, 'Several fixed props are rendered');
  assert.ok(original.every(prop => prop.heading === '0'));
  for (let step = 0; step <= 8; step++) {
    if (step) {
      const turn = page.getByRole('button', { name: 'Turn table right', exact: true });
      if (step % 2) await turn.click(); else await turn.tap();
      await page.waitForFunction(yaw => Math.abs(parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-yaw')) - yaw) < .01, initialYaw + step * 45);
      await page.waitForTimeout(250);
    }
    assert.deepEqual(await props(page), original, `Fixed position, size and plane at ${step * 45} degrees`);
    for (const id of ['pond', 'woods-alpha', 'woods-east']) {
      const label = page.locator(`[data-biome-title="${id}"]`);
      if (await label.count()) {
        assert.deepEqual(await findLayoutDefects(page, `[data-biome-title="${id}"]`, {parts: '.proto-tile-title, .proto-tile-title__line', minFontSize: 0}), [], 'Full-title fitting stays contained');
        assert.ok((await label.innerText()).replace(/\s/g, '').length > 3);
      }
    }
    if ([0, 1, 2, 4].includes(step)) await page.screenshot({ path: `artifacts/fixed-props-${width}-${scene}-${step * 45}-3x.png` });
  }
  assert.deepEqual(await findLayoutDefects(page, '.proto-map-footer', { parts: '.proto-map-readouts, .proto-map-fps, .proto-map-zoom, .proto-map-toolbar, .proto-map-camera-button, .table-grid-reference' }), []);
  await page.getByRole('button', { name: 'Reset View', exact: true }).click();
  await page.waitForTimeout(600);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(URL);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await orbit(page, width, 'home');
      const roof = page.locator('[data-biome-popup="hero-den"]');
      assert.equal(await roof.getAttribute('data-actor-occluder'), 'true', 'Fixed roof retains actor fading');
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).tap();
      await page.waitForTimeout(750);
      assert.equal(await page.locator('[data-environment-prop]').count(), 0);
      const from = centre(await page.locator('[data-cell-grip="actor-hero"]').boundingBox());
      const to = centre(await page.locator('button[data-biome-id="road-center"]').boundingBox());
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 15 }); await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('button[data-biome-id="woods-alpha"]').dataset.unexplored !== 'true');
      await page.waitForFunction(() => document.querySelector('[data-board-piece="actor"]')?.dataset.gridReference === 'table:0,0');
      await page.waitForTimeout(1000);
      const tilt = page.getByRole('button', { name: 'Tilt camera view', exact: true });
      if (await tilt.count()) await tilt.click();
      await page.locator('.proto-map[data-camera-view="immersive"]').waitFor();
      await page.waitForTimeout(1000);
      assert.ok(await page.locator('[data-biome-edge]').count(), 'Discovered woods and pond have edge props');
      await orbit(page, width, 'woods');
      assert.deepEqual(errors, []);
      console.log(`${width}: full orbit preserves prop planes, placement, dimensions and footprints; mouse/touch turn controls, roof occlusion, flat restore and footer layout pass.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
