const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1912, height: 914 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5178/proto.html');
    const picker = page.getByLabel('Hero emotion', { exact: true });
    await picker.waitFor();
    await page.getByLabel('Resolved Hero emotion').filter({ hasText: 'sad' }).waitFor();
    await picker.selectOption('neutral');
    await page.getByLabel('Resolved Hero emotion').filter({ hasText: 'neutral' }).waitFor();
    await page.getByRole('button', { name: 'Save Hero emotion', exact: true }).click();
    await page.reload(); assert.equal(await picker.inputValue(), 'neutral');
    await page.getByLabel('Day scenario', { exact: true }).selectOption('day02');
    assert.equal(await picker.inputValue(), 'story');
    await page.getByLabel('Resolved Hero emotion').filter({ hasText: 'sad' }).waitFor();
    await page.getByLabel('Day scenario', { exact: true }).selectOption('day01');
    assert.equal(await picker.inputValue(), 'neutral');
    await picker.selectOption('sad');
    await page.getByRole('button', { name: 'Visit nearby bush', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-sprite-pose="walking"][data-actor-expression="sad"][data-face-layer="true"]'));
    await page.screenshot({ path: 'artifacts/scene-actor-emotion-departure.png' });
    await page.getByRole('button', { name: 'Auto-Solve', exact: true }).first().click();
    await page.getByRole('button', { name: 'Visit denser patch', exact: true }).waitFor({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="sad"][data-face-layer="true"]'));
    await picker.selectOption('neutral');
    await page.waitForFunction(() => document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="neutral"][data-face-layer="false"]'));
    await picker.selectOption('story');
    const advance = page.locator('[data-callout-id="day01.sparse-patch"] .proto-callout-advance');
    for (let i = 0; i < 8 && await advance.count(); i++) { await advance.click(); await page.waitForTimeout(100); }
    await page.waitForFunction(() => document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="sad"][data-face-layer="true"]'));
    await page.screenshot({ path: 'artifacts/scene-actor-emotion.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: day defaults, per-day persistence, reload, live face override, and sadness after dialogue closes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
