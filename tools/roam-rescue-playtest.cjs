const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const key = 'exploritaire.roam-demi.v1', dir = 'output/roam-rescue';
const actor = '[data-board-piece="actor"][data-actor-id="hero"]';
const state = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const ground = (p, position) => p.locator(actor).evaluate((el, pos) => {
  const marker = document.createElement('div');
  marker.style.cssText = `position:absolute;left:calc(50% + ${pos.x}px);top:calc(50% + ${pos.y}px);width:0;height:0;pointer-events:none`;
  el.parentElement.append(marker); const r = marker.getBoundingClientRect(); marker.remove(); return { x: r.x, y: r.y };
}, position);
async function walk(p, c, r) {
  const s = await state(p), start = await ground(p, { x: s.position.x - 8, y: s.position.y + 5 }), end = await ground(p, { x: c * 48, y: r * 48 });
  await p.mouse.move(start.x, start.y); await p.mouse.down(); await p.mouse.move(end.x, end.y, { steps: 16 }); await p.mouse.up();
  await p.waitForFunction(({ key, c, r }) => { const s = JSON.parse(localStorage.getItem(key)); return s.encounter || Math.round(s.position.x / 48) === c && Math.round(s.position.y / 48) === r; }, { key, c, r }, { timeout: 90000 });
  await p.locator('[data-route-line="true"]').waitFor({ state: 'detached', timeout: 90000 });
}
async function fight(p) {
  for (let i = 0; i < 220; i++) {
    const s = await state(p); assert(s.encounter, 'Encounter remains until Continue');
    if (s.encounter.battle.result) { assert.equal(s.encounter.battle.result, 'won', 'Actual combat is survivable'); return; }
    if (s.encounter.battle.turn === 'enemy') { await p.waitForTimeout(180); continue; }
    const auto = p.getByRole('button', { name: 'Auto-Solve', exact: true });
    if (await auto.isEnabled({ timeout: 200 }).catch(() => false)) { await auto.click(); await p.waitForTimeout(450); }
    if (await p.getByRole('button', { name: 'Stop', exact: true }).count()) continue;
    const end = p.getByRole('button', { name: 'END TURN', exact: true });
    if (await end.isEnabled({ timeout: 200 }).catch(() => false)) await end.click({ timeout: 1000 }).catch(() => {});
    await p.waitForTimeout(180);
  }
  throw Error('Combat stalled');
}
async function continueFight(p) { await fight(p); await p.locator('.roam-continue').click(); await p.waitForTimeout(1200); }
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:5178/aldan.html'); await p.locator(actor).waitFor(); await p.waitForTimeout(1000);
    assert.equal(await p.locator('.rescue-caption,.scene-run__bar,.scene-run__foot,.rescue-loading').count(), 0);
    await p.screenshot({ path: dir + '/home.png' });
    const fixtures = { home: await state(p) };
    // Actual native dragging and pathfinding, rather than a state-only traversal.
    for (const [c, r] of [[-2, 0], [-3, -1], [2, -2], [3, -3], [0, -6]]) {
      await walk(p, c, r);
      let s = await state(p);
      if (s.encounter) {
        if (s.encounter.kind === 'boss') {
          fixtures.boss = s; await p.screenshot({ path: dir + '/dark-demi-battle.png' });
        }
        if (s.collected.length === 0) assert.equal(await p.getByRole('meter', { name: 'Hero AP', exact: true }).count(), 0);
        await continueFight(p);
      }
      console.log('Reached', c, r, (await state(p)).collected); fs.writeFileSync(dir+'/navigation-progress.json',JSON.stringify(await state(p))); 
    }
    fixtures.joined = await state(p); assert(fixtures.joined.joined); assert(fixtures.joined.demi.rescueCub);
    await p.screenshot({ path: dir + '/cub-recruited.png' });
    await p.getByRole('button', { name: 'Party and motes', exact: true }).click();
    await p.locator('[data-transfer="hero-frost-mote"]').click(); await p.locator('[data-transfer="hero-frost-mote"]').click();
    assert.equal((await state(p)).demi.lightMotes['frost-mote'], 2);
    await p.getByRole('button', { name: 'Close party', exact: true }).click();
    let encounters = 0;
    while (!(await state(p)).safe && encounters < 6) {
      await walk(p, 0, 2); const s = await state(p);
      if (s.encounter) {
        assert.equal(s.encounter.kind, 'surge'); encounters++;
        if (encounters === 1) { fixtures.surge = s; await p.screenshot({ path: dir + '/return-battle.png' }); }
        await continueFight(p);
      }
    }
    assert.equal(encounters, 4); fixtures.safe = await state(p); assert(fixtures.safe.safe);
    assert.equal(fixtures.safe.collection['frost-mote'], 2);
    await p.screenshot({ path: dir + '/safe.png' });
    console.log('Full navigation and seven actual fights passed');
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['small-phone', { width: 360, height: 640 }], ['landscape', { width: 844, height: 390 }]]) {
      await p.setViewportSize(viewport);
      for (const phase of ['home', 'boss', 'joined', 'surge', 'safe']) {
        await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key, s: fixtures[phase] });
        await p.reload(); await p.locator('.roam-rescue').waitFor(); await p.waitForTimeout(650);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await p.screenshot({ path: `${dir}/${name}-${phase}.png` });
        if (phase === 'home') assert.deepEqual(await findLayoutDefects(p, '.proto-map-toolbar', { parts: 'button' }), []);
        if (phase === 'boss' || phase === 'surge') {
          const box = await p.locator('.battle-field__rack button').first().boundingBox(); assert(box && box.width > 20 && box.height > 20);
        }
      }
    }
    fs.writeFileSync(dir + '/fixtures.json', JSON.stringify(fixtures));
    assert.deepEqual(errors, []);
    console.log('PASS: native exploration, guarded Frost pickups, dark adult/cub rescue, four return ambushes, banking, transfers, responsive layouts');
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
