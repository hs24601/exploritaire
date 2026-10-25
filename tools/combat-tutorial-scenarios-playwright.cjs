// Drives the tutorial and focused combatsbx scenarios (008–016) at desktop
// sizes: status icons, enemy Momentum, the rounds counter, the Insight popup
// and the ability hand stay inside the viewport without overlaps or tiny text.
// Screenshots: artifacts/combat-scenarios/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');

const BASE = process.env.PROTO_URL ?? 'http://127.0.0.1:5178/proto.html';
const SCENARIOS = ['008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018'];
const SIZES = [[1912, 914], [1600, 900], [1280, 720]];
const OUT = 'artifacts/combat-scenarios';
fs.mkdirSync(OUT, { recursive: true });

/** Overlaps/escapes/small text among the elements this work added, plus viewport bounds. */
async function checkOwn(page, label, width, height) {
  return page.evaluate(({ label, width, height }) => {
    const defects = [];
    const own = [...document.querySelectorAll('.battle-status-icon, .battle-rounds')];
    const neighbours = [...document.querySelectorAll('.battle-buff-icon, .battle-enemy-intent, .battle-foe, .battle-field__foundation, .battle-field__header > *, .battle-rounds')];
    const box = el => el.getBoundingClientRect();
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    for (const el of own) {
      const r = box(el);
      if (r.left < 0 || r.top < 0 || r.right > width || r.bottom > height) defects.push(`${label}: ${el.dataset.status ?? el.className} outside viewport`);
      for (const other of neighbours) if (other !== el && !other.contains(el) && !el.contains(other) && overlap(r, box(other))) defects.push(`${label}: ${el.dataset.status ?? el.className} overlaps ${other.dataset.status ?? other.className.split(' ')[0]}`);
      for (const text of [el, ...el.querySelectorAll('*')]) if (text.childNodes[0]?.nodeType === 3 && text.textContent.trim() && parseFloat(getComputedStyle(text).fontSize) < 16) defects.push(`${label}: ${el.dataset.status ?? el.className} text under 16px`);
    }
    return [...new Set(defects)];
  }, { label, width, height });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const failures = [];
  try {
    for (const [width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      for (const id of SCENARIOS) {
        const tag = `${id}-${width}x${height}`;
        await page.goto(`${BASE}?combatsbx&scenario=${id}`);
        await page.locator('[data-status="insight"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${tag}-board.png` });
        failures.push(...await checkOwn(page, tag, width, height));
        if (await page.locator('.battle-enemy-momentum').count() === 0) failures.push(`${tag}: enemy Momentum badge missing`);
        if (['008', '009'].includes(id) && !(await page.locator('.battle-rounds').innerText()).includes('Rounds completed: 0')) failures.push(`${tag}: rounds counter missing`);

        // Insight: hover shows the short tip; a click opens the paged notes.
        const insight = page.locator('[data-status="insight"]');
        await insight.hover(); await page.waitForTimeout(150);
        await insight.click();
        const dialog = page.locator('dialog.insight-dialog');
        await dialog.waitFor();
        for (const tab of ['Intent', 'How to solve it', 'Why it exists']) {
          await dialog.getByRole('tab', { name: tab }).click();
          const page_ = tab === 'Intent' ? 'intent' : tab === 'How to solve it' ? 'solve' : 'why';
          if (tab !== 'Why it exists' || width === 1280) await page.screenshot({ path: `${OUT}/${tag}-insight-${page_}.png` });
          const defects = await findLayoutDefects(page, 'dialog.insight-dialog', { parts: '.insight-dialog__header, .insight-dialog__tabs, .insight-dialog__panel, .insight-dialog__footer, .insight-dialog button, .insight-dialog h2' });
          failures.push(...defects.map(defect => `${tag} insight/${page_}: ${defect}`));
          const bounds = await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
          if (bounds.top < 0 || bounds.left < 0 || bounds.bottom > height || bounds.right > width) failures.push(`${tag}: Insight outside viewport`);
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });

        // Momentum radial: team Withdraw only.
        await page.locator('.momentum-engine__open-skills').click();
        await page.locator('.ability-fan').waitFor();
        const team = await page.locator('.ability-fan > .ability-fan__card').evaluateAll(els => els.map(el => el.dataset.skill));
        if (team.join() !== 'withdraw') failures.push(`${tag}: Momentum radial holds ${team.join()}`);
        await page.keyboard.press('Escape');
        await page.locator('.ability-fan').waitFor({ state: 'detached' });
        // Kin radials: tap Hero's foundation, then add Mochi's; every visible face keeps its own slot.
        if (id !== '008') {
          await page.locator('[data-battle-actor="hero"]').click();
          await page.locator('.ability-fan').waitFor();
          await page.locator('[data-foundation-focus="mochi"]').click();
          await page.waitForTimeout(300);
          const groups = await page.locator('.ability-fan__groups button').all();
          for (let g = 0; g < Math.max(1, groups.length); g++) {
            if (groups.length) { await groups[g].click(); await page.waitForTimeout(300); }
            const cards = await page.locator('.ability-fan > .ability-fan__card').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.skill, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
            for (let i = 0; i < cards.length; i++) {
              const c = cards[i];
              if (c.left < 0 || c.right > width || c.top < 0 || c.bottom > height) failures.push(`${tag}: card ${c.id} outside viewport`);
              for (let j = i + 1; j < cards.length; j++) { const d = cards[j]; if (Math.min(c.right, d.right) - Math.max(c.left, d.left) > 30 && Math.min(c.bottom, d.bottom) - Math.max(c.top, d.top) > 30) failures.push(`${tag}: cards ${c.id} and ${d.id} overlap`); }
            }
            await page.screenshot({ path: `${OUT}/${tag}-hand${groups.length ? '-' + (await groups[g].innerText()).toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.png` });
          }
          await page.keyboard.press('Escape');
          await page.locator('.ability-fan').waitFor({ state: 'detached' });
        }
      }
      // Chip tutorial: play on until a root falls (counter advances) or the party falls (the result shows the rounds reached).
      await page.goto(`${BASE}?combatsbx&scenario=008`);
      await page.locator('.battle-rounds').waitFor();
      const ended = page.locator('dialog.combat-scenario-complete');
      for (let i = 0; i < 80 && !(await page.locator('.battle-rounds').innerText()).includes(': 1') && !(await ended.count()); i++) {
        const playable = await page.locator('.battle-field__rack button:not([disabled])').count();
        const endTurn = page.getByRole('button', { name: 'END TURN' });
        if (playable) await page.getByRole('button', { name: /Auto-M/ }).click();
        else if (await endTurn.isEnabled()) await endTurn.click();
        await page.waitForTimeout(250);
      }
      if (await ended.count()) {
        const text = await ended.innerText();
        if (!/Rounds completed: \d+/.test(text)) failures.push(`${width}x${height}: chip defeat result lacks the rounds reached`);
        await page.screenshot({ path: `${OUT}/008-${width}x${height}-defeat.png` });
        failures.push(...(await findLayoutDefects(page, 'dialog.combat-scenario-complete', { parts: 'h2, .combat-scenario-complete__detail, button' })).filter(defect => !/under 16px/.test(defect) || /detail/.test(defect)).map(defect => `008 defeat: ${defect}`));
      } else {
        const rounds = await page.locator('.battle-rounds').innerText();
        if (!rounds.includes('Rounds completed: 1')) failures.push(`${width}x${height}: chip rounds did not advance (${rounds})`);
        await page.screenshot({ path: `${OUT}/008-${width}x${height}-round-1.png` });
        failures.push(...await checkOwn(page, `008-${width}x${height}-round-1`, width, height));
      }
      await page.close();
      console.log(width, height, 'checked');
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  console.log('combat tutorial scenarios: layout, Insight, hand and rounds counter passed');
})().catch(error => { console.error(error); process.exit(1); });
