// Layout and play check for village.html at desktop and Galaxy Z Fold 7 sizes.
// Usage: node tools/village-layout-playwright.cjs [baseUrl] [outDir]
// Covers the map by day, night and as the ?book spread, the zoom tiers, the drawer panes (or
// overlay sheets, when the current UI has them), placing a building by drag and
// by tap with its ghost preview (valid and blocked), inspecting and taking one down,
// the minimap + puzzle for each surface, and the night summary. Runs the shared layout
// check (with forbidScroll) on every screen. Exits 1 on any defect.
// Set PW_CHROMIUM to a Chrome/Edge executable if Playwright's own browser isn't installed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const base = process.argv[2] || 'http://localhost:5178';
const out = process.argv[3] || 'artifacts/village';
fs.mkdirSync(out, { recursive: true });

const SIZES = [
  { name: 'desktop-1912', width: 1912, height: 914 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'fold7-inner', width: 884, height: 1000 },
  { name: 'fold7-cover', width: 412, height: 915 },
  { name: 'fold7-cover-land', width: 915, height: 412 },
  { name: 'fold7-inner-land', width: 1000, height: 884 },
];

const COLS = 9;
const tile = (x, y) => y * COLS + x;

// A mid-game save on the map: Village rank, two residents, a Hearth combo and a Woodshed by the Forest.
function midSave() {
  const plots = Array(63).fill(null);
  plots[tile(2, 3)] = 'leanto'; plots[tile(3, 3)] = 'campfire'; plots[tile(4, 3)] = 'bench'; plots[tile(2, 4)] = 'leanto'; plots[tile(1, 2)] = 'woodshed';
  return {
    version: 2, day: 3, minutes: 200,
    village: { resources: { lumber: 64, food: 41, stone: 30 }, plots, residents: [{ kin: 'mochi', hungry: 0 }, { kin: 'banks', hungry: 0 }], gate: [{ kin: 'cir', daysLeft: 2 }], gone: [] },
    mastery: { forest: 70, berries: 30, quarry: 0 }, location: { forest: 0, berries: 0, quarry: 0 },
    rankReached: 2, active: null, lastRun: null, view: 'village', seed: 4242, night: null,
  };
}

const PARTS = [
  '.vg-top', '.vg-brand', '.vg-day', '.vg-stores', '.vg-store', '.vg-top-actions', '.vg-drawer', '.vg-bar', '.vg-sheet', '.vg-float', '.vg-panes', '.vg-pane-tab',
  '.vg-build-row', '.vg-kin', '.vg-section', '.vg-rules li', '.vg-card-panel', '.vg-map', '.vg-chip-label', '.vg-node',
  '.vg-location', '.vg-felt', '.vg-output', '.vg-table', '.vg-costs', '.vg-btn', '.vg-tableau', '.vg-playrow', '.vg-runstats', '.vg-stock', '.vg-foundation', '.vg-stump', '.vg-crown', '.vg-crown-card', '.vg-fall-btn', '.vg-fall-hint',
].join(', ');

async function check(page, label, defects, root = '.vg-app') {
  await page.waitForTimeout(420); // let the map/minimap transform settle
  const found = await findLayoutDefects(page, root, { parts: root === '.vg-app' ? PARTS : '.vg-panel, .vg-btn, li', forbidScroll: true });
  for (const d of found) defects.push(`${label}: ${d}`);
  // The placing tag floats over the map: it must stay on the map and inside the window.
  const tag = await page.evaluate(() => {
    const t = document.querySelector('.vg-aim-tag'), m = document.querySelector('.vg-map');
    if (!t || !m) return null;
    const a = t.getBoundingClientRect(), b = m.getBoundingClientRect();
    return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
  });
  if (tag === false) defects.push(`${label}: .vg-aim-tag escapes the map`);
  await page.screenshot({ path: path.join(out, `${label}.png`) });
}

