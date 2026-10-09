const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('artifacts/tableau-camera',{recursive:true});
 try {
  for(const [width,height] of [[1280,720],[1912,914]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:3});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5178/proto.html');
   await page.locator('[data-board-piece="actor"]').waitFor();
   const a=await page.locator('[data-board-piece="actor"]').boundingBox(),t=await page.locator('[data-biome-id="woods-alpha"]').boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await page.mouse.up();
   await page.locator('.proto-actor-energy').waitFor({timeout:15000});
   await page.waitForTimeout(1000);
   if(await page.getByRole('button',{name:'Flat camera view',exact:true}).count()) {
    await page.getByRole('button',{name:'Flat camera view',exact:true}).click();await page.waitForTimeout(1000);
   }
   assert.equal(await page.locator('[data-css-camera-background="true"]').count(),1);
   assert.equal(await page.locator('.proto-tableau-scenery').count(),0);
   assert.equal(await page.locator('.proto-map-world').count(),1);
   assert.equal(await page.locator('.combat-shared-view').count(),0);
   const viewport=page.locator('.proto-map-viewport');
   const before=await viewport.boundingBox();
   const clip=await viewport.evaluate(e=>getComputedStyle(e).clipPath);
   assert.match(clip,/-[\d.]+px/,'Clipping expands left into exploration field');
   await page.screenshot({path:`artifacts/tableau-camera/exploration-${width}-flat-3x.png`});
   await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1200);
   const explorationTilt=await page.locator('.proto-foundation-card--exploration').first().evaluate(e=>getComputedStyle(e).transform);
   const popup=page.locator('.proto-foundation-popup');
   assert.equal(await popup.locator('[data-actor-base-name="Hero"]').count(),1);
   assert.equal(await popup.evaluate(e=>getComputedStyle(e).bottom),'-20px');
   assert.deepEqual(await viewport.boundingBox(),before,'Extension preserves camera viewport');
   assert.deepEqual(await findLayoutDefects(page,'.proto-tableau-field',{parts:'.proto-main-tableau,.proto-main-foundations,.proto-tableau-card-area,.proto-tableau-solve-controls'}),[]);
   await page.screenshot({path:`artifacts/tableau-camera/exploration-${width}-tilt-3x.png`});
   assert.deepEqual(errors,[]);
   await page.goto('http://127.0.0.1:5178/proto.html?combatdemo');
   await page.locator('[data-view="party"]:not(:disabled)').waitFor();
   assert.equal(await page.locator('.battle-field .proto-actor-base-name--screen').count(),4);
   assert.equal(await page.locator('.battle-field .proto-foundation-exit').count(),0);
   assert.equal(await page.locator('.battle-field__foundation').first().evaluate(e=>getComputedStyle(e).transform),explorationTilt,'Foundation tilt matches exploration');
   assert.match(await page.locator('[data-battle-actor="hero"] .proto-sprite-standee__art').evaluate(e=>e.style.backgroundImage),/actors\/hero.png/);
   assert.equal(await page.locator('[data-battle-actor="mochi"] [data-foundation-pose="quarter"]').count(),1);
   const shape=await page.locator('.battle-field__actor-card').first().evaluate(e=>({width:parseFloat(getComputedStyle(e).width),height:parseFloat(getComputedStyle(e).height)}));assert.ok(Math.abs(shape.height/shape.width-74/56)<.01);
   assert.deepEqual(await page.locator('.battle-field__foundation').evaluateAll(foundations=>foundations.flatMap(f=>{
    const bounds=f.getBoundingClientRect(),sprite=f.querySelector('.battle-field__sprite').getBoundingClientRect(),card=f.querySelector('.battle-field__actor-card').getBoundingClientRect();
    const failures=[];
    if(Math.abs((sprite.left+sprite.right-card.left-card.right)/2)>4) failures.push('Sprite must align with its foundation card');
    for(const letter of f.querySelectorAll('.proto-actor-base-name__letter')){
     const r=letter.getBoundingClientRect();if(r.left<bounds.left||r.right>bounds.right||r.bottom>bounds.bottom) failures.push('Actor name escapes foundation');
    }
    return failures;
   })),[]);
   assert.deepEqual(await findLayoutDefects(page,'.battle-field',{parts:'.battle-field__header,.battle-field__team,.battle-field__foundation,.battle-field__actor-card,.battle-field__counters,.battle-field__tableau,.battle-field__column'}),[]);
   await page.locator('.battle-field').screenshot({path:`artifacts/tableau-camera/combat-${width}-3x.png`});
   await page.close();
  }
  console.log('Exploration CSS camera extension and combat foundation presentation passed at both desktop sizes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
