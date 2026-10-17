const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const out = 'artifacts/combat-camera';
fs.mkdirSync(out, { recursive: true });
const url = 'http://localhost:5178/proto.html?combatdemo';
const parts = '.combat-demo__header, .combat-demo__header h1, .combat-demo__header p, .combat-demo__header button, .combat-demo__arena, .combat-demo__footer, .combat-demo__readout, .combat-demo__readout span, .combat-demo__camera-panel, .combat-demo__camera-heading, .combat-demo__camera-heading h2, .combat-demo__camera-heading p, .combat-demo__views, .combat-demo__view, .combat-demo__view svg, .combat-demo__view span, .combat-demo__replay';
const position = page => page.locator('.combat-demo__arena').getAttribute('data-camera-position').then(value => value.split(',').map(Number));
const select = async (page, view, touch = false) => {
  const button = page.locator(`[data-view="${view}"]`);
  if (touch) await button.tap(); else await button.click();
  await page.waitForFunction(view => document.querySelector('.combat-demo')?.dataset.cameraView === view && document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false', view);
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.combat-demo__view[aria-pressed="true"]').count(), 1);
  return position(page);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280, 720], [1912, 914]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('.combat-demo__view:not(:disabled)').first().waitFor();
      const side = await select(page, 'side');
      assert.ok(side[1] < 4 && side[2] > 10, 'Side is a low shot across both teams');
      const wolfSeparation = await page.locator('.combat-demo__arena').evaluate(el => {
        const eye = el.dataset.cameraPosition.split(',').map(Number);
        const target = el.dataset.cameraTarget.split(',').map(Number);
        const forward = target.map((n, i) => n - eye[i]);
        const length = Math.hypot(...forward);
        const direction = forward.map(n => n / length);
        const rightLength = Math.hypot(direction[0], direction[2]);
        const right = [-direction[2] / rightLength, 0, direction[0] / rightLength];
        const projectX = point => {
          const delta = point.map((n, i) => n - eye[i]);
          const dot = vector => delta.reduce((sum, n, i) => sum + n * vector[i], 0);
          return dot(right) / dot(direction) * el.clientHeight / (2 * Math.tan(Math.PI / 8));
        };
        return Math.abs(projectX([3, 1.3, 0]) - projectX([4, 1.1, -2.8]));
      });
      assert.ok(wolfSeparation > 40, 'Side shot keeps the rear wolf visible beside the lead wolf');
      const timeBefore = Number(await page.locator('.combat-demo').getAttribute('data-elapsed'));
      await page.waitForTimeout(700);
      assert.deepEqual(await position(page), side, 'Manual camera holds while action continues');
      assert.ok(Number(await page.locator('.combat-demo').getAttribute('data-elapsed')) > timeBefore);
      await page.screenshot({ path: `${out}/side-${width}.png`, scale: 'css' });
      const party = await select(page, 'party');
      assert.ok(party[0] < -5 && party[2] > 0, 'Party view looks from the hero side');
      await page.screenshot({ path: `${out}/party-${width}.png`, scale: 'css' });
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts }), []);

      // Buttons participate in ordinary keyboard traversal and activation.
      await page.locator('[data-view="side"]').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-view="party"]').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      assert.equal(await page.locator('[data-view="enemy"]').getAttribute('aria-pressed'), 'true');
      assert.ok((await position(page))[0] > 5, 'Enemy is the reverse view');
      await page.screenshot({ path: `${out}/enemy-${width}.png`, scale: 'css' });
      const overview = await select(page, 'overview');
      assert.ok(overview[1] > 10, 'Overview rises over the arena');
      await page.screenshot({ path: `${out}/overview-${width}.png`, scale: 'css' });
      await select(page, 'cinematic');
      const auto = await position(page);
      await page.waitForTimeout(500);
      assert.notDeepEqual(await position(page), auto, 'Cinematic resumes its timed camera');
      await page.waitForFunction(() => document.querySelector('.combat-demo')?.dataset.complete === 'true');
      await select(page, 'party');
      assert.equal(await page.locator('.combat-demo').getAttribute('data-elapsed'), '10.0');
      await page.locator('.combat-demo__footer').screenshot({ path: `${out}/panel-${width}-3x.png` });
      await page.setViewportSize({ width: width === 1280 ? 1912 : 1280, height: height === 720 ? 914 : 720 });
      await page.waitForTimeout(150);
      assert.deepEqual(await position(page), party, 'Resize preserves the held view');
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts }), []);

      // Reversing angles or changing again mid-transition stays outside the battle.
      await page.locator('[data-view="enemy"]').click();
      await page.waitForTimeout(220);
      const halfway = await position(page);
      assert.ok(Math.hypot(halfway[0], halfway[2]) > 10, 'Transition orbits instead of crossing the actors');
      await select(page, 'side');
      await page.getByRole('button', { name: 'Replay scene' }).click();
      await page.waitForFunction(() => Number(document.querySelector('.combat-demo')?.dataset.elapsed) < 1);
      assert.deepEqual(await position(page), side, 'Replay preserves the camera selection');
      await page.getByRole('button', { name: 'Return to table · Esc' }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-view="cinematic"]').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.getByRole('button', { name: 'Return to table · Esc' }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.combat-demo').count(), 0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${width}: framing, manual hold, auto resume, post-demo switching, replay, resize, keyboard, layout and 3x capture passed`);
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('.combat-demo__view:not(:disabled)').first().waitFor();
    for (const view of ['side', 'party', 'enemy', 'overview', 'cinematic']) {
      await select(page, view, true);
      assert.equal(await page.locator('.combat-demo__arena').getAttribute('data-camera-moving'), 'false');
    }
    await page.getByRole('button', { name: 'Replay scene' }).tap();
    await page.getByRole('button', { name: 'Return to table · Esc' }).tap();
    assert.equal(await page.locator('.combat-demo').count(), 0);
    await context.close();
    console.log('Touch activation for every camera, replay and dismissal; reduced-motion switching passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
