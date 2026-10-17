const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 700 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5178/proto.html');
    const filter = await page.locator('#actor-visibility-stroke').evaluate(node => node.outerHTML);
    assert.match(filter, /feComponentTransfer/);
    await page.goto('http://localhost:5178/tools/hero-faces-preview.html');
    await page.evaluate(filter => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.innerHTML = `<defs>${filter}</defs>`; document.body.append(svg);
      const style = document.createElement('style');
      style.textContent = 'canvas {filter:url(#actor-visibility-stroke)}'; document.head.append(style);
    }, filter);
    for (const angle of [20, 55]) {
      await page.getByRole('button', { name: `${angle}°`, exact: true }).click();
      for (const pose of ['sitting', 'standing', 'walking']) {
        await page.getByRole('button', { name: pose, exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('canvas[data-actor-expression=curious][data-face-layer=true]').length === 5);
        await page.screenshot({ path: `artifacts/hero-outline-${pose}-${angle}.png` });
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Curious face and combined silhouette filter across 48 pose/view combinations');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
