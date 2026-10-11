// Dark Woods battle effects: an ability play lunges and bites (or scratches),
// targets flinch, a beaten slime flashes and evaporates in both the cards and
// the 3D arena, and a fallen party actor tips over and stays down. Effects
// stay out of reduced motion. Layout check at desktop widths with an actor down.
// Needs the dev server on :5178. The page clock is driven so the slimes' real-time
// attacks can be stepped through quickly.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {findLayoutDefects} = require('./lib/layout-check.cjs');
const out = 'artifacts/battle-fx';
fs.mkdirSync(out, {recursive: true});
const launch = process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']} : {};
const parts = '.battle-field__header,.battle-field__board,.battle-field__team,.battle-foe,.battle-foe__name,.battle-field__slot,.battle-field__foundation,.battle-ability,.battle-vitals,.battle-field__middle,.battle-field__status,.battle-field__tableau';

/** Plays tableau cards (through each card's jumbo action) onto `actor` until it holds `target` charge. */
const charge = (page, actor, target) => page.evaluate(async ({actor, target}) => {
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const press = async (card) => {
    card.click();
    for (let i = 0; i < 20 && !document.querySelector('.card-jumbo__action'); i++) await frame();
    (document.querySelector('.card-jumbo__action') ?? document.querySelector('.card-jumbo__close'))?.click(); await frame(); await frame();
  };
  const level = () => Number(document.querySelector(`[data-ability-actor="${actor}"] .battle-ability__charge`).textContent);
  for (let guard = 0; level() < target && guard < 80; guard++) {
    let played = false;
    for (const column of document.querySelectorAll('.battle-field__column')) {
      const top = [...column.querySelectorAll('button')].pop();
      if (!top || top.dataset.gameplayDisabled) continue;
      await press(top);
      const choice = document.querySelector(`[data-battle-actor="${actor}"][data-targetable="true"]`);
      if (choice) { choice.click(); for (let i = 0; i < 20 && !document.querySelector('.card-jumbo__action'); i++) await frame(); document.querySelector('.card-jumbo__action')?.click(); await frame(); }
      else if (document.querySelector('.battle-field__foundation[data-targetable="true"]')) { await press(top); continue; }
      played = true; break;
    }
    if (!played) { [...document.querySelectorAll('.battle-field__status button')].find(b => b.textContent === 'Deal a row')?.click(); await frame(); }
  }
  return level();
}, {actor, target});
const arena = page => page.locator('.combat-demo__arena').getAttribute('data-actors').then(JSON.parse);
const unit = async (page, id) => (await arena(page)).find(a => a.id === id);
/** Stops the page clock just ahead of its own (possibly fast-forwarded) time. */
const pause = async page => page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));

(async () => {
  const browser = await chromium.launch({headless: true, ...launch});
  try {
    const widths = (process.env.WIDTHS ?? '1912,1600,1280').split(',').map(Number);
    for (const viewport of [{width: 1912, height: 914}, {width: 1600, height: 900}, {width: 1280, height: 720}].filter(v => widths.includes(v.width))) {
      const tag = `${viewport.width}`;
      const page = await browser.newPage({viewport, deviceScaleFactor: 1});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      await page.waitForTimeout(500);

      // Takedown at charge 8 beats a full slime: jaws on the card, a lunge in the arena, then evaporation.
      assert.ok(await charge(page, 'hero', 8) >= 8);
      const home = (await unit(page, 'hero')).position[0];
      await pause(page);
      await page.locator('[data-ability-actor="hero"]').click();
      await page.locator('[data-battle-target="dark-slime"]').click();
      await page.clock.runFor(1);
      assert.equal(await page.locator('.battle-fx-jaws').count(), 1, `${tag} jaws over the slime`);
      await page.clock.runFor(200);
      assert.ok((await unit(page, 'hero')).position[0] > home + 1, `${tag} Hero lunges at the slime`);
      assert.equal(await page.locator('[data-battle-target="dark-slime"]').getAttribute('data-state'), 'down');
      await page.clock.runFor(500);
      await page.screenshot({path: `${out}/evaporate-${tag}.png`});
      assert.equal((await unit(page, 'dark-slime')).visible, true, `${tag} the beaten slime is still evaporating`);
      await page.clock.runFor(1500);
      assert.equal((await unit(page, 'dark-slime')).visible, false, `${tag} the slime has evaporated`);
      assert.ok(Math.abs((await unit(page, 'hero')).position[0] - home) < .01, `${tag} Hero is back home`);

      // Mochi's Scratch rakes the other slime. (Charging plays cards frame by frame, so the clock runs.)
      await page.clock.resume();
      assert.ok(await charge(page, 'mochi', 2) >= 1);
      await pause(page);
      await page.locator('[data-ability-actor="mochi"]').click();
      await page.locator('[data-battle-target="rear-slime"]').click();
      await page.clock.runFor(1);
      assert.equal(await page.locator('.battle-fx-claws').count(), 1, `${tag} claws over the slime`);

      // Without Mochi, the slime wears Hero down: flinches on each hit, then the fall that holds.
      await page.getByRole('button', {name: 'Remove Mochi'}).click();
      const hp = () => page.locator('[data-battle-slot="hero"] [data-bar="hp"]').getAttribute('aria-valuenow').then(Number);
      for (let guard = 0; await hp() > 0 && guard < 60; guard++) await page.clock.runFor(1000);
      assert.equal(await hp(), 0);
      await page.clock.runFor(3000);
      assert.ok((await unit(page, 'hero')).tip > 1.3, `${tag} Hero lies down in the arena`);
      assert.equal((await unit(page, 'hero')).visible, true);
      assert.equal(await page.locator('[data-battle-slot="hero"]').getAttribute('data-down'), 'true');
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} layout with Hero down`);
      await page.screenshot({path: `${out}/down-${tag}.png`});
      // Fight again: Hero stands back up.
      await page.getByRole('button', {name: 'Fight again'}).click();
      await page.clock.runFor(100);
      assert.equal((await unit(page, 'hero')).tip, 0, `${tag} Hero is up again`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    // Reduced motion: no effect elements; the held states still change.
    const context = await browser.newContext({viewport: {width: 1600, height: 900}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
    await page.locator('[data-view="party"]:not(:disabled)').waitFor();
    assert.ok(await charge(page, 'hero', 8) >= 8);
    await page.locator('[data-ability-actor="hero"]').click();
    await page.locator('[data-battle-target="dark-slime"]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.battle-fx-layer > *').count(), 0, 'reduced motion: no effects');
    assert.equal(await page.locator('[data-battle-target="dark-slime"]').getAttribute('data-state'), 'down');
    await page.waitForTimeout(300);
    assert.equal((await unit(page, 'dark-slime')).visible, false, 'reduced motion: the slime leaves at once');
    await context.close();
    console.log('battle fx: ok');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
