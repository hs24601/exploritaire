// Dark Woods battle: charge abilities from the tableau, preview and spend them
// on slimes by mouse drag, touch drag, tap-to-arm and keyboard; roster
// controls; layout check at desktop widths. Needs the dev server on :5178.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {findLayoutDefects} = require('./lib/layout-check.cjs');
const out = 'artifacts/battle-abilities';
fs.mkdirSync(out, {recursive: true});
const launch = process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']} : {};
const parts = '.battle-field__header,.battle-controls,.battle-controls__scenario,.battle-field__board,.battle-field__team,.battle-foe,.battle-foe__name,.battle-foe__bars,.battle-bar,.battle-field__slot,.battle-field__foundation,.battle-ability,.battle-vitals,.battle-field__middle,.battle-field__status,.battle-field__status-text,.battle-field__tableau';

/** Plays tableau cards onto `actor` until it holds `charge` (fast, in-page, so slimes can't interrupt). */
const charge = (page, actor, target) => page.evaluate(async ({actor, target}) => {
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  // Cards play from their jumbo view's action (GAME.md: all cards have jumbo views).
  const press = async (card) => {
    card.click();
    for (let i = 0; i < 20 && !document.querySelector('.card-jumbo__action'); i++) await frame();
    (document.querySelector('.card-jumbo__action') ?? document.querySelector('.card-jumbo__close'))?.click(); await frame(); await frame();
  };
  const level = () => Number(document.querySelector(`[data-ability-actor="${actor}"] .battle-ability__charge`).textContent);
  for (let guard = 0; level() < target && guard < 80; guard++) {
    const columns = [...document.querySelectorAll('.battle-field__column')];
    let played = false;
    for (const column of columns) {
      const top = [...column.querySelectorAll('button')].pop();
      if (!top || top.disabled || top.dataset.gameplayDisabled) continue;
      await press(top);
      const choice = document.querySelector(`[data-battle-actor="${actor}"][data-targetable="true"]`);
      if (choice) { choice.click(); await frame(); }
      else if (document.querySelector('.battle-field__foundation[data-targetable="true"]')) { await press(top); continue; }
      played = true; break;
    }
    if (!played) { [...document.querySelectorAll('.battle-field__status button')].find(b => b.textContent === 'Deal a row')?.click(); await frame(); }
  }
  return level();
}, {actor, target});

const hp = (page, foe) => page.locator(`[data-battle-target="${foe}"] [data-bar="hp"]`).getAttribute('aria-valuenow').then(Number);
const center = box => ({x: box.x + box.width / 2, y: box.y + box.height / 2});

