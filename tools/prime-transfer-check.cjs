const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const hero = page.locator('[data-battle-actor=hero]');
    const mochi = page.locator('[data-battle-actor=mochi]');
    const value = page.locator('.prime-tableau-value');
    const gauge = page.locator('.battle-momentum-overlay [data-flame-dial]');
    const momentumSelector = '.battle-momentum-overlay .momentum-engine__value .sr-only';
    const momentum = page.locator(momentumSelector);
    const readMomentum = async () => (await momentum.textContent()).trim();
    const drag = async (from, to) => {
      const a = await from.boundingBox();
      const z = await to.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 12 });
      await page.mouse.up();
    };
    // Seed three playable cards while using the real input and receipt handlers.
    await page.route('**/src/proto/components/BattleTableauField.tsx*', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /const \[battle, setBattle\] = useState\([^\n]+\);/,
        '$&\n globalThis.__setBattle = setBattle;',
      );
      await route.fulfill({ response, body });
    });
    const open = async () => {
      await page.goto('http://localhost:5178/117.html');
      await value.waitFor();
      assert.equal(await readMomentum(), 'Momentum 3');
      assert.equal(await hero.getAttribute('data-foundation-mode'), 'active');
    };
    await open();
    await gauge.click();
    assert.equal(await page.getByRole('button', { name: 'Open Momentum abilities' }).count(), 0);
    assert.equal(await page.locator('.ability-fan-overlay:not(.ability-fan-overlay--persistent)').count(), 0);
    assert.equal(await readMomentum(), 'Momentum 3');
    await drag(value, mochi);
    await page.locator('[data-battle-slot=mochi] .prime-tableau-value').waitFor();
    assert.equal(await mochi.getAttribute('data-foundation-mode'), 'active');
    assert.equal(await hero.getAttribute('data-foundation-mode'), 'support');
    assert.equal(await readMomentum(), 'Momentum 0');
    assert.equal(await value.isDisabled(), true);
    await drag(value, hero);
    assert.equal(await hero.getAttribute('data-foundation-mode'), 'support');
    assert.equal(await readMomentum(), 'Momentum 0');
    const h = await hero.boundingBox();
    const m = await mochi.boundingBox();
    assert(Math.abs(h.width / m.width - 0.8) < 0.01);
    assert.equal(await page.locator('[data-battle-slot=mochi] [data-buff=fast-swipes]').count(), 1);
    await page.evaluate(() => globalThis.__setBattle(state => ({
      ...state,
      columns: state.columns.map((pile, index) => index < 3
        ? [...pile.slice(0, -1), { id: 'leader-fixture-' + index, rank: 3 + index }]
        : pile),
    })));
    for (let index = 0; index < 3; index++) {
      await drag(page.locator('[data-battle-card="leader-fixture-' + index + '"]'), mochi);
      await page.waitForFunction(({ selector, expected }) => document.querySelector(selector).textContent.trim() === 'Momentum ' + expected, { selector: momentumSelector, expected: index + 1 });
    }
    await value.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-battle-slot=hero] .prime-tableau-value').waitFor();
    assert.equal(await readMomentum(), 'Momentum 0');

    const layoutNotes = new Set();
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await open();
      await page.waitForTimeout(350);
      for (const [root, parts] of [
        ['.battle-momentum-overlay', '[data-flame-dial], .momentum-engine__value'],
        ['.prime-tableau-value', 'b, small, i'],
      ]) {
        for (const defect of await findLayoutDefects(page, root, { parts })) layoutNotes.add(defect);
      }
      await drag(value, mochi);
      await page.locator('[data-battle-slot=mochi] .prime-tableau-value').waitFor();
      assert.equal(await readMomentum(), 'Momentum 0');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await open();
    await value.screenshot({ path: 'output/prime-transfer-value.png' });
    await gauge.screenshot({ path: 'output/prime-transfer-gauge.png' });
    assert.deepEqual(errors, []);
    if (layoutNotes.size) console.log('Layout notes:', [...layoutNotes]);
    console.log('Momentum gauge, paid drag and keyboard transfers, insufficient funds, and desktop/phone input passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
