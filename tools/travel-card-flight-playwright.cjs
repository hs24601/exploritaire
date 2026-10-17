const { chromium } = require('playwright');
const ts = require('typescript');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<button data-travel-card="test" style="position:absolute;left:20px;top:20px;width:63px;height:88px">7</button><div data-travel-foundation="mochi" style="position:absolute;left:300px;top:200px;width:100px;height:140px"></div>');
    const source = fs.readFileSync('src/proto/travelCardFlight.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
    await page.addScriptTag({ content: 'const solverFlightDuration = n => n / 3; const getCardTransportDurationMs = () => 900;' + ts.transpile(source, { target: ts.ScriptTarget.ES2020 }) });
    const result = await page.evaluate(async () => {
      flyTravelCard('test', 'mochi');
      document.querySelector('[data-travel-card]').remove();
      const ghost = document.querySelector('[data-proto-card-flight]');
      const start = ghost.getBoundingClientRect().x;
      await new Promise(resolve => setTimeout(resolve, 100));
      return { start, moved: ghost.getBoundingClientRect().x, disabled: ghost.disabled, text: ghost.textContent };
    });
    assert.equal(result.start, 20);
    assert(result.moved > 20);
    assert(result.disabled);
    assert.equal(result.text, '7');
    await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-proto-card-flight]').count(), 0);
    console.log('PASS travel flight moves, retains face after source removal, and cleans up');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
