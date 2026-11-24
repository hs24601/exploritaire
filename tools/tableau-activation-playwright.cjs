const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const input of ['mouse', 'touch', 'keyboard']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.PROTO_URL || 'http://localhost:5178/proto.html?combatdemo');
      await page.locator('.battle-field__column').first().waitFor();
      // Find a short legal sequence that ends with a card eligible for both actors.
      const plan = await page.evaluate(async () => {
        const { createBattle, eligibleActors, playCard } = await import('/src/proto/rules/battle.ts');
        const { createSeededSmallWoodsDeal } = await import('/src/proto/rules/setup.ts');
        const queue = [{ state: createBattle(createSeededSmallWoodsDeal(), { mochi: true, slimes: 2 }), steps: [] }];
        for (let n = 0; n < queue.length && n < 500; n++) {
          const { state, steps } = queue[n];
          for (let column = 0; column < state.columns.length; column++) {
            const card = state.columns[column].at(-1);
            if (!card) continue;
            const actors = eligibleActors(state, card);
            if (actors.length > 1) return { steps, column, actors: actors.map(actor => actor.id) };
            if (actors.length === 1 && steps.length < 5) queue.push({ state: playCard(state, column, actors[0].id), steps: [...steps, column] });
          }
        }
        throw new Error('No multiple-foundation sequence found');
      });
      const press = async locator => {
        if (input === 'touch') await locator.tap();
        else if (input === 'keyboard') { await locator.focus(); await page.keyboard.press('Enter'); }
        else await locator.click();
      };
      const top = column => page.locator('.battle-field__column').nth(column).locator('.playing-card').last();
      for (const column of plan.steps) {
        await press(top(column));
        assert.equal(await page.locator('.card-jumbo').count(), 0);
      }
      const count = await page.locator('.battle-field__column .playing-card').count();
      await press(top(plan.column));
      assert.equal(await page.locator('.card-jumbo').count(), 0);
      assert.equal(await page.locator('.battle-field__column .playing-card').count(), count, 'Multiple choices do not spend a card');
      assert.equal(await page.locator('.battle-field__foundation[data-targetable="true"]').count(), plan.actors.length);
      for (const actor of plan.actors) assert.equal(await page.locator(`[data-battle-actor="${actor}"]`).getAttribute('data-targetable'), 'true');
      const foundation = page.locator(`[data-battle-actor="${plan.actors[0]}"]`);
      await press(input === 'keyboard' ? foundation.locator('.trading-card-stage') : foundation);
      assert.equal(await page.locator('.battle-field__foundation[data-targetable="true"]').count(), 0);
      assert.equal(await page.locator('.card-jumbo').count(), 0);
      const buried = page.locator('.battle-field__column .playing-card[data-buried="true"]').first();
      assert.equal(await buried.isDisabled(), true);
      assert.equal(await top(plan.column).getAttribute('aria-haspopup'), null);
      assert.deepEqual(errors, []);
      console.log('PASS direct tableau play and multiple-foundation selection', input);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
