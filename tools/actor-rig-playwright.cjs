const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const THREE = require('three');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/mochi-rig'; fs.mkdirSync(out, { recursive: true });
const actors = page => page.locator('.combat-demo__arena').getAttribute('data-actors').then(JSON.parse);
const waitForView = (page,view) => page.waitForFunction(view => {
  const arena=document.querySelector('.combat-demo__arena');
  return arena?.dataset.cameraView===view && arena.dataset.cameraMoving==='false';
},view);
async function captureHero(page, path, index=0, actorHeight=3.2) {
  const arena = page.locator('.combat-demo__arena'), box = await arena.boundingBox();
  const camera = new THREE.PerspectiveCamera(45, box.width / box.height, .1, 100);
  camera.position.fromArray((await arena.getAttribute('data-camera-position')).split(',').map(Number));
  camera.lookAt(new THREE.Vector3(...(await arena.getAttribute('data-camera-target')).split(',').map(Number))); camera.updateMatrixWorld();
  const hero = (await actors(page))[index];
  const foot = new THREE.Vector3(hero.position[0], 0, hero.position[1]).project(camera);
  const top = new THREE.Vector3(hero.position[0], actorHeight, hero.position[1]).project(camera);
  const height = Math.abs(top.y - foot.y) * box.height / 2;
  const x = box.x + (foot.x + 1) * box.width / 2, y = box.y + (1 - top.y) * box.height / 2;
  const left = Math.max(box.x, x - height * .7), upper = Math.max(box.y, y - height * .1);
  await page.screenshot({ path, clip: { x: left, y: upper, width: Math.min(height * 1.4, box.x + box.width - left), height: Math.min(height * 1.25, box.y + box.height - upper) } });
}
function checkFacing(state) {
  for (const actor of state) {
    const opponents = state.filter(other => other.team !== actor.team);
    const dx = opponents.reduce((s, other) => s + other.position[0], 0) / opponents.length - actor.position[0];
    const dz = opponents.reduce((s, other) => s + other.position[1], 0) / opponents.length - actor.position[1];
    assert.ok(Math.abs(actor.heading - Math.atan2(dx, dz)) < 1e-6, 'Heading tracks opponents');
    const relative = Math.atan2(Math.sin(actor.billboardYaw-actor.heading), Math.cos(actor.billboardYaw-actor.heading));
    if (actor.view.elevation !== 'top') {
      assert.ok(Math.abs(Math.abs(relative)-actor.view.direction*Math.PI/4) <= Math.PI/8+.056, 'Art follows the camera relative to the world heading');
      assert.equal(actor.flip, actor.id === 'mochi' || actor.view.direction === 0 || actor.view.direction === 4 ? 1 : relative >= 0 ? 1 : -1);
      if(actor.id==='mochi' && actor.view.flip<0) assert.ok(actor.frame.endsWith('-right'),'Mochi uses authored right-side markings');
    } else assert.equal(actor.flip, 1, 'Overhead art is world-aligned');
  }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1912]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor: 3 });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost:5178/proto.html?combatdemo');
      await page.waitForFunction(() => !!document.querySelector('.combat-demo__arena')?.dataset.actors);
      if (width === 1280) {
        const libraryCheck = await page.evaluate(async () => {
          const THREE = await import('/node_modules/.vite/deps/three.js');
          const { createDirectionalSpriteLibrary } = await import('/src/proto/directionalSpriteRig.ts');
          const { HERO_DIRECTIONAL_SPRITE } = await import('/src/proto/directionalSprites.ts');
          const loader = new THREE.TextureLoader(), textures = {};
          for (const [key,file] of [['heroLow','hero-directions-low-v1.png'],['heroHigh','hero-directions-high-v1.png'],['slime','dark-slime-directions-v1.png']]) textures[key] = await loader.loadAsync(`/assets/actors/battle/${file}`);
          const library = createDirectionalSpriteLibrary(textures, HERO_DIRECTIONAL_SPRITE);
          const hero = library.create(2.55), ally = library.create(2.25), camera = new THREE.PerspectiveCamera(); camera.position.set(4,2,7);
          hero.update(camera,0,0,true); ally.update(camera,0,0,true);
          const shared = hero.parts.every((part, i) => part.material.map === ally.parts[i].material.map && part.mesh.geometry === ally.parts[i].mesh.geometry && part.pivot !== ally.parts[i].pivot && part.material !== ally.parts[i].material);
          const inBounds = [...HERO_DIRECTIONAL_SPRITE.low,...HERO_DIRECTIONAL_SPRITE.high,HERO_DIRECTIONAL_SPRITE.top].every(frame => frame.parts.every(({rect:[x,y,w,h]}) => x >= 0 && y >= 0 && x+w <= textures[frame.source].image.width && y+h <= textures[frame.source].image.height));
          const actors = [{position:{x:-3,z:0},heading:Math.atan2(6.5,-1.4)},{position:{x:-4,z:2.6},heading:Math.atan2(7.5,-4)}];
          camera.position.set(-10.048,4.650,3.209);
          const rear = actors.map(actor => { hero.root.position.set(actor.position.x,0,actor.position.z); hero.update(camera,actor.heading,0,true); return hero.view.direction; });
          hero.dispose(); ally.dispose(); library.dispose(); Object.values(textures).forEach(t=>t.dispose());
          return { inBounds, shared, rear };
        });
        assert.deepEqual(libraryCheck, { inBounds: true, shared: true, rear: [4,4] }, 'Atlas regions are valid, instances share GPU assets, and the reported angle shows both Heroes from behind');
      }
      await page.locator('[data-view="side"]').click();
      await waitForView(page,'side');
      let before = await actors(page); checkFacing(before);
      assert.equal(before[1].id,'mochi','Mochi joins Hero in the actual camera study');
      assert.deepEqual(before[0].parts.map(part => part.id), ['head', 'torso', 'hind']);
      assert.deepEqual(before[1].parts.map(part => part.id), ['head', 'torso', 'hind']);
      assert.deepEqual(before[2].parts.map(part => part.id), ['body']);
      await page.waitForTimeout(450); const after = await actors(page); checkFacing(after);
      assert.notDeepEqual(after[0].parts, before[0].parts, 'Independent joint motion is visible');
      assert.notDeepEqual(after[0].parts, after[1].parts, 'Quadrupeds have independent anatomy, phases and sizes');
      await page.locator('.combat-demo__arena').screenshot({ path: `${out}/side-idle-${width}-3x.png` });
      await captureHero(page, `${out}/hero-idle-${width}-3x.png`);
      await captureHero(page, `${out}/mochi-idle-${width}-3x.png`,1,2.8);
      await page.waitForFunction(() => Number(document.querySelector('.combat-demo')?.dataset.elapsed) >= 4.1);
      checkFacing(await actors(page));
      await page.screenshot({ path: `${out}/charge-${width}.png`, scale: 'css' });
      await captureHero(page, `${out}/hero-charge-${width}-3x.png`);
      await page.waitForFunction(() => document.querySelector('.combat-demo')?.dataset.complete === 'true');
      const held = await actors(page);
      for (const view of ['side','party','enemy','overview','cinematic']) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForTimeout(230); checkFacing(await actors(page));
        await waitForView(page,view);
        const state = await actors(page); checkFacing(state);
        assert.deepEqual(state.map(a => a.heading), held.map(a => a.heading), 'Camera never owns world headings');
        await page.screenshot({ path: `${out}/${view}-${width}.png`, scale: 'css' });
        if (view === 'party') {
          await captureHero(page, `${out}/hero-party-${width}-3x.png`);
          await captureHero(page, `${out}/mochi-party-${width}-3x.png`,1,2.8);
        }
      }
      // Freecam is also present in the shared checkout: headings survive arbitrary orbit input.
      if (await page.locator('[data-view="freecam"]').count()) {
        await page.locator('[data-view="freecam"]').click();
        await waitForView(page,'freecam');
        const box = await page.locator('.combat-demo__arena').boundingBox();
        await page.mouse.move(box.x + box.width * .2, box.y + box.height * .5);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(box.x + box.width * (.2 + i * .05), box.y + box.height * .5);
          checkFacing(await actors(page));
        }
        await page.mouse.up();
        assert.deepEqual((await actors(page)).map(a => a.heading), held.map(a => a.heading));
        await page.locator('[data-view="overview"]').click();
        await waitForView(page,'overview');
        await page.locator('[data-view="freecam"]').click();
        await waitForView(page,'freecam');
        const highBox = await page.locator('.combat-demo__arena').boundingBox();
        await page.mouse.move(highBox.x+highBox.width*.5,highBox.y+20); await page.mouse.down();
        await page.mouse.move(highBox.x+highBox.width*.5,highBox.y+200,{steps:8}); await page.mouse.up();
        await page.mouse.wheel(0,600); await page.mouse.wheel(0,600);
        await page.waitForFunction(() => JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').length===4 && JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).every(a=>a.frame==='top'));
        const overhead = await actors(page); checkFacing(overhead);
        assert.ok(overhead.every(a=>a.frame==='top'), 'High free orbit selects world-aligned overhead art for both teams');
        assert.deepEqual(overhead.map(a=>a.heading),held.map(a=>a.heading));
        await page.screenshot({path:`${out}/overhead-${width}.png`,scale:'css'});
        await page.locator('.combat-demo__arena').screenshot({path:`${out}/overhead-${width}-3x.png`});
        await page.locator('[data-view="side"]').click();
        await waitForView(page,'side');
      }
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts: '.combat-demo__header, .combat-demo__header h1, .combat-demo__header p, .combat-demo__header button, .combat-demo__arena, .combat-demo__footer, .combat-demo__readout, .combat-demo__readout span, .combat-demo__camera-panel, .combat-demo__camera-heading, .combat-demo__views, .combat-demo__view, .combat-demo__view svg, .combat-demo__view span, .combat-demo__replay' }), []);
      assert.deepEqual(errors, []); await context.close();
      console.log(`${width}: opponent headings, camera orbit, independent joints, shared rigs, charge, final hold and layout passed`);
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(); await page.goto('http://localhost:5178/proto.html?combatdemo');
    await page.locator('.combat-demo__view:not(:disabled)').first().waitFor();
    await page.locator('[data-view="party"]').tap(); await waitForView(page,'party'); const before = await actors(page); checkFacing(before);
    await page.waitForTimeout(500); const after = await actors(page); checkFacing(after);
    assert.deepEqual(before.map(a => a.parts), after.map(a => a.parts), 'Reduced motion keeps neutral joints');
    await page.screenshot({ path: `${out}/reduced.png` });
    await page.getByRole('button', { name: 'Return to table · Esc' }).tap();
    await context.close(); console.log('Touch view selection/dismissal and reduced-motion neutral joints passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
