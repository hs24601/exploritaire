// Layout check for portals.html?stellarcombat at desktop widths (Eric, 2026-10-07: desktop only).
// Plays a real game through the pick and play phases, then checks the HUD parts with the shared
// layout check, keeps the grid clear of the HUD, and keeps rendered card text at 16px or more.
// Usage: node tools/stellar-layout-playwright.cjs [baseUrl] [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const base = process.argv[2] || 'http://localhost:5178';
const out = process.argv[3] || 'artifacts/stellar';
const SIZES = [[1912, 914], [1600, 900], [1280, 720]];
const HUD = '.stellar-chain, .stellar-foe, .stellar-hero, .stellar-controls, .stellar-banner';

async function gridDefects(page) {
  return page.evaluate(() => {
    const defects = [], board = document.querySelector('.stellar-board');
    const scale = new DOMMatrix(getComputedStyle(board).transform).a;
    const cards = [...board.querySelectorAll('.card:not(.gone), .slot, .stocklabel')].map(n => n.getBoundingClientRect()).filter(r => r.width);
    const box = cards.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) defects.push('grid leaves the viewport');
    for (const sel of ['.stellar-chain', '.stellar-foe', '.stellar-hero', '.stellar-controls']) {
      const r = document.querySelector(sel).getBoundingClientRect();
      if (Math.min(r.right, box.right) - Math.max(r.left, box.left) > 0.5 && Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top) > 0.5) defects.push(`grid overlaps ${sel}`);
    }
    for (const node of board.querySelectorAll('.card:not(.gone) .pip .r, .card[data-peek] .peek > span:first-child, .stocklabel')) {
      const visible = node.getClientRects().length && getComputedStyle(node).display !== 'none';
      const size = parseFloat(getComputedStyle(node).fontSize) * scale;
      if (visible && size < 16) defects.push(`card text "${node.textContent.trim()}" renders at ${size.toFixed(1)}px`);
    }
    return [...new Set(defects)];
  });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  let failures = 0;
  for (const fx of ['high', 'low']) for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/portals.html?stellarcombat&fx=${fx}`);
    await page.waitForSelector('.stellar .card.pickable', { timeout: 90000 });
    await page.waitForTimeout(800);
    const report = async (phase) => {
      const defects = [...await findLayoutDefects(page, '.stellar', { parts: HUD }), ...await gridDefects(page), ...errors];
      await page.screenshot({ path: path.join(out, `stellar-${phase}-${fx}-${width}x${height}.png`) });
      console.log(`${fx} ${width}x${height} ${phase}: ${defects.length ? defects.join('; ') : 'ok'}`);
      failures += defects.length;
    };
    await report('pick');
    const ids = await page.$$eval('.card.pickable', els => els.map(e => e.dataset.id));
    const box = await (await page.$(`.card[data-id="${ids[Math.floor(ids.length / 2)]}"]`)).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    // Play by tapping any card that is legal; draw from the stock when nothing is.
    for (let turn = 0; turn < 60 && !(await page.$('.stellar-banner:not([hidden])')); turn++) {
      const played = await page.evaluate(() => {
        const found = document.querySelector('#foundSlot').getBoundingClientRect();
        const top = [...document.querySelectorAll('.stellar .card')].filter(c => { const r = c.getBoundingClientRect(); return Math.abs(r.left - found.left) < 4 && Math.abs(r.top - found.top) < 4; }).sort((a, b) => +b.style.zIndex - +a.style.zIndex)[0];
        const rank = top?.querySelector('.pip .r')?.textContent, order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], value = order.indexOf(rank);
        const next = [...document.querySelectorAll('.stellar .card[tabindex="0"]:not(.down)')].find(c => { const v = order.indexOf(c.querySelector('.pip .r').textContent); const d = Math.abs(v - value); return d === 1 || d === 12; });
        if (next) { next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; }
        const stock = document.querySelector('.stellar .card.down[tabindex="0"]');
        if (stock) { stock.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; }
        return false;
      });
      if (!played) break;
      await page.waitForTimeout(420);
      if (turn === 8) await report('play');
    }
    await page.waitForTimeout(1800);
    await report('end');
    await page.close();
  }
  await browser.close();
  process.exitCode = failures ? 1 : 0;
})();
