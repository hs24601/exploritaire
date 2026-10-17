const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  fs.mkdirSync('artifacts/quest-field', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const viewport of [{ width: 1912, height: 914 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:5178/proto.html');
      await page.locator('.quest-card').waitFor();
      await page.waitForTimeout(300);
      const geometry = await page.locator('.quest-card,.quest-card-back').evaluateAll((cards) => cards.map((card) => {
        const rect = card.getBoundingClientRect(), css = getComputedStyle(card);
        const layer = card.parentElement;
        const top = document.elementFromPoint(rect.x + 10, rect.y + 10);
        return { width: rect.width, height: rect.height, border: css.borderTopWidth,
          background: css.backgroundColor, covered: !layer.contains(top) };
      }));
      assert.equal(geometry.length, 10);
      geometry.forEach((card, index) => {
        assert.ok(Math.abs(card.width / card.height - 63 / 88) < 0.001);
        assert.equal(card.border, '4px');
        assert.notEqual(card.background, 'rgba(0, 0, 0, 0)');
        if (index) assert.ok(card.covered, 'Underlying top border must be covered');
      });
      assert.equal(await page.locator('.quest-card__title').count(), 1);
      const contained = await page.locator('.quest-field').evaluate((field) => {
        const r = field.getBoundingClientRect();
        return [...field.querySelectorAll('.quest-card,.quest-card-back')].every((card) => {
          const c = card.getBoundingClientRect();
          return c.bottom <= r.bottom && c.left >= r.left && c.right <= r.right;
        });
      });
      assert.ok(contained, 'All complete card surfaces must fit the field');
      await page.screenshot({ path: `artifacts/quest-field/${viewport.width}.png` });
    }
    await page.setViewportSize({ width: 1912, height: 914 });
    await page.goto('http://localhost:5178/proto.html');
    const actor = await page.locator('[data-board-piece="actor"]').boundingBox();
    const tile = await page.locator('[data-biome-id="woods-alpha"]').boundingBox();
    await page.mouse.move(actor.x + actor.width / 2, actor.y + actor.height / 2);
    await page.mouse.down();
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.locator('.quest-card--complete').waitFor({ timeout: 15000 });
    await page.screenshot({ path: 'artifacts/quest-field/completed.png' });
    await page.locator('.quest-card--complete').click();
    await page.waitForFunction(() => document.querySelector('.quest-field')?.dataset.redeemed === '1');
    assert.match(await page.locator('.quest-card__title').innerText(), /Solve the safe Small Woods tableau/i);
    assert.equal(await page.locator('.quest-card-back').count(), 8);
    await page.screenshot({ path: 'artifacts/quest-field/redeemed.png' });
    for (const viewport of [{ width: 1912, height: 914 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);
      const fits = await page.locator('.proto-tableau-card-area').evaluate((area) => {
        const bounds = area.getBoundingClientRect();
        const tableau = area.querySelector('[data-component="tableau"]');
        return tableau.children.length === 7 && [...area.querySelectorAll('button')].every((card) => {
          const rect = card.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
        });
      });
      assert.ok(fits, 'Seven tableau columns and every card must fit the play area');
    }
    console.log('Quest Field: two viewport geometry/occlusion checks and live quest redemption passed.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
