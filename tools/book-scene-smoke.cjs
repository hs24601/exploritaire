const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async()=>{
 fs.mkdirSync('output/book',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true});
  if(process.argv.includes('--bakes'))await page.addInitScript(()=>{
   const native=requestAnimationFrame.bind(window);window.__bookClock={hold:null,last:0};
   window.requestAnimationFrame=callback=>native(t=>{const now=window.__bookClock.hold??t;window.__bookClock.last=now;callback(now);});
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5183/book.html');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',{timeout:45000});
  if(process.argv.includes('--bakes')){
   const captures=async()=>Number(await page.locator('canvas').getAttribute('data-page-captures'));
   const leaf=async(min,max)=>page.waitForFunction(([a,b])=>{const d=document.querySelector('canvas').dataset;return d.leafTextured==='true'&&Number(d.leafProgress)>a&&Number(d.leafProgress)<b;},[min,max]);
   await page.locator('#next').click();await leaf(.12,.5);
   await page.evaluate(()=>{window.__bookClock.hold=window.__bookClock.last;});
   assert.equal(await captures(),4);await page.screenshot({path:'output/book/11-textured-front.png'});
   await page.evaluate(()=>{const u=Number(document.querySelector('canvas').dataset.leafProgress);window.__bookClock.hold+=2400*.6*(.75-u);});
   await leaf(.7,.8);await page.screenshot({path:'output/book/12-textured-back.png'});
   await page.evaluate(()=>{window.__bookClock.hold=null;});
   await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');assert.equal(await captures(),4,'bakes stay constant during animation');
   await page.locator('#previous').tap();await leaf(.12,.5);await page.evaluate(()=>{window.__bookClock.hold=window.__bookClock.last;});await page.screenshot({path:'output/book/13-textured-backward.png'});await page.evaluate(()=>{window.__bookClock.hold=null;});
   await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den');assert.equal(await captures(),4,'unchanged pages reuse their GPU textures');
   await page.locator('#scene-action').click();await page.locator('#next').click();
   await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');assert.equal(await captures(),6,'only changed spread is rebaked');
   await page.locator('#map-bookmark').tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.leafTextured==='true');
   await page.screenshot({path:'output/book/14-textured-map-riffle.png'});
   await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='map');assert.equal(await captures(),8);assert.equal(await page.locator('canvas').getAttribute('data-page-cache-size'),'6');
   await page.locator('#return-bookmark').tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');assert.equal(await captures(),8);
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#previous').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den');assert.equal(await captures(),8,'reduced motion does not allocate unused snapshots');
   assert.deepEqual(errors,[]);console.log('PASS: textured leaf fronts/backs, forward/backward turns, map riffle and bookmark return, cache reuse, changed-scene invalidation, six-target bound and reduced-motion allocation avoidance.');return;
  }
  if(process.argv.includes('--edges')){
   const edge=async name=>(await page.locator('canvas').getAttribute('data-'+name)).split(',').map(Number);
   const click=async name=>{const [x,y]=await edge(name);await page.mouse.click(x,y);};
   await click('left-edge');assert.equal(await page.locator('canvas').getAttribute('data-turning'),'false');
   await click('right-edge');await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');
   await click('left-edge');await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den');
   await page.locator('#fold').tap();
   const [x,y]=await edge('right-edge');await page.touchscreen.tap(x,y);await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');
   const [dx,dy]=await edge('left-edge');await page.mouse.move(dx,dy);await page.mouse.down();await page.mouse.move(dx+70,dy+15,{steps:6});await page.mouse.move(dx,dy,{steps:6});await page.mouse.up();
   assert.equal(await page.locator('canvas').getAttribute('data-turning'),'false');
   assert.equal(await page.locator('canvas').getAttribute('data-scene'),'berries');
   await page.locator('#reset').click();
   await page.waitForTimeout(350);
   const [hx,hy]=await edge('left-edge');await page.mouse.move(hx,hy);await page.waitForFunction(()=>document.querySelector('canvas').style.cursor==='pointer');
   await page.screenshot({path:'output/book/10-page-edge-hover.png'});
   for(const root of ['#book-tools','#book-pages'])assert.deepEqual(await findLayoutDefects(page,root,{parts:':scope > button, :scope > span, :scope > details'}),[]);
   assert.deepEqual(errors,[]);console.log('PASS: mouse forward/back page edges, touch turn from folded scene, first-page boundary, drag-return does not flip, hover cursor and control layout; no runtime errors.');return;
  }
  if(process.argv.includes('--visual')){
   await page.screenshot({path:'output/book/08-den-corrected.png'});
   await page.locator('#map-bookmark').tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='map');
   await page.screenshot({path:'output/book/09-map-corrected.png'});
   await page.locator('#return-bookmark').tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den');
   for(const root of ['#book-tools','#book-pages'])assert.deepEqual(await findLayoutDefects(page,root,{parts:':scope > button, :scope > span, :scope > details'}),[]);
   assert.deepEqual(errors,[]);console.log('PASS corrective: revised artwork, closer camera, larger printed prose, map and bookmark return, control layout; no runtime errors.');return;
  }
  await page.screenshot({path:'output/book/01-den.png'});
  for(const root of ['#book-tools','#book-pages'])assert.deepEqual(await findLayoutDefects(page,root,{parts:':scope > button, :scope > span, :scope > details'}),[]);
  await page.locator('#scene-action').tap();
  assert.equal(await page.locator('canvas').getAttribute('data-collected'),'1');
  await page.locator('#next').click();
  await page.waitForTimeout(1000);await page.screenshot({path:'output/book/02-turn.png'});
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');
  await page.screenshot({path:'output/book/03-berries.png'});
  await page.locator('#scene-action').click();
  const beforeCamera=await page.locator('canvas').getAttribute('data-camera');
  await page.locator('#map-bookmark').tap();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.phase==='bookmark');
  assert.equal(await page.locator('canvas').getAttribute('data-return-scene'),'berries');
  await page.screenshot({path:'output/book/06-bookmark-insertion.png'});
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='map');
  assert.notEqual(await page.locator('canvas').getAttribute('data-camera'),beforeCamera);
  await page.screenshot({path:'output/book/07-map.png'});
  assert.equal(await page.locator('[data-map-stop="1"]').isVisible(),true);
  await page.locator('#return-bookmark').tap();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');
  assert.equal(await page.locator('#scene-action').isDisabled(),true);
  await page.locator('#fold').tap();assert.equal(await page.locator('canvas').getAttribute('data-folded'),'true');
  await page.locator('#fold').tap();
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='frost');
  await page.screenshot({path:'output/book/04-frost.png'});
  await page.locator('#scene-action').tap();
  assert.equal(await page.locator('canvas').getAttribute('data-collected'),'3');
  await page.locator('#previous').tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='berries');
  assert.equal(await page.locator('#scene-action').isDisabled(),true);
  await page.mouse.move(650,360);await page.mouse.down();await page.mouse.move(800,400,{steps:8});await page.mouse.up();
  await page.locator('#reset').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#previous').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den');
  await page.setViewportSize({width:1912,height:914});await page.screenshot({path:'output/book/05-wide.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
  await page.locator('#map-bookmark').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='map');
  await page.locator('[data-map-stop="2"]').click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='frost');
  assert.ok((await page.locator('#page-narrative').textContent()).includes('winter'));
  assert.deepEqual(errors,[]);console.log('PASS: page turns, scene state, map bookmark insertion/return, map destinations, cinematic camera, touch actions, fold/unfold, reduced motion and desktop layout; no runtime or asset errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
