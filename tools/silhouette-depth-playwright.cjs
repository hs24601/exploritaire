// Unexplored scenery must retain shaded planes and respond to the shared LE,
// without changing the exploration reveal, the sprite's placement, or input.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html?fx=high';
const OUT = process.env.SHOTS || 'artifacts/silhouette-depth';
fs.mkdirSync(OUT, { recursive: true });
const material = '[data-biome-popup="woods-alpha"] [data-silhouette-material="relief"] canvas';
const sample = (p, id = 'woods-alpha') => p.locator(`[data-biome-popup="${id}"] [data-silhouette-material="relief"] canvas`).evaluate(canvas => {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0, count = 0, hash = 0; const levels = new Set();
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 24) {
    sum += pixels[i + 1]; count++; levels.add(pixels[i + 1]); hash = (hash * 31 + pixels[i + 1]) | 0;
  }
  return { mean: sum / count, levels: levels.size, hash };
});
const setHour = async (p, hour) => {
  await p.getByLabel('Table time of day').evaluate((el, hour) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(hour));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, hour);
  await p.waitForFunction(hour => document.querySelector('.proto-lighting-rail')?.textContent.includes(`${String(hour).padStart(2, '0')}:00`), hour);
  await p.waitForTimeout(250);
};
const centre = async locator => { const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const visit = async (p, id) => {
  const actor = await centre(p.locator('[data-board-piece="actor"]'));
  const tile = await centre(p.locator(`button[data-biome-id="${id}"]`));
  await p.mouse.move(actor.x, actor.y); await p.mouse.down();
  await p.mouse.move(tile.x, tile.y, { steps: 14 }); await p.mouse.up();
  await p.waitForFunction(id => !document.querySelector(`button[data-biome-id="${id}"]`).dataset.unexplored, id);
  await p.waitForTimeout(1150);
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(URL); await p.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await p.locator(material).waitFor(); await p.waitForTimeout(800);
      const day = await sample(p);
      assert.ok(day.levels > 12, 'unexplored foliage has multiple shaded planes');
      const geometry = await p.locator(material).evaluate(canvas => {
        const art = canvas.closest('.proto-reveal').querySelector('.proto-sprite-standee__art');
        const computed = getComputedStyle(art);
        return { canvasSize: `${canvas.style.width} ${canvas.style.height}`, artSize: computed.backgroundSize,
          canvasPosition: `${canvas.style.left} ${canvas.style.top}`, artPosition: computed.backgroundPosition };
      });
      assert.equal(geometry.canvasSize, geometry.artSize, 'relief matches colour art scale');
      assert.equal(geometry.canvasPosition, geometry.artPosition, 'relief matches colour art feet');
      assert.deepEqual(await findLayoutDefects(p, '.proto-map-viewport', { parts: '[data-biome-popup="woods-alpha"]', minFontSize: 0 }), []);
      assert.ok(await p.locator('[data-shadow-owner="biome"]').count(), 'silhouettes retain cast shadows');
      await p.screenshot({ path: `${OUT}/${width}-day-3x.png` });
      await setHour(p, 0); const night = await sample(p);
      assert.ok(night.mean < day.mean, `moonlit relief is darker than daylight (${night.mean.toFixed(1)} vs ${day.mean.toFixed(1)})`);
      await p.screenshot({ path: `${OUT}/${width}-night-3x.png` });
      // The opening candle is outside these pines' reach. Move the actor one
      // cell closer, to empty True Center, and verify the material receives it.
      const actor = await centre(p.locator('[data-board-piece="actor"]'));
      const origin = await centre(p.locator('.table-grid-origin'));
      await p.mouse.move(actor.x, actor.y); await p.mouse.down();
      await p.mouse.move(origin.x, origin.y, { steps: 12 }); await p.mouse.up();
      await p.waitForFunction(() => document.querySelector('[data-board-piece="actor"]')?.dataset.gridReference === 'table:0,0');
      await p.waitForTimeout(400);
      assert.ok((await sample(p)).mean > night.mean, 'nearby carried light reaches unexplored relief');
      await setHour(p, 17); const evening = await sample(p);
      assert.notEqual(evening.hash, day.hash, 'moving sun relights the foliage');
      const dangerEvening = await sample(p, 'woods-danger');
      await p.getByRole('button', { name: 'Turn table right', exact: true }).click(); await p.waitForTimeout(450);
      await p.getByRole('button', { name: 'Turn table right', exact: true }).click(); await p.waitForTimeout(550);
      // Neighbouring labels can legitimately trim away a woods pop-up at a
      // quarter turn; the isolated Dark Woods remain present in both views.
      assert.notEqual((await sample(p, 'woods-danger')).hash, dangerEvening.hash, 'relief follows camera-frame light direction');
      await p.screenshot({ path: `${OUT}/${width}-spun-3x.png` });
      await p.getByRole('button', { name: 'Reset View', exact: true }).click();
      await p.getByRole('button', { name: 'Flat camera view', exact: true }).click(); await p.waitForTimeout(800);
      assert.equal(await p.locator('[data-silhouette-material="relief"]').count(), 0, 'flat keeps top-down board presentation');
      await setHour(p, 9); await visit(p, 'woods-alpha');
      await p.getByRole('button', { name: 'Tilt camera view', exact: true }).click(); await p.waitForTimeout(900);
      assert.equal(await p.locator('[data-biome-popup="woods-alpha"] .proto-reveal').getAttribute('data-reveal'), '0.10');
      assert.ok(await p.locator(material).count(), 'unrevealed share retains relief at first visit');
      assert.ok((await p.locator('[data-biome-popup="woods-alpha"] .proto-reveal__lit').evaluate(e => getComputedStyle(e).maskImage)).includes('svg'), 'partial colour keeps the stepped reveal mask');
      await p.screenshot({ path: `${OUT}/${width}-partial-3x.png` });
      await p.getByRole('button', { name: 'Flat camera view', exact: true }).click(); await p.waitForTimeout(750);
      await p.getByRole('button', { name: /^Exit tableau/ }).first().click(); await p.waitForTimeout(2200);
      await visit(p, 'pond');
      await p.getByRole('button', { name: 'Tilt camera view', exact: true }).click(); await p.waitForTimeout(950);
      assert.equal(await p.locator('[data-biome-popup="pond"] .proto-reveal').count(), 0, 'fully explored pond uses original colour art');
      assert.deepEqual(errors, [], 'no page errors');
      console.log(`${width}x${height}: shaded facets, day/night, spin, matching geometry, shadows, flat/tilt, partial/full reveal passed.`);
      await p.context().close();
    }
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await p.goto(URL); await p.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
    await p.locator(material).waitFor(); assert.ok((await sample(p)).levels > 12, 'reduced motion still has static relief');
    await p.context().close();
    console.log('Reduced motion retains static silhouette relief.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
