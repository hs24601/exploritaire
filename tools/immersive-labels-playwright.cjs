const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
async function check(page) {
  const result = await page.evaluate(() => {
    const box = el => el.getBoundingClientRect();
    const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const labels = [...document.querySelectorAll('.proto-projected-title')].filter(el => getComputedStyle(el).display !== 'none').map(el => ({ text: el.textContent, box: box(el).toJSON(), lift: el.dataset.labelLift }));
    const actors = [...document.querySelectorAll('[data-physical-world] [data-board-piece="actor"]')].map(el => el.getBoundingClientRect());
    const conflicts = labels.flatMap((label, index) => [
      ...actors.filter(actor => overlap(label.box, actor)).map(() => label.text + ' covers actor'),
      ...labels.slice(index + 1).filter(other => overlap(label.box, other.box)).map(other => label.text + ' overlaps ' + other.text),
    ]);
    return { labels, conflicts };
  });
  assert.deepEqual(result.conflicts, []);
  assert.ok(result.labels.every(label => Number.isFinite(Number(label.lift))));
  const den = result.labels.find(label => label.text === "HERO'S DEN");
  const mountains = result.labels.find(label => label.text === 'IMPASSABLE MOUNTAINS');
  if (den && mountains && den.box.left < mountains.box.right && den.box.right > mountains.box.left)
    assert.ok(mountains.box.bottom < den.box.top, 'Mountain title sits above the nearby den title');
  return result;
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 1912]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      assert.equal((await page.goto(URL)).status(), 200);
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1200);
      console.log(width, 'initial', await check(page));
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-toolbar', { parts: 'button' }), []);
      // Reproduce the standing Hero in front of the empty den from the report.
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(800);
      const grip = await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const destination = await page.locator('[data-board-piece="tile"][data-grid-reference="table:0,1"]').boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
      await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 15 }); await page.mouse.up();
      await page.waitForTimeout(1800);
      assert.equal(await page.locator('[data-board-piece="actor"]').getAttribute('data-actor-pose'), 'sitting');
      await page.locator('[data-biome-id="hero-den"]').focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Open tableau', exact: true }).click();
      await page.waitForTimeout(1000);
      await page.keyboard.press('Escape');
      if (await page.getByRole('button', { name: 'Tilt camera view', exact: true }).count())
        await page.getByRole('button', { name: 'Tilt camera view', exact: true }).click();
      await page.waitForTimeout(1000);
      const focusedViewport = await page.locator('.proto-map-viewport').boundingBox();
      await page.mouse.move(focusedViewport.x + focusedViewport.width * .75, focusedViewport.y + focusedViewport.height * .5);
      for (let step = 0; step < 36; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(20); }
      await page.waitForTimeout(1000);
      console.log(width, 'close', await check(page));
      assert.ok((await page.locator('.proto-projected-title:visible').count()) >= 2, 'Close view retains den and mountain titles');
      console.log(await page.locator('.proto-map-zoom').textContent());
      assert.deepEqual(await findLayoutDefects(page, '.proto-map-viewport', { parts: '.proto-projected-title' }), []);
      await page.screenshot({ path: `artifacts/immersive-labels-${width}-close-3x.png` });
      for (let turn = 0; turn < 8; turn++) {
        await page.getByRole('button', { name: 'Turn table right', exact: true }).click();
        await page.waitForTimeout(650);
        await check(page);
      }
      await page.getByRole('button', { name: 'Flat camera view', exact: true }).click();
      await page.waitForTimeout(800);
      assert.equal(await page.locator('[data-label-lift]').count(), 0, 'OTT resets all depth offsets');
      assert.deepEqual(errors, []);
      await page.close();
      console.log(width, 'initial, close zoom, full orbit and OTT reset passed');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
