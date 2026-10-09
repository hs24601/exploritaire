const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const out = 'artifacts/battle-viewport';
fs.mkdirSync(out, { recursive: true });
const sceneParts = '.combat-demo__header, .combat-demo__header h1, .combat-demo__header button, .combat-demo__footer, .combat-demo__readout, .combat-demo__readout span, .combat-demo__camera-panel, .combat-demo__views, .combat-demo__view, .combat-demo__view svg, .combat-demo__view span, .combat-demo__replay, .combat-demo__scene-actions, .combat-demo__scene-actions button, .combat-demo__freecam, .combat-demo__freecam p, .combat-demo__movement, .combat-demo__movement button, .combat-demo__diagnostics summary';
const fieldParts = '.battle-field__header, .battle-field__board, .battle-field__team, .battle-field__team h3, .battle-field__foundation, .battle-field__pile, .battle-field__counters, .battle-field__actor-card, .battle-field__name, .battle-field__tableau, .battle-field__column, .battle-field__footer, .battle-field__footer button';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1280,720], [1912,914]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="side"]:not(:disabled)').waitFor();
      assert.equal(await page.locator('.proto-map-viewport').count(), 0, 'CSS table camera is unmounted');
      assert.equal(await page.locator('.proto-main-layout > .combat-demo').count(), 1, 'Scene occupies the table layout slot');
      assert.equal(await page.locator('[data-battle-actor]').count(), 4);
      assert.equal(await page.locator('.battle-field__column').count(), 7);
      assert.equal(await page.locator('.combat-shared-view canvas').count(),1,'One camera render spans both combat panels');
      assert.equal(await page.locator('.battle-field .proto-tableau-scenery').count(),0,'The tableau uses the camera world instead of sprite scenery');
      assert.equal(await page.locator('.combat-shared-view').getAttribute('data-projection'),'extended');
      const sharedBox = await page.locator('.combat-shared-view').boundingBox();
      const fieldBox = await page.locator('.battle-field').boundingBox();
      const arenaBox = await page.locator('.combat-demo__arena').boundingBox();
      assert.ok(sharedBox.x <= fieldBox.x && sharedBox.x + sharedBox.width >= arenaBox.x + arenaBox.width - 1,'Canvas covers field and arena continuously');
      assert.equal(await page.locator('.proto-supply-sidebar[data-open="true"], .proto-quest-sidebar[data-open="true"], .tray-restore').count(), 0, 'Combat stows trays and keeps their handles off the cards');
      const cardBoxes = await page.locator('.battle-field__column').evaluateAll(columns => columns.map(column => {
        const rect = column.getBoundingClientRect(); return {x:rect.x, width:rect.width};
      }));
      assert.ok(cardBoxes[0].width > 40, 'Cards use the recovered field width');
      cardBoxes.slice(1).forEach((box, index) => assert.ok(Math.abs(box.x - cardBoxes[index].x - cardBoxes[index].width - 3) < 1, 'Columns have snug 3px gaps'));
      assert.equal(await page.locator('[data-view="cinematic"]').getAttribute('aria-pressed'), 'false');
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      assert.equal(await page.locator('[data-view="party"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.combat-demo__arena').getAttribute('data-camera-position'), '-10.000,5.200,7.500');
      const enemyBox = await page.locator('[data-team="enemy"]').boundingBox();
      const partyBox = await page.locator('[data-team="party"]').boundingBox();
      const tableauBox = await page.locator('.battle-field__tableau').boundingBox();
      assert.ok(enemyBox.y + enemyBox.height <= tableauBox.y && tableauBox.y + tableauBox.height <= partyBox.y, 'Enemy above tableau above players');
      await page.locator('[data-view="side"]').click();
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      const actors = JSON.parse(await page.locator('.combat-demo__arena').getAttribute('data-actors'));
      assert.deepEqual(actors.map(a => a.id), ['hero','mochi','dark-slime','rear-slime']);
      for (const [root,parts] of [['.combat-demo',sceneParts],['.battle-field',fieldParts]]) {
        const defects = await findLayoutDefects(page, root, { parts });
        assert.deepEqual(defects, [], `${width} ${root}`);
      }
      assert.deepEqual(await page.locator('.battle-field__column').evaluateAll(columns => columns.flatMap(column => {
        const cards = [...column.querySelectorAll('button')];
        return cards.flatMap((card, index) => {
          const rect = card.getBoundingClientRect();
          const failures = Math.abs(rect.height / rect.width - 74 / 56) > .02 ? ['Card aspect ratio changed'] : [];
          if (index < cards.length - 1) {
            const text = card.querySelector('.proto-card-rank').firstChild;
            const range = document.createRange(); range.selectNodeContents(text);
            if (range.getBoundingClientRect().bottom > cards[index + 1].getBoundingClientRect().top + .5) failures.push('Buried rank covered by next card');
          }
          return failures;
        });
      })), [], 'Full portrait cards and readable buried ranks');
      await page.screenshot({ path: `${out}/side-${width}.png`, scale: 'css' });
      await page.locator('.battle-field').screenshot({ path: `${out}/field-${width}-3x.png`, scale: 'device' });
      await page.locator('.combat-demo__footer').screenshot({ path: `${out}/camera-${width}-3x.png`, scale: 'device' });
      await page.locator('.combat-demo__header').screenshot({ path: `${out}/header-${width}-3x.png`, scale: 'device' });
      await page.locator('[data-view="freecam"]').click();
      assert.equal(await page.locator('.combat-demo__freecam, [data-move]').count(),0,'Freecam movement panel is removed');
      const floatingFooter = await page.locator('.combat-demo__footer').boundingBox();
      const floatingArena = await page.locator('.combat-demo__arena').boundingBox();
      assert.ok(floatingFooter.y >= floatingArena.y && floatingFooter.y + floatingFooter.height <= floatingArena.y + floatingArena.height,'Camera presets float inside the viewport');
      await page.waitForFunction(() => document.querySelector('.combat-demo__arena')?.dataset.cameraMoving === 'false');
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts: sceneParts }), []);
      const before = await page.locator('.combat-demo__arena').getAttribute('data-camera-position');
      await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
      assert.notEqual(await page.locator('.combat-demo__arena').getAttribute('data-camera-position'), before);
      await page.locator('.combat-demo__diagnostics summary').click();
      assert.equal(await page.locator('.combat-demo__properties').isVisible(), true);
      assert.deepEqual(await findLayoutDefects(page, '.combat-demo', { parts: '.combat-demo__diagnostic-body, .combat-demo__properties, .combat-demo__properties span, .combat-demo__copy' }), []);
      await page.locator('.combat-demo__diagnostics summary').click();
      await page.getByRole('button',{name:'Restart battle scene'}).click();
      await page.locator('[data-view="side"]:not(:disabled)').waitFor();
      await page.locator('[data-view="cinematic"]').click();
      await page.waitForFunction(() => document.querySelector('.combat-demo')?.dataset.complete === 'true');
      await page.keyboard.press('Escape');
      await page.locator('.proto-map-viewport').waitFor();
      assert.equal(await page.locator('.combat-demo').count(),0);
      // Enter by moving the world actor into the Dark Woods, then leave both fields.
      const actor = await page.locator('[data-board-piece="actor"]').first().boundingBox();
      const danger = await page.locator('[data-biome-id="woods-danger"]').boundingBox();
      await page.mouse.move(actor.x+actor.width/2,actor.y+actor.height/2); await page.mouse.down();
      await page.mouse.move(danger.x+danger.width/2,danger.y+danger.height/2,{steps:15}); await page.mouse.up();
      await page.locator('.combat-shared-view canvas').waitFor({timeout:15000});
      await page.getByRole('button',{name:'Escape',exact:true}).click();
      await page.locator('.proto-map-viewport').waitFor();
      assert.equal(await page.locator('.combat-demo').count(),0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${width}: opening sweep, Party rest, roster, stacked field, layout, freecam, diagnostics, replay, final hold, Escape passed`);
    }
    for (const [width, height] of [[390,844], [844,390]]) {
      const context = await browser.newContext({ viewport: {width,height}, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
      await page.locator('[data-view="party"]:not(:disabled)').waitFor();
      await page.getByRole('button', {name:'Tableau',exact:true}).tap();
      await page.waitForFunction(()=>document.querySelector('.combat-shared-view')?.dataset.projection==='tableau');
      const canvasBox = await page.locator('.combat-shared-view').boundingBox();
      const fieldBox = await page.locator('.battle-field').boundingBox();
      assert.ok(Math.abs(canvasBox.width-fieldBox.width)<1 && Math.abs(canvasBox.height-fieldBox.height)<1,'Mobile camera follows the visible Tableau panel');
      assert.deepEqual(await findLayoutDefects(page, '.battle-field', {parts:fieldParts}), [], `${width} mobile field`);
      await page.locator('.battle-field').screenshot({path:`${out}/field-${width}.png`});
      await context.close();
      console.log(`${width}: mobile tableau layout passed`);
    }
    const context = await browser.newContext({ viewport:{width:1280,height:720},hasTouch:true,reducedMotion:'reduce' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
    await page.locator('[data-view="freecam"]:not(:disabled)').waitFor();
    await page.locator('[data-view="freecam"]').tap();
    const arena = page.locator('.combat-demo__arena'), box = await arena.boundingBox();
    const before = await arena.getAttribute('data-camera-position');
    const touch = await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+60,y:box.y+box.height/2+20,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.notEqual(await arena.getAttribute('data-camera-position'),before);
    await page.getByRole('button',{name:'Return to table · Esc'}).tap();
    await page.locator('.proto-map-viewport').waitFor();
    console.log('Touch orbit, reduced motion and table restoration passed');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });


