const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const URL = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
const cases = process.env.BERRY_REPRO_ONLY
  ? [{ width: 1716, input: 'mouse', noUuid: true, reduced: false }]
  : [
      { width: 1716, input: 'mouse', noUuid: true, reduced: false },
      { width: 1280, input: 'touch', noUuid: true, reduced: false },
      { width: 1280, input: 'keyboard', noUuid: true, reduced: true },
      { width: 1716, input: 'mouse', noUuid: false, reduced: false },
    ];

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function enterPatch(page, touch) {
  const from = await center(page.locator('[data-cell-grip="actor-hero"]'));
  const to = await center(page.locator('[data-biome-id="day-one-berries"]'));
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  for (let step = 1; step <= 12; step++) {
    const point = { x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 };
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    else await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(20);
  }
  if (cdp) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
  else await page.mouse.up();
  await page.locator('.proto-occupied-foundation-face').waitFor({ timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of cases) {
      const context = await browser.newContext({
        viewport: { width: scenario.width, height: scenario.width === 1280 ? 720 : 914 },
        hasTouch: scenario.input === 'touch',
        reducedMotion: scenario.reduced ? 'reduce' : 'no-preference',
      });
      // Plain HTTP on a LAN/Tailscale host does not expose this secure-context API.
      if (scenario.noUuid) await context.addInitScript(() => {
        Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
      await page.goto(URL);
      await enterPatch(page, scenario.input === 'touch');
      const cards = page.locator('.proto-main-tableau .playing-card');
      const foundation = page.locator('.proto-occupied-foundation-face');
      assert.equal(await cards.count(), 28);
      assert.match(await foundation.getAttribute('aria-label'), /Foundation top card 2/);
      const landingIds = [];
      for (let step = 0; step < 10; step++) {
        const playable = page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
        const food = await playable.getAttribute('data-food-source');
        if (step === 8) {
          assert.equal(await playable.getAttribute('data-resource-node'), 'inspiration');
          assert.equal(await playable.locator('[aria-label="Inspiration · 1 INSP"]').innerText(), '💫');
        }
        if (scenario.input === 'touch') { const point = await center(playable); await page.touchscreen.tap(point.x, point.y); }
        else if (scenario.input === 'keyboard') { await playable.focus(); await page.keyboard.press('Enter'); }
        else await playable.click();
        await page.waitForFunction(expected => document.querySelectorAll('.proto-main-tableau .playing-card').length === expected && !document.querySelector('[data-proto-card-flight]'), 28, { timeout: 5000 });
        assert.match(await foundation.getAttribute('aria-label'), new RegExp(`Foundation top card ${step + 3 <= 10 ? step + 3 : ['J', 'Q'][step - 8]}(?:,|$)`));
        if (step === 8) {
          const receipt = foundation.locator('[data-resource-receipt]');
          await receipt.waitFor();
          assert.equal(await receipt.locator('.food-collection-fx__mana').innerText(), '💫');
          assert.equal(await receipt.locator('.food-collection-fx__berry').count(), 0);
        }
        if (food === 'berries') {
          const effect = page.locator('[data-food-conversion]');
          await effect.waitFor();
          landingIds.push(await effect.getAttribute('data-food-conversion'));
          assert.equal(await foundation.locator('.actor-holocard__resource').innerText(), '✨');
        }
        assert.match(await page.locator('.proto-ordinary-day').innerText(), new RegExp(`Mana ${step < 5 ? 1 : 2}`));
      }
      assert.equal(new Set(landingIds).size, 2, 'each berry conversion has a distinct effect identity');
      assert.deepEqual(errors, [], 'card delivery must not throw');
      await page.screenshot({ path: `artifacts/berry-patch-${scenario.input}-${scenario.noUuid ? 'no-uuid' : 'uuid'}.png` });
      console.log('PASS', JSON.stringify(scenario), 'all ten seeded cards played with four rows retained, foundation advanced, two mana collected');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