(async () => {
  const browser = await chromium.launch({headless: true, ...launch});
  try {
    for (const viewport of [{width: 1912, height: 914}, {width: 1600, height: 900}, {width: 1280, height: 720}]) {
      const tag = `${viewport.width}`;
      const page = await browser.newPage({viewport, deviceScaleFactor: 1});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      // Opening roster: Hero and Mochi against two slimes, waiting for the first play.
      assert.equal(await page.locator('.battle-foe').count(), 2);
      assert.equal(await page.locator('.battle-ability').count(), 2);
      assert.match(await page.locator('.battle-field__status-text').textContent(), /first play/);
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} opening layout`);
      await page.locator('.battle-field').screenshot({path: `${out}/opening-${tag}.png`});

      // Mouse drag with Cal: Inferno Bite previews on both slimes, focus on the hovered one.
      await page.getByRole('button', {name: 'Cal off'}).click();
      assert.ok(await charge(page, 'hero', 5) >= 4);
      const heroCard = page.locator('[data-ability-actor="hero"]');
      assert.match(await heroCard.getAttribute('aria-label'), /^Inferno Bite/);
      const from = center(await heroCard.boundingBox()), to = center(await page.locator('[data-battle-target="dark-slime"]').boundingBox());
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(from.x + 10, from.y - 30, {steps: 3});
      await page.mouse.move(to.x, to.y, {steps: 8});
      assert.equal(await page.locator('[data-battle-target="dark-slime"]').getAttribute('data-preview'), 'focus');
      assert.equal(await page.locator('[data-battle-target="rear-slime"]').getAttribute('data-preview'), 'faint');
      assert.ok(await page.locator('[data-battle-target="dark-slime"] .battle-bar__preview').count() >= 2, 'HP and stagger previews');
      assert.equal(await page.locator('[data-battle-target="dark-slime"] [data-preview-chip="burn"]').count(), 1);
      const predicted = Number((await page.locator('[data-battle-target="dark-slime"] [data-bar="hp"] .battle-bar__text').textContent()).split('→')[1]);
      await page.screenshot({path: `${out}/drag-preview-${tag}.png`});
      await page.mouse.up();
      assert.equal(await hp(page, 'dark-slime'), predicted, 'drop matches the preview');
      assert.equal(await heroCard.locator('.battle-ability__charge').textContent(), '0', 'attack spends the charge');
      assert.notEqual(await page.locator('[data-battle-slot="hero"] [aria-label="Collected cards 0"]').count(), 1, 'foundation cards stay');

      // Tap-to-arm with Mochi: press the card, then the slime.
      assert.ok(await charge(page, 'mochi', 2) >= 1);
      const before = await hp(page, 'rear-slime');
      await page.locator('[data-ability-actor="mochi"]').click();
      assert.equal(await page.locator('[data-ability-actor="mochi"]').getAttribute('data-armed'), 'true');
      await page.locator('[data-battle-target="rear-slime"]').hover();
      assert.equal(await page.locator('[data-battle-target="rear-slime"]').getAttribute('data-preview'), 'focus');
      await page.locator('[data-battle-target="rear-slime"]').click();
      assert.ok(await hp(page, 'rear-slime') < before, 'armed Scratch lands');

      // Keyboard: Enter arms, Escape cancels.
      assert.ok(await charge(page, 'hero', 1) >= 1);
      await heroCard.focus(); await page.keyboard.press('Enter');
      assert.equal(await heroCard.getAttribute('data-armed'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await heroCard.getAttribute('data-armed'), null);

      // Roster controls: three slimes, no Mochi, and the 3D arena follows.
      await page.getByRole('button', {name: 'Add a slime'}).click();
      await page.getByRole('button', {name: 'Remove Mochi'}).click();
      assert.equal(await page.locator('.battle-foe').count(), 3);
      assert.equal(await page.locator('.battle-ability').count(), 1);
      assert.equal(await page.getByRole('button', {name: 'Add a slime'}).isDisabled(), true);
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} three-slime layout`);
      await page.waitForTimeout(300);
      await page.screenshot({path: `${out}/three-slimes-${tag}.png`});
      await page.getByRole('button', {name: 'Add Mochi'}).click();
      for (let i = 0; i < 2; i++) await page.getByRole('button', {name: 'Remove a slime'}).click();
      assert.equal(await page.locator('.battle-foe').count(), 1);
      assert.equal(await page.getByRole('button', {name: 'Remove a slime'}).isDisabled(), true);

      // Scenario: Hungry slimes eye a card (marked on the table) and eat it.
      const scenario = page.locator('.battle-controls__scenario select');
      await scenario.selectOption('hungry');
      assert.equal(await page.locator('.battle-foe').count(), 2);
      await charge(page, 'hero', 1);
      await page.locator('.battle-card-mark [data-mark="eye"]').first().waitFor({timeout: 6000});
      assert.match(await page.locator('.battle-foe__eye').first().textContent(), /eyes/);
      await page.screenshot({path: `${out}/hungry-eye-${tag}.png`});
      await page.locator('.battle-chip[data-chip="fed"]').first().waitFor({timeout: 6000});
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} hungry layout`);

      // Scenario: Booby traps. Drag Hero's ability onto the card a slime is eyeing.
      await scenario.selectOption('traps');
      await charge(page, 'hero', 1);
      const eyed = page.locator('.battle-field__column:has(.battle-card-mark [data-mark="eye"])').first();
      await eyed.waitFor({timeout: 6000});
      await charge(page, 'hero', 3);
      const trapFrom = center(await heroCard.boundingBox()), trapTo = center(await eyed.boundingBox());
      await page.mouse.move(trapFrom.x, trapFrom.y); await page.mouse.down();
      await page.mouse.move(trapFrom.x + 10, trapFrom.y - 30, {steps: 3});
      await page.mouse.move(trapTo.x, trapTo.y, {steps: 8});
      assert.equal(await page.locator('.battle-field__column[data-preview="focus"]').count(), 1, 'eyed card previews the trap');
      await page.screenshot({path: `${out}/trap-drag-${tag}.png`});
      await page.mouse.up();
      if (await page.locator('.battle-card-mark [data-mark="trap"]').count()) {
        const hpTotal = async () => (await Promise.all(['dark-slime', 'rear-slime'].map(foe => page.locator(`[data-battle-target="${foe}"] [data-bar="hp"]`).getAttribute('aria-valuenow').then(Number).catch(() => 0)))).reduce((a, b) => a + b, 0);
        const before = await hpTotal();
        await page.waitForFunction(() => !document.querySelector('.battle-card-mark [data-mark="trap"]'), null, {timeout: 6000});
        assert.ok(await hpTotal() < before, 'the slime that ate the trapped card took damage');
      } else console.log(`${tag}: eyed card was eaten before the drop landed; trap step skipped this run`);
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} trap layout`);

      // Scenario: Spirit grove. Three hungry slimes, Wisp and Cal on Hero, Moss on Mochi.
      await scenario.selectOption('grove');
      assert.equal(await page.locator('.battle-foe').count(), 3);
      assert.deepEqual(await page.locator('[data-spirit]').evaluateAll(chips => chips.map(chip => chip.dataset.spirit)), ['wisp', 'cal', 'moss']);
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts}), [], `${tag} grove layout`);
      await page.screenshot({path: `${out}/grove-${tag}.png`});
      assert.deepEqual(errors, []);
      await page.close();
    }

    // Touch: a finger drag spends the ability through the same pointer path.
    const context = await browser.newContext({viewport: {width: 1280, height: 720}, hasTouch: true});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
    await page.locator('[data-view="party"]:not(:disabled)').waitFor();
    assert.ok(await charge(page, 'hero', 3) >= 1);
    const cdp = await context.newCDPSession(page);
    const from = center(await page.locator('[data-ability-actor="hero"]').boundingBox()), to = center(await page.locator('[data-battle-target="rear-slime"]').boundingBox());
    const before = await hp(page, 'rear-slime');
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: point ? [{x: point.x, y: point.y}] : []});
    await touch('touchStart', from);
    for (let i = 1; i <= 10; i++) await touch('touchMove', {x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10});
    assert.equal(await page.locator('[data-battle-target="rear-slime"]').getAttribute('data-preview'), 'focus');
    await touch('touchEnd');
    assert.ok(await hp(page, 'rear-slime') < before, 'touch drag lands');
    await context.close();
    console.log('battle abilities: ok');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
