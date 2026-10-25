// Drives the dead-run combatsbx scenarios (019–024) at desktop sizes: the
// six-column rack plus the Deep Breath intent card, the hold slot and the pity
// flip stay inside the viewport without overlaps or text under 16px, and the
// intent and hold accept real card plays. Screenshots: artifacts/combat-dead-run/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const BASE = process.env.PROTO_URL ?? 'http://127.0.0.1:5178/proto.html';
const SCENARIOS = ['019', '020', '021', '022', '023', '024'];
const SIZES = [[1912, 914], [1280, 720]];
const OUT = 'artifacts/combat-dead-run';
fs.mkdirSync(OUT, { recursive: true });

const PARTS = '.battle-field__rack > .battle-field__column, .battle-intent-slot, .battle-field__team[data-team="party"] > .battle-field__slot, .battle-field__turn-actions > button, .battle-field__solver-actions > *';

/** Every new element inside the viewport, rack cells and party slots apart, text at 16px or more. */
async function checkBoard(page, tag, width, height) {
  const defects = await page.evaluate(({ width, height, parts }) => {
    const out = [], box = el => el.getBoundingClientRect();
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const items = [...document.querySelectorAll(parts)].filter(el => box(el).width > 0);
    for (const el of items) {
      const r = box(el);
      if (r.left < 0 || r.top < 0 || r.right > width + 0.5 || r.bottom > height + 0.5) out.push(`${el.className.split(' ')[0]} outside viewport`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++)
      if (!items[i].contains(items[j]) && !items[j].contains(items[i]) && overlap(box(items[i]), box(items[j]))) out.push(`${items[i].className.split(' ')[0]} overlaps ${items[j].className.split(' ')[0]}`);
    for (const el of document.querySelectorAll('.battle-intent-slot *, .battle-hold-slot *, .battle-pity-button'))
      if (el.childNodes[0]?.nodeType === 3 && el.textContent.trim() && box(el).width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16) out.push(`${el.className || el.tagName} text under 16px`);
    return out;
  }, { width, height, parts: PARTS });
  const own = await findLayoutDefects(page, '.battle-intent-slot', { parts: '.battle-intent-slot__name, .battle-intent-slot__card, .battle-intent-slot__pips' }).catch(() => []);
  return [...new Set([...defects, ...own.filter(defect => !defect.endsWith('not found'))])].map(defect => `${tag}: ${defect}`);
}

/** Tableau tops a receiver accepts right now, read from the rendered ranks. */
const tops = page => page.locator('.battle-field__rack > .battle-field__column').evaluateAll(columns => columns.map((column, index) => {
  const cards = column.querySelectorAll('[data-battle-card]'), card = cards[cards.length - 1];
  return { index, rank: Number(card?.dataset.battleRank), enabled: Boolean(card && !card.hasAttribute('data-gameplay-disabled')) };
}));
const RANKS = { A: 1, J: 11, Q: 12, K: 13 };
const rankOf = text => RANKS[text.trim()] ?? Number(text.trim());
const intentRank = page => page.locator('.battle-intent-slot .proto-card-center-rank').first().textContent().then(rankOf);
const adjacent = (a, b) => a !== b && (Math.abs(a - b) === 1 || a + b === 14 && (a === 1 || b === 1));

async function dragTop(page, column, target) {
  const card = page.locator('.battle-field__rack > .battle-field__column').nth(column).locator('[data-battle-card]').last();
  const from = await card.boundingBox(), to = await page.locator(target).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 - 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const failures = [];
  try {
    for (const [width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.on('pageerror', error => failures.push(`page error: ${error.message}`));
      for (const id of SCENARIOS) {
        const tag = `${id}-${width}x${height}`;
        await page.goto(`${BASE}?combatsbx&scenario=${id}`);
        await page.locator('[data-status="insight"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${tag}-board.png` });
        failures.push(...await checkBoard(page, tag, width, height));
        const columns = await page.locator('.battle-field__rack > .battle-field__column').count();
        if (columns !== 6) failures.push(`${tag}: ${columns} tableau columns`);
        if (await page.locator('[data-battle-slot="mochi"]').count()) failures.push(`${tag}: Mochi is in the party`);
        const intent = page.locator('.battle-intent-slot');
        if ((await intent.count()) !== (id === '019' ? 0 : 1)) failures.push(`${tag}: intent card count`);
        if ((await page.locator('.battle-pity-button').count()) !== (['022', '024'].includes(id) ? 1 : 0)) failures.push(`${tag}: pity button count`);
        if ((await page.locator('.battle-hold-slot').count()) !== (['023', '024'].includes(id) ? 1 : 0)) failures.push(`${tag}: hold slot count`);

        // Play one exposed card onto the intent: a pip comes off only if there was one, so check the rank instead.
        if (id !== '019' && width === 1912) {
          const rank = await intentRank(page);
          const fit = (await tops(page)).find(top => top.enabled && adjacent(top.rank, rank));
          if (fit) {
            await dragTop(page, fit.index, '.battle-intent-slot');
            const after = await intentRank(page);
            if (after !== (id === '021' ? rank : fit.rank)) failures.push(`${tag}: intent rank ${after} after playing ${fit.rank} on ${rank}`);
            if (await page.locator('.momentum-engine').getAttribute('data-source') !== 'intent') failures.push(`${tag}: intent play earned no Momentum`);
            await page.screenshot({ path: `${OUT}/${tag}-intent-play.png` });
          } else failures.push(`${tag}: no opening card fits the intent`);
        }
        // Park a playable card in the hold, then play it from there.
        if (['023', '024'].includes(id) && width === 1912) {
          const hero = await page.locator('[data-battle-actor="hero"] .battle-foundation__value').innerText().then(rankOf).catch(() => NaN);
          const fit = (await tops(page)).find(top => top.enabled && adjacent(top.rank, hero));
          if (fit) {
            await dragTop(page, fit.index, '.battle-hold-slot');
            if (!(await page.locator('.battle-hold-slot__card [data-battle-card]').count())) failures.push(`${tag}: hold did not take the card`);
            await page.screenshot({ path: `${OUT}/${tag}-held.png` });
            failures.push(...await checkBoard(page, `${tag} held`, width, height));
            const held = page.locator('.battle-hold-slot__card [data-battle-card]');
            const from = await held.boundingBox(), to = await page.locator('[data-battle-actor="hero"]').boundingBox();
            await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
            await page.mouse.move(from.x + 30, from.y - 10, { steps: 4 }); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
            await page.waitForTimeout(400);
            if (await page.locator('.battle-hold-slot__card [data-battle-card]').count()) failures.push(`${tag}: held card did not play`);
          } else failures.push(`${tag}: nothing playable to park`);
        }
        // Insight notes open with all three pages.
        await page.locator('[data-status="insight"]').click();
        const dialog = page.locator('dialog.insight-dialog');
        await dialog.waitFor();
        for (const tab of ['Intent', 'How to solve it', 'Why it exists']) {
          await dialog.getByRole('tab', { name: tab }).click();
          if (width === 1280) await page.screenshot({ path: `${OUT}/${tag}-insight-${tab.split(' ')[0].toLowerCase()}.png` });
          const defects = await findLayoutDefects(page, 'dialog.insight-dialog', { parts: '.insight-dialog__header, .insight-dialog__tabs, .insight-dialog__panel, .insight-dialog__footer, .insight-dialog button, .insight-dialog h2' });
          failures.push(...defects.map(defect => `${tag} insight/${tab}: ${defect}`));
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(failures.length ? failures.join('\n') : 'dead-run scenarios: no defects');
  process.exitCode = failures.length ? 1 : 0;
})();
