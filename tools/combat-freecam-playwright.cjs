const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const out = 'artifacts/combat-freecam';
fs.mkdirSync(out, { recursive: true });
const url = 'http://localhost:5178/proto.html?combatdemo';
const parts = '.combat-demo__header, .combat-demo__header h1, .combat-demo__header p, .combat-demo__header button, .combat-demo__arena, .combat-demo__footer, .combat-demo__readout, .combat-demo__readout span, .combat-demo__camera-panel, .combat-demo__camera-heading, .combat-demo__camera-heading h2, .combat-demo__camera-heading p, .combat-demo__views, .combat-demo__view, .combat-demo__view svg, .combat-demo__view span, .combat-demo__replay, .combat-demo__freecam, .combat-demo__freecam p, .combat-demo__movement, .combat-demo__movement button, .combat-demo__diagnostics, .combat-demo__properties, .combat-demo__properties span, .combat-demo__copy';
const pose = page => page.locator('.combat-demo__arena').evaluate(el => ({ p: el.dataset.cameraPosition.split(',').map(Number), target: el.dataset.cameraTarget.split(',').map(Number) }));
const distance = shot => Math.hypot(...shot.p.map((n, i) => n - shot.target[i]));
const near = (a, b, tolerance = .015) => a.forEach((n, i) => assert.ok(Math.abs(n - b[i]) < tolerance, `${a} != ${b}`));
const select = async (page, view) => {
  await page.locator(`[data-view="${view}"]`).click();
  await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
};
const drag = async (page, dx, dy, button = 'left') => {
  const box = await page.locator('.combat-demo__arena').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down({ button });
  await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up({ button });
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.locator('[data-view="freecam"]:not(:disabled)').waitFor();
      await select(page, 'party');
      const party = await pose(page);
      await page.keyboard.down('w'); await page.waitForTimeout(180); await page.keyboard.up('w');
      assert.deepEqual(await pose(page), party, 'Freecam keys must not move a preset');
      await select(page, 'freecam');
      assert.deepEqual(await pose(page), party, 'Freecam inherits current shot');
      assert.equal(await page.locator('.combat-demo__properties [data-property]').count(), 6);
      await drag(page, 100, 35);
      const orbit = await pose(page);
      assert.notDeepEqual(orbit.p, party.p); near(orbit.target, party.target);
      assert.ok(Math.abs(distance(orbit) - distance(party)) < .01, 'Orbit keeps radius');
      await page.mouse.wheel(0, -250); await page.waitForTimeout(80);
      assert.ok(distance(await pose(page)) < distance(orbit), 'Wheel dollies toward aim');
      for (const key of ['w', 'a', 's', 'd', 'q', 'e']) {
        const before = await pose(page);
        await page.keyboard.down(key); await page.waitForTimeout(220); await page.keyboard.up(key);
        const after = await pose(page);
        assert.notDeepEqual(after.p, before.p, `${key} moves`);
        assert.notDeepEqual(after.target, before.target, `${key} translates aim`);
        near(after.p.map((n, i) => n - before.p[i]), after.target.map((n, i) => n - before.target[i]));
        if (key === 'q') assert.ok(after.p[1] < before.p[1]);
        if (key === 'e') assert.ok(after.p[1] > before.p[1]);
        await page.waitForTimeout(180); assert.deepEqual(await pose(page), after, 'Key release stops motion');
      }
      const beforePan = await pose(page); await drag(page, 30, 10, 'right');
      const afterPan = await pose(page); assert.notDeepEqual(afterPan.target, beforePan.target);
      near(afterPan.p.map((n, i) => n - beforePan.p[i]), afterPan.target.map((n, i) => n - beforePan.target[i]));
      await page.keyboard.down('d'); await page.waitForTimeout(100);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      const blurred = await pose(page);
      await page.waitForTimeout(180); assert.deepEqual(await pose(page), blurred, 'Blur clears held keys');
      await page.keyboard.up('d');
      await page.waitForFunction(() => document.querySelector('.combat-demo')?.dataset.complete === 'true');
      const final = await pose(page);
      await page.keyboard.down('e'); await page.waitForTimeout(200); await page.keyboard.up('e');
      assert.ok((await pose(page)).p[1] > final.p[1], 'Freecam works after final hold');
      await page.locator('.combat-demo__diagnostics summary').click();
      const readout = await page.locator('[data-property="position"]').innerText();
      (await pose(page)).p.forEach(n => assert.ok(readout.includes(n.toFixed(3)), 'Readout matches actual pose'));
      await page.getByRole('button', { name: 'Copy camera cue' }).click();
      const cue = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
      assert.equal(cue.t, 10); assert.equal(cue.fov, 45); near(cue.p, (await pose(page)).p, .001); near(cue.target, (await pose(page)).target, .001);
      const copied = await pose(page);
      await page.locator('.combat-demo__diagnostics summary').click();
      await page.getByRole('button', { name: 'Replay scene' }).click();
      await page.waitForTimeout(200); assert.deepEqual(await pose(page), copied, 'Replay preserves freecam pose');
      await page.setViewportSize({width: width === 1280 ? 1912 : 1280, height: height === 720 ? 914 : 720});
      await page.waitForTimeout(150); assert.deepEqual(await pose(page), copied, 'Resize preserves freecam pose');
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', {parts}), []);
      await page.setViewportSize({width, height}); await page.waitForTimeout(150);
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', {parts}), []);
      await page.screenshot({path: `${out}/freecam-${width}.png`, scale: 'css'});
      await page.locator('.combat-demo__footer').screenshot({path: `${out}/panel-${width}-3x.png`});
      await select(page, 'side'); assert.ok((await pose(page)).p[2] > 10, 'Preset restores framing');
      await select(page, 'cinematic'); const auto = await pose(page); await page.waitForTimeout(200); assert.notDeepEqual(await pose(page), auto);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.combat-demo').count(), 0);
      assert.deepEqual(errors, []); await context.close();
      console.log(`${width}: keyboard, orbit, pan, wheel, readouts/cue, idle hold, replay, resize, layout and 3x captures passed`);
    }
    const context = await browser.newContext({viewport: {width: 1280, height: 720}, hasTouch: true, reducedMotion: 'reduce'});
    const page = await context.newPage(); await page.goto(url);
    await page.locator('[data-view="freecam"]:not(:disabled)').waitFor(); await page.locator('[data-view="freecam"]').tap();
    const session = await context.newCDPSession(page);
    const touch = (type, points) => session.send('Input.dispatchTouchEvent', {type, touchPoints: points});
    const box = await page.locator('.combat-demo__arena').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const before = await pose(page);
    await touch('touchStart', [{x, y, id: 1}]); await touch('touchMove', [{x: x + 70, y: y + 20, id: 1}]); await touch('touchEnd', []);
    assert.notDeepEqual((await pose(page)).p, before.p); near((await pose(page)).target, before.target);
    for (const key of ['w', 'a', 's', 'd', 'q', 'e']) {
      const b = await page.locator(`[data-move="${key}"]`).boundingBox(), before = await pose(page);
      await touch('touchStart', [{x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1}]);
      await page.waitForTimeout(180); await touch('touchEnd', []);
      assert.notDeepEqual(await pose(page), before, 'Touch hold moves camera');
      const released = await pose(page); await page.waitForTimeout(150); assert.deepEqual(await pose(page), released);
    }
    await page.locator('[data-move="e"]').focus(); const beforeKeyboardButton = await pose(page);
    await page.keyboard.down('Enter'); await page.waitForTimeout(180); await page.keyboard.up('Enter');
    assert.ok((await pose(page)).p[1] > beforeKeyboardButton.p[1], 'Focused hold button works by keyboard');
    assert.deepEqual(await findLayoutDefects(page, '.combat-demo', {parts}), []);
    await context.close(); console.log('Touch orbit and all six hold controls, keyboard hold button and reduced motion passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
