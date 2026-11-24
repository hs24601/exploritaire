// Visual and frame-time check for the Paint Lab (portals.html?cardpaintlab), desktop widths only.
// Shots: the glade on arrival (pencil, paint round Hero's feet), after walking toward the tree, and fully painted;
// plus the grove with the Paint Lab card (portals.html?tree). Reports console errors and the FPS readout.
// Usage: node tools/paint-lab-check.cjs [baseUrl] [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://localhost:5178';
const out = process.argv[3] || 'artifacts/paint-lab';
const SIZES = [[1912, 914], [1280, 720]];
const ready = () => !!window.__castle1111 && window.__castle1111.mode === 'play';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
  const report = [];
  try {
    for (const [w, h] of SIZES) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
      await page.goto(`${base}/portals.html?cardpaintlab`);
      await page.waitForFunction(ready, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `arrive-${w}.png`) });
      // walk toward the tree for a few seconds
      await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `walked-${w}.png`) });
      await page.evaluate(() => window.__castle1111.paintLab.paintAll());
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(out, `painted-${w}.png`) });
      const fps = await page.evaluate(() => document.getElementById('fps-readout')?.textContent);
      const lab = await page.evaluate(() => { const d = window.__castle1111.paintLab; return { dabs: d.dabs, grass: d.grass, flooded: d.flooded, inside: d.inside }; });
      report.push({ size: `${w}x${h}`, fps, lab, errors });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1912, height: 914 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/portals.html?tree`);
    await page.waitForFunction(ready, null, { timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, 'grove-cards-1912.png') });
    report.push({ grove: true, errors });
    await page.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 1));
})();
