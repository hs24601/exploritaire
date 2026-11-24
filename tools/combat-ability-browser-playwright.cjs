// proto.html?combatAbilities: layout at desktop sizes, search and chips,
// expanding a card, the edit form, and one save + reset round trip through the
// dev-only save route. Screenshots: artifacts/combat-abilities/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const URL = (process.env.PROTO_URL ?? 'http://127.0.0.1:5178/proto.html') + '?combatAbilities';
const OUT = 'artifacts/combat-abilities';
const OVERRIDES = 'src/data/combatAbilityOverrides.json';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const before = fs.readFileSync(OVERRIDES, 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const failures = [];
  const check = async (page, tag) => failures.push(...(await findLayoutDefects(page, '.ability-browser', {
    parts: '.ability-browser__header, .ability-browser__controls, .ability-browser__chip, .ability-browser__search, .ability-browser__count, .ability-browser__group h2, .ability-browser__card, .ability-browser__summary, .ability-browser__cost, .ability-browser__tags li, .ability-browser__editor, .ability-browser__editor button',
  })).map(defect => `${tag}: ${defect}`));
  try {
    for (const [width, height] of [[1912, 914], [1600, 900], [1280, 720]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', error => failures.push(`${width}: page error ${error.message}`));
      await page.goto(URL);
      await page.locator('.ability-browser__card').first().waitFor();
      const total = await page.locator('.ability-browser__card').count();
      await check(page, `${width} all`);
      await page.screenshot({ path: `${OUT}/${width}x${height}-all.png`, fullPage: true });

      await page.getByRole('searchbox').fill('frost');
      if (!(await page.locator('.ability-browser__card', { hasText: 'Frost Fang' }).count())) failures.push(`${width}: search missed Frost Fang`);
      await page.getByRole('searchbox').fill('');
      await page.locator('.ability-browser__chip', { hasText: 'Mochi' }).click();
      await page.locator('.ability-browser__chip', { hasText: '🔥 Fire' }).click();
      const fire = await page.locator('.ability-browser__card').count();
      if (fire < 1 || fire >= total) failures.push(`${width}: chips did not narrow (${fire}/${total})`);
      await page.screenshot({ path: `${OUT}/${width}x${height}-filtered.png` });
      await page.getByRole('searchbox').fill('zzz no card');
      if (!(await page.locator('.ability-browser__empty').count())) failures.push(`${width}: no empty state`);
      await page.getByRole('button', { name: 'Clear filters' }).click();

      const takedown = page.locator('.ability-browser__card', { hasText: 'Takedown' }).first();
      await takedown.locator('.ability-browser__summary').click();
      await takedown.getByRole('button', { name: 'Edit' }).click();
      await takedown.locator('.ability-browser__editor').waitFor();
      await takedown.scrollIntoViewIfNeeded();
      await check(page, `${width} editor`);
      await page.screenshot({ path: `${OUT}/${width}x${height}-editor.png` });
      if (!(await takedown.getByRole('link', { name: /011: Frost & Shatter/ }).count())) failures.push(`${width}: Takedown lacks its scenario link`);
      await takedown.getByRole('button', { name: 'Cancel' }).click();

      if (width === 1912) {
        // Duplicate names within an owner are refused before saving.
        await takedown.getByRole('button', { name: 'Edit' }).click();
        await takedown.getByLabel('Name').fill('Bash');
        await takedown.getByRole('button', { name: 'Save' }).click();
        if (!(await takedown.getByRole('alert').innerText()).includes('already has')) failures.push('duplicate name was not refused');
        // Save, survive the reload, then reset.
        await takedown.getByLabel('Name').fill('Takedown Test');
        await Promise.all([page.waitForEvent('load', { timeout: 20000 }).catch(() => null), takedown.getByRole('button', { name: 'Save' }).click()]);
        await page.locator('.ability-browser__flash').waitFor({ timeout: 20000 });
        if (!JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')).takedown) failures.push('save did not reach the overrides file');
        await page.screenshot({ path: `${OUT}/${width}x${height}-saved.png` });
        const renamed = page.locator('.ability-browser__card', { hasText: 'Takedown Test' }).first();
        await renamed.waitFor({ timeout: 20000 });
        if (!(await renamed.getAttribute('data-open'))) await renamed.locator('.ability-browser__summary').click();
        await renamed.getByRole('button', { name: 'Edit' }).click();
        await Promise.all([page.waitForEvent('load', { timeout: 20000 }).catch(() => null), renamed.getByRole('button', { name: 'Reset to default' }).click()]);
        await page.locator('.ability-browser__card', { hasText: /^.*Takedown(?! Test)/ }).first().waitFor({ timeout: 20000 });
        if (JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')).takedown) failures.push('reset did not clear the override');
      }
      await page.close();
      console.log(width, height, 'checked');
    }
  } finally {
    await browser.close();
    fs.writeFileSync(OVERRIDES, before);
  }
  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  console.log('combat ability browser: layout, search, chips, editor and save/reset passed');
})().catch(error => { console.error(error); process.exit(1); });
