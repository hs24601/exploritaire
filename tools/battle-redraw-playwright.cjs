// Dark Woods battle: each party foundation's Redraw swaps its value for a new
// one at 1 inspiration (rules/redraw.ts), by mouse, touch and keyboard, and is
// disabled at 0 inspiration. Layout check at desktop widths. Needs the dev server on :5178.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {findLayoutDefects} = require('./lib/layout-check.cjs');
const out = 'artifacts/battle-redraw';
fs.mkdirSync(out, {recursive: true});
const parts = '.battle-field__slot,.battle-field__foundation,.battle-field__redraw,.proto-foundation-count-token,.battle-ability,.battle-vitals';
const rank = (page, actor) => page.locator(`[data-battle-actor="${actor}"] .battle-field__actor-card`).innerText();
const left = (page, actor) => page.locator(`[data-redraw-actor="${actor}"]`).innerText().then(text => Number(text.replace(/\D/g, "")));

(async () => {
  const browser = await chromium.launch({headless: true});
  const problems = [];
  try {
    for (const viewport of [{width: 1912, height: 914}, {width: 1600, height: 900}, {width: 1280, height: 720}]) {
      const tag = `${viewport.width}`;
      const context = await browser.newContext({viewport, deviceScaleFactor: 1, hasTouch: true});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-redraw-actor="hero"]').waitFor();
      assert.equal(await page.locator('.battle-field__redraw').count(), 2, `${tag} one Redraw per party foundation`);
      assert.equal(await left(page, 'hero'), 4, `${tag} Hero comes in with full inspiration`);
      for (const actor of ['hero', 'mochi']) {
        const size = await page.locator(`[data-redraw-actor="${actor}"]`).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        assert.ok(size >= 16, `${tag} redraw text is ${size}px`);
      }
      // Mouse: a new value, 1 inspiration.
      const before = await rank(page, 'hero');
      await page.locator('[data-redraw-actor="hero"]').click();
      assert.notEqual(await rank(page, 'hero'), before, `${tag} redraw changes the foundation value`);
      assert.equal(await left(page, 'hero'), 3);
      assert.match(await page.locator('.battle-field [role="status"]').textContent(), /Hero redraws/);
      // Touch on Mochi.
      const box = await page.locator('[data-redraw-actor="mochi"]').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await left(page, 'mochi'), 3, `${tag} touch redraw`);
      // Keyboard.
      await page.locator('[data-redraw-actor="hero"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await left(page, 'hero'), 2, `${tag} keyboard redraw`);
      for (const p of await findLayoutDefects(page, '.battle-field__team[data-team="party"]', {parts})) problems.push(`${tag}: ${p}`);
      await page.locator('.battle-field__team[data-team="party"]').screenshot({path: `${out}/party-${tag}.png`});
      await page.locator('.battle-field').screenshot({path: `${out}/field-${tag}.png`});
      for (const p of await findLayoutDefects(page, '.battle-field', {parts: '.battle-field__board,.battle-field__team,.battle-field__middle,.battle-field__status,.battle-field__tableau,' + parts})) problems.push(`${tag} field: ${p}`);
      // Spend the rest: disabled at 0, and Restart keeps what was spent.
      await page.locator('[data-redraw-actor="hero"]').click();
      await page.locator('[data-redraw-actor="hero"]').click();
      assert.equal(await left(page, 'hero'), 0);
      assert.ok(await page.locator('[data-redraw-actor="hero"]').isDisabled(), `${tag} no redraw at 0 inspiration`);
      await page.getByRole('button', {name: 'Restart', exact: true}).click();
      assert.equal(await left(page, 'hero'), 0, `${tag} restart keeps spent inspiration`);
      await page.locator('.battle-field__team[data-team="party"]').screenshot({path: `${out}/party-empty-${tag}.png`});
      assert.deepEqual(errors, []);
      await context.close();
    }
    assert.deepEqual(problems, [], 'layout defects:\n' + problems.join('\n'));
    console.log('battle redraw: ok');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
