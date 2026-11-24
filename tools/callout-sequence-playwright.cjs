const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const base = process.env.CALLOUT_SEQUENCE_URL || 'http://127.0.0.1:5188';
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [width,height,touch] of [[1280,720,false],[1912,914,false],[1280,720,true]]) {
      const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:3,hasTouch:touch,reducedMotion:touch?'reduce':'no-preference'});
      const page = await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
      const activate = async locator => touch ? locator.tap() : locator.click();
      await page.goto(base+'/tools/callout-sequence-preview.html');
      const bubble=page.locator('.proto-callout'), next=page.locator('.proto-callout-advance');
      await bubble.waitFor({state:'visible'});
      const visibleText = () => page.locator('.proto-callout-text').evaluate(n=>{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let s='';for(let t=w.nextNode();t;t=w.nextNode())if(getComputedStyle(t.parentElement).visibility!=='hidden')s+=t.textContent;return s;});
      if(!touch) {
        await activate(page.getByRole('button',{name:'Pause',exact:true}));
        const before=await visibleText();await page.waitForTimeout(250);assert.equal(await visibleText(),before);
        assert.equal(await next.isDisabled(),true);
        await activate(page.getByRole('button',{name:'Pause',exact:true}));
        await page.waitForTimeout(150);
        await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));
        const hiddenText=await visibleText();await page.waitForTimeout(250);assert.equal(await visibleText(),hiddenText,'hidden scenes freeze reveal');
        await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
        const initial=await bubble.boundingBox();await page.waitForTimeout(150);assert.deepEqual(await bubble.boundingBox(),initial,'reveal reserves its complete layout');
        await activate(next); assert.equal(await bubble.getAttribute('data-page'),'1','first click completes current text');
      }
      assert.equal(await bubble.getAttribute('data-revealing'),'false');
      assert.match(await visibleText(),/darker/);
      const actors=await page.locator('[data-board-piece="actor"]').all();
      for (const actor of actors) assert.equal(overlaps(await bubble.boundingBox(),await actor.boundingBox()),false);
      assert.deepEqual(await findLayoutDefects(page,'.proto-callout',{parts:'.proto-callout-expression, .proto-callout-copy'}),[]);
      await bubble.screenshot({path:`artifacts/callout-sequence-${width}-${touch?'touch':'mouse'}-3x.png`});
      // Move another actor directly into the bubble; live placement must make room.
      await page.locator('[data-board-piece="actor"]').last().evaluate((n,r)=>Object.assign(n.style,{left:r.x+'px',top:r.y+'px'}),await bubble.boundingBox());
      await page.waitForTimeout(100);
      for (const actor of actors) assert.equal(overlaps(await bubble.boundingBox(),await actor.boundingBox()),false);
      await activate(next);assert.equal(await bubble.getAttribute('data-page'),'2');
      if(!touch) await activate(next);
      assert.match(await visibleText(),/manaberries/);
      await next.focus(); await page.keyboard.press('Enter'); assert.equal(await bubble.getAttribute('data-page'),'3');
      if(!touch) await activate(next);
      await activate(next); assert.equal(await bubble.count(),0);assert.equal(await page.locator('output').innerText(),'1');
      // Local authoring keeps explicit breaks and a speed setting across reloads.
      await activate(page.getByRole('button',{name:'Restart',exact:true}));await activate(page.getByRole('button',{name:'Edit',exact:true}));
      await activate(page.getByRole('button',{name:'Edit callout',exact:true}));
      await page.getByLabel('Callout text').fill('First bubble.\n\nSecond bubble.');
      await page.getByLabel('Reveal speed', {exact:false}).fill('60');
      await activate(page.getByRole('button',{name:'Save callout',exact:true}));
      await page.reload();await bubble.waitFor({state:'visible'});
      assert.equal(await bubble.getAttribute('data-pages'),'2');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.callouts.v1'))['sequence-test'].letterMs),60);
      assert.deepEqual(errors,[]);await context.close();
      console.log('PASS sequence',width,height,touch?'touch/reduced':'mouse');
    }
    for(const [width,height] of [[1280,720],[1912,914]]) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,reducedMotion:'reduce'});
      const page=await context.newPage();await page.goto(base+'/proto.html');
      const bubble=page.locator('.proto-callout');await bubble.waitFor({state:'visible'});await page.waitForTimeout(2200);
      const r=await bubble.boundingBox();assert.ok(r.x>=12&&r.y>=12&&r.x+r.width<=width-12&&r.y+r.height<=height-12);
      const actors=await page.locator('.proto-map [data-board-piece="actor"], .proto-map [data-interior-actor]').all();
      for(const actor of actors)if(await actor.isVisible())assert.equal(overlaps(r,await actor.boundingBox()),false);
      assert.deepEqual(await findLayoutDefects(page,'.proto-callout',{parts:'.proto-callout-expression, .proto-callout-copy'}),[]);
      await page.screenshot({path:`artifacts/callout-story-${width}.png`});await bubble.screenshot({path:`artifacts/callout-story-${width}-3x.png`});
      const grid=await page.locator('[data-actor-id="hero"][data-board-piece="actor"]').getAttribute('data-grid-reference');
      await page.locator('.proto-callout-advance').click();assert.equal(await bubble.getAttribute('data-page'),'2');
      assert.equal(await page.locator('[data-actor-id="hero"][data-board-piece="actor"]').getAttribute('data-grid-reference'),grid);
      await context.close();console.log('PASS opening scene',width,height);
    }
    const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    const page=await context.newPage();await page.goto(base+'/tools/banks-rescue-preview.html');
    await page.waitForFunction(()=>document.querySelector('[data-cinema-beat]')?.dataset.cinemaBeat==='hope');
    const bubble=page.locator('.proto-callout');await bubble.waitFor({state:'visible'});
    const r=await bubble.boundingBox();
    for(const actor of await page.locator('[data-scene-target]').all())if(await actor.isVisible())assert.equal(overlaps(r,await actor.boundingBox()),false);
    await page.getByRole('button',{name:'Pause cinema',exact:true}).click();assert.equal(await page.locator('.proto-callout-advance').isDisabled(),true);
    await page.getByRole('button',{name:'Resume cinema',exact:true}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('.proto-callout-advance').evaluate(n=>n===document.activeElement),true,'cinema focus trap includes portaled callout');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-cinema-beat]')?.dataset.cinemaBeat==='slime-card');
    await context.close();console.log('PASS rescue callout continuation, actor clearance and pause');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
