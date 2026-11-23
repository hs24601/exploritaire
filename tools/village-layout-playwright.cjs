// Layout and play check for village.html at desktop and Galaxy Z Fold 7 sizes.
// Usage: node tools/village-layout-playwright.cjs [baseUrl] [outDir]
// Plays a little of each surface (drag and tap), builds, welcomes a kin, and
// runs the shared layout check on every screen. Exits 1 on any defect.
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
];

// A mid-game save: rank 2 reached, Mochi living here, a Hearth combo built.
function midSave() {
  const plots = Array(15).fill(null);
  plots[6] = 'leanto'; plots[7] = 'campfire'; plots[8] = 'bench'; plots[11] = 'leanto';
  return {
    version: 1, day: 3, minutes: 200,
    village: { resources: { lumber: 64, food: 41, stone: 30 }, plots, residents: [{ kin: 'mochi', hungry: 0 }, { kin: 'banks', hungry: 0 }], gate: [{ kin: 'cir', daysLeft: 2 }], gone: [] },
    mastery: { forest: 70, berries: 30, quarry: 0 }, location: { forest: 0, berries: 0, quarry: 0 },
    rankReached: 2, active: null, lastRun: null, view: 'village', seed: 4242, night: null,
  };
}

const PARTS = '.vg-main, .vg-top, .vg-brand, .vg-day, .vg-stores, .vg-store, .vg-top-actions, .vg-nav, .vg-nav-item, .vg-panel, .vg-panel-head, .vg-plot, .vg-plot-name, .vg-build-row, .vg-kin, .vg-location, .vg-felt, .vg-output, .vg-table, .vg-costs, .vg-btn, .vg-tableau, .vg-playrow, .vg-runstats, .vg-stock, .vg-foundation';

async function check(page, label, defects, root = '.vg-app') {
  const found = await findLayoutDefects(page, root, { parts: root === '.vg-app' ? PARTS : '.vg-panel, .vg-btn, li' });
  // Page-level horizontal scroll is a defect too.
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (hscroll) found.push('page scrolls horizontally');
  for (const d of found) defects.push(`${label}: ${d}`);
  await page.screenshot({ path: path.join(out, `${label}.png`) });
}

async function dragTopCardToFoundation(page) {
  // Try each exposed top card until one lands (no legal-move hints in the UI).
  const tops = page.locator('.vg-pile-top');
  const n = await tops.count();
  const before = await page.locator('.vg-runstats .vg-v').first().textContent();
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
    const after = await page.locator('.vg-runstats .vg-v').first().textContent();
    if (after !== before) return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const defects = [];
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, hasTouch: size.name.startsWith('fold') });
    const page = await ctx.newPage();
    page.on('pageerror', e => defects.push(`${size.name}: page error ${e.message}`));
    await page.goto(`${base}/village.html`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.vg-app');
    await check(page, `${size.name}-day1-village`, defects);

    // Forest: start a run, drag a few cards, turn the stock once.
    await page.click('.vg-nav-item.is-forest');
    await check(page, `${size.name}-forest-idle`, defects);
    await page.click('.vg-output .vg-btn.is-primary');
    await page.waitForSelector('.vg-foundation');
    await page.evaluate(() => document.querySelector('.vg-main').scrollTo(0, 0));
    let played = 0;
    for (let k = 0; k < 6; k++) { if (await dragTopCardToFoundation(page)) played++; else { await page.click('.vg-stock'); } }
    if (!played) defects.push(`${size.name}: could not drag any forest card onto the foundation`);
    await check(page, `${size.name}-forest-run`, defects);
    await page.click('.vg-output .vg-btn');

    // Berry patch run, played by tapping.
    await page.click('.vg-nav-item.is-berries');
    await page.click('.vg-output .vg-btn.is-primary');
    await page.waitForSelector('.vg-foundation');
    for (let k = 0; k < 9; k++) await page.locator('.vg-pile-top').nth(k).click({ force: true }).catch(() => {});
    await check(page, `${size.name}-berries-run`, defects);
    await page.click('.vg-output .vg-btn');

    // Mid-game save: village with residents and a combo, then the quarry.
    await page.evaluate(s => localStorage.setItem('exploritaire.village.v1', JSON.stringify(s)), midSave());
    await page.reload();
    await page.waitForSelector('.vg-app');
    await check(page, `${size.name}-mid-village`, defects);
    await page.click('.vg-nav-item.is-quarry');
    await page.click('.vg-output .vg-btn.is-primary');
    await page.waitForSelector('.vg-foundation');
    for (let k = 0; k < 4; k++) { if (!(await dragTopCardToFoundation(page))) await page.click('.vg-stock'); }
    await check(page, `${size.name}-quarry-run`, defects);

    // Night summary.
    await page.click('.vg-top-actions .vg-btn');
    await page.waitForSelector('.vg-night');
    await check(page, `${size.name}-night`, defects, '.vg-scrim');
    await ctx.close();
  }
  await browser.close();
  if (defects.length) { console.log(defects.join('\n')); process.exit(1); }
  console.log(`village layout check: clean at ${SIZES.map(s => s.name).join(', ')}`);
})();