async function center(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const isOverlay = page => page.locator('.vg-stage.dock-overlay').count().then(n => n > 0);

const has = async (page, selector) => (await page.locator(selector).count()) > 0;

async function openPane(page, pane) {
  const tab = page.locator(`.vg-pane-tab.is-${pane}`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
}

/** Set the clock on the saved game and reload. */
async function atMinutes(page, minutes, query = '') {
  await page.evaluate(m => {
    const s = JSON.parse(localStorage.getItem('exploritaire.village.v1'));
    if (s) { s.minutes = m; s.night = null; localStorage.setItem('exploritaire.village.v1', JSON.stringify(s)); }
  }, minutes);
  await page.goto(`${base}/village.html${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.vg-map');
}

// Lighting, fog of war, the book spread and zoom tiers (docs/research/village-lighting-terrain.md).
async function mapLooks(page, tag, defects) {
  await atMinutes(page, 900);
  await check(page, `${tag}-01b-night`, defects);
  if (!(await has(page, '.vg-darkness'))) defects.push(`${tag}: no light field on the map`);
  await atMinutes(page, 120, '?book');
  await check(page, `${tag}-01c-book`, defects);
  if (!(await has(page, '.vg-book-gutter'))) defects.push(`${tag}: ?book shows no spread`);
  const box = await page.locator('.vg-map-viewport').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 240);
  await check(page, `${tag}-01d-world-tier`, defects);
  if (!(await has(page, '.is-tier-world'))) defects.push(`${tag}: zooming out did not reach the world tier`);
  await atMinutes(page, 120);
}

async function dragTopCardToFoundation(page) {
  // Try each exposed top card until one lands (no legal-move hints in the UI).
  const tops = page.locator('.vg-pile-top');
  const n = await tops.count();
  const before = await page.locator('.vg-runstats').textContent();
  for (let i = 0; i < n; i++) {
    const a = await tops.nth(i).boundingBox();
    const b = await page.locator('.vg-foundation').boundingBox();
    if (!a || !b) continue;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 2 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(60);
    const after = await page.locator('.vg-runstats').textContent();
    if (after !== before) return true;
  }
  return false;
}

// Mouse clicks build at once (hover already previewed); touch taps preview first and confirm with Build here.
async function confirmBuild(page) {
  const btn = page.locator('.vg-card-panel .vg-btn.is-primary');
  if ((await btn.count()) && (await btn.isEnabled())) await btn.click();
}

const built = (page, t) => page.locator(`.vg-tile[data-index="${t}"] .vg-token:not(.is-ghost)`).count();

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const defects = [];
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, hasTouch: size.name.startsWith('fold') });
    const page = await ctx.newPage();
    const tag = size.name;
    page.on('pageerror', e => defects.push(`${tag}: page error ${e.message}`));
    await page.goto(`${base}/village.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.vg-map');
    await check(page, `${tag}-01-map`, defects);
    if (!size.name.startsWith('fold')) await mapLooks(page, tag, defects);
    const overlay = await isOverlay(page);
    // zenDuo's current UI (2026-11-27) replaced the drawer panes; their steps run only when present.
    const panes = await has(page, '.vg-pane-tab');

    // Gather some lumber first so there's something to build.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('exploritaire.village.v1'));
      s.village.resources.lumber = 120; s.village.resources.food = 60;
      localStorage.setItem('exploritaire.village.v1', JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.vg-map');

    if (panes) {
    // Build pane, then place a Lean-to: drag on docked screens, tap-then-tap on overlay screens.
    await openPane(page, 'build');
    await check(page, `${tag}-02-build`, defects);
    if (!overlay) {
      const from = await center(page, '.vg-build-row:nth-child(1)');
      const to = await center(page, `.vg-tile[data-index="${tile(2, 3)}"]`);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 12, from.y + 4, { steps: 2 });
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await check(page, `${tag}-03-drag-ghost`, defects);
      if (!(await page.locator('.vg-aim-tag, .vg-tile.is-aim').count())) defects.push(`${tag}: no ghost preview while dragging`);
      await page.mouse.up();
    } else {
      await page.click('.vg-build-row:nth-child(1)');
      await page.click(`.vg-tile[data-index="${tile(2, 3)}"]`);
      await check(page, `${tag}-03-tap-ghost`, defects);
      await confirmBuild(page);
    }
    if (!(await built(page, tile(2, 3)))) defects.push(`${tag}: lean-to was not built`);

    // A blocked placement: a campfire touching the Forest. The preview must say why.
    if (overlay) await openPane(page, 'build');
    await page.click('.vg-build-row:nth-child(2)');
    await page.click(`.vg-tile[data-index="${tile(1, 2)}"]`);
    await check(page, `${tag}-04-blocked`, defects);
    const blockedText = await page.locator('.vg-aim-tag.is-blocked').textContent().catch(() => '');
    if (!/campfire/i.test(blockedText || '')) defects.push(`${tag}: blocked preview missing (got "${blockedText}")`);
    // Then a valid spot beside the lean-to, confirmed with Build here.
    await page.click(`.vg-tile[data-index="${tile(3, 3)}"]`);
    await confirmBuild(page);
    if (!(await built(page, tile(3, 3)))) defects.push(`${tag}: campfire was not built by tap`);

    // Inspect and take down, then the other panes.
    await page.click(`.vg-tile[data-index="${tile(3, 3)}"]`);
    await check(page, `${tag}-05-inspect`, defects);
    await page.click('.vg-card-panel .vg-btn:not(.is-quiet)');
    if (await built(page, tile(3, 3))) defects.push(`${tag}: take down did nothing`);
    for (const pane of ['kin', 'hollow']) {
      await openPane(page, pane);
      await check(page, `${tag}-06-${pane}`, defects);
    }
    if (overlay) await page.locator('.vg-sheet-head .vg-iconbtn').click();
    }

    // Forest: the map shrinks to the minimap and the puzzle opens. Drag a few cards, turn the stock.
    await page.click('.vg-feature.is-forest');
    if (await page.waitForSelector('.vg-foundation', { timeout: 4000 }).then(() => true, () => false)) {
    if (!(await page.locator('.vg-map.is-mini').count())) defects.push(`${tag}: map did not become the minimap`);
    await check(page, `${tag}-07-forest`, defects);
    let played = 0;
    for (let k = 0; k < 6; k++) { if (await dragTopCardToFoundation(page)) played++; else await page.click('.vg-stock'); }
    if (!played) defects.push(`${tag}: could not drag any forest card onto the foundation`);
    await check(page, `${tag}-08-forest-run`, defects);
    // Birch Stand: keep cutting until a trunk is cleared, then check the fall choice and fell it.
    for (let k = 0; k < 30 && !(await page.locator('.vg-fall').count()) && (await page.locator('.vg-pile-top').count()); k++) {
      if (!(await dragTopCardToFoundation(page))) { if (await page.locator('.vg-stock:not([disabled])').count()) await page.click('.vg-stock'); else break; }
    }
    if (await page.locator('.vg-fall').count()) {
      await check(page, `${tag}-08b-forest-fall`, defects);
      await page.locator('.vg-fall-btn').last().click();
      if (await page.locator('.vg-fall').count()) defects.push(`${tag}: choosing a fall did nothing`);
      await check(page, `${tag}-08c-forest-fallen`, defects);
    }
    // Back via the minimap: the run stays open, and the map grows back.
    } else await check(page, `${tag}-07-forest-view`, defects);
    if (await has(page, '.vg-map.is-mini')) {
      await page.click('.vg-mini-back');
      await check(page, `${tag}-09-map-running`, defects);
      if (await page.locator('.vg-map.is-mini').count()) defects.push(`${tag}: minimap tap did not return to the map`);
    }

    // Berry patch (banks the forest run), played by tapping, then Leave.
    if (await has(page, '.vg-feature.is-berries:not([disabled])')) {
      await page.click('.vg-feature.is-berries');
      if (await page.waitForSelector('.vg-foundation', { timeout: 4000 }).then(() => true, () => false)) {
        for (let k = 0; k < 9; k++) await page.locator('.vg-pile-top').nth(k).click({ force: true, timeout: 1000 }).catch(() => {});
        await check(page, `${tag}-10-berries-run`, defects);
      }
      if (await has(page, '.vg-output .vg-btn')) await page.click('.vg-output .vg-btn');
      else if (await has(page, '.vg-mini-back')) await page.click('.vg-mini-back');
      await page.waitForSelector('.vg-map:not(.is-mini)');
    }

    // Mid-game: fog lifted, residents, combo links and a site bonus. Then the quarry.
    await page.evaluate(s => localStorage.setItem('exploritaire.village.v1', JSON.stringify(s)), midSave());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.vg-map');
    await check(page, `${tag}-11-mid-map`, defects);
    await page.click(`.vg-tile[data-index="${tile(1, 2)}"]`);
    await check(page, `${tag}-12-mid-inspect`, defects);
    await page.keyboard.press('Escape');
    if (await has(page, '.vg-standee')) {
      await page.click('.vg-standee');
      // The kin holocard opens as a full-screen jumbo that scales the app behind it on purpose: screenshot only.
      await page.waitForTimeout(420);
      await page.screenshot({ path: path.join(out, `${tag}-13-welcome.png`) });
      await page.keyboard.press('Escape');
    }
    if (overlay && await has(page, '.vg-sheet-head .vg-iconbtn')) await page.locator('.vg-sheet-head .vg-iconbtn').click();
    // The Quarry left the village map (2026-11-24); check its run only if it returns.
    if (await has(page, '.vg-feature.is-quarry')) {
      await page.click('.vg-feature.is-quarry');
      await page.waitForSelector('.vg-foundation');
      for (let k = 0; k < 4; k++) { if (!(await dragTopCardToFoundation(page))) await page.click('.vg-stock'); }
      await check(page, `${tag}-14-quarry-run`, defects);
    }

    // Night summary.
    await page.click('.vg-top-actions .vg-btn');
    await page.waitForSelector('.vg-night');
    await check(page, `${tag}-15-night`, defects, '.vg-scrim');
    await ctx.close();
  }
  await browser.close();
  if (defects.length) { console.log(defects.join('\n')); process.exit(1); }
  console.log(`village layout check: clean at ${SIZES.map(s => s.name).join(', ')}`);
})();
