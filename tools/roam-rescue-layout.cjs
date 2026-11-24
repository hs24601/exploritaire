const { chromium } = require('playwright'), fs = require('node:fs'), assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const key = 'exploritaire.roam-demi.v1', dir = 'output/roam-rescue-layout';
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = [], defects = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:5178/aldan.html');
    // Synthetic victories prepare presentation states only; the separate
    // playthrough exercises movement and every combat through actual inputs.
    const fixtures = await p.evaluate(async () => {
      const m = await import('/src/expedition/roamRescue.ts'); let s = m.initialRoamRescue(); const f = { home: s };
      const win = () => { s = m.roamRescueReducer(s, { type: 'battle', id: s.encounter.id, battle: { ...s.encounter.battle, result: 'won', foes: s.encounter.battle.foes.map(f => ({ ...f, hp: 0 })) } }); s = m.roamRescueReducer(s, { type: 'continue' }); };
      for (const poi of m.RESCUE_POIS) {
        s = m.roamRescueReducer(s, { type: 'step', position: m.cellPoint(poi.column, poi.row) });
        if (poi.kind === 'dark-demi') f.boss = s;
        if (s.encounter) win();
      }
      f.joined = s;
      s = m.roamRescueReducer(s, { type: 'transfer', id: 'frost-mote', from: 'hero' });
      s = m.roamRescueReducer(s, { type: 'transfer', id: 'frost-mote', from: 'hero' });
      s = m.roamRescueReducer(s, { type: 'step', position: m.cellPoint(-1, -6) });
      s = m.roamRescueReducer(s, { type: 'step', position: m.cellPoint(-2, -6) });
      f.surge = s; return f;
    });
    fs.writeFileSync(dir + '/fixtures.json', JSON.stringify(fixtures));
    for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['wide', { width: 1912, height: 914 }], ['phone', { width: 390, height: 844 }], ['small-phone', { width: 360, height: 640 }], ['landscape', { width: 844, height: 390 }]]) {
      await p.setViewportSize(viewport);
      for (const phase of (process.argv.includes('--combat-only') ? ['boss', 'surge'] : ['home', 'boss', 'joined', 'surge'])) {
        await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key, s: fixtures[phase] }); await p.reload();
        await p.locator('.roam-rescue').waitFor(); await p.waitForTimeout(1100);
        if (phase === 'joined') await p.getByRole('button', { name: 'Party and motes', exact: true }).click();
        await p.screenshot({ path: `${dir}/${name}-${phase}.png` });
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (phase === 'boss' || phase === 'surge') {
          const card = await p.locator('.battle-field__rack button').first().boundingBox();
          if (!card || card.width < 24 || card.height < 30) defects.push(name+'/'+phase+': tableau cards collapsed or disappeared');
        }
        if (phase === 'boss') {
          const figure = await p.locator('[data-dark-demi-figure]').boundingBox();
          if (!figure || figure.height < 64) defects.push(name+'/boss: dark Demi art hidden');
        }
        const checks = phase === 'boss' || phase === 'surge' ? [
          ['.battle-field__solver-dock', 'button'],
          ['.battle-field__team[data-team=enemy]', '.battle-foe__name,.battle-bar,.battle-foe__value'],
          ['.battle-field__team[data-team=party]', '.battle-field__foundation'],
        ] : [['.proto-map-toolbar', 'button'], ...(phase === 'joined' ? [['.roam-motes', 'button,span,small']] : [])];
        for (const [root, parts] of checks) {
          const found = await findLayoutDefects(p, root, { parts });
          defects.push(...found.map(d => `${name}/${phase}: ${d}`));
        }
      }
    }
    // Actual 3x raster review of the new controls, world art, and combat art.
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
    const z = await ctx.newPage(); await z.goto('http://127.0.0.1:5178/aldan.html');
    for (const phase of ['home', 'boss', 'joined', 'surge']) {
      await z.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key, s: fixtures[phase] }); await z.reload(); await z.waitForTimeout(1100);
      if (phase === 'joined') await z.getByRole('button', { name: 'Party and motes', exact: true }).click();
      await z.screenshot({ path: `${dir}/3x-${phase}.png` });
    }
    await ctx.close(); fs.writeFileSync(dir + '/defects.json', JSON.stringify({ errors, defects }, null, 2));
    console.log(JSON.stringify({ errors, defects }, null, 2)); assert.deepEqual(errors, []); assert.deepEqual(defects, []);
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
