const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const fs=require('node:fs');
async function center(locator){const b=await locator.boundingBox();assert(b);return{x:b.x+b.width/2,y:b.y+b.height/2};}
async function checkConfirmationSpace(page){
 await page.waitForTimeout(100);
 await page.getByRole('group',{name:'Travel destination',exact:true}).waitFor({state:'visible'});
 const defects=await page.evaluate(()=>{
  const panel=document.querySelector('.travel-target-actions').getBoundingClientRect();
  const issues=[];
  for(const el of document.querySelectorAll('.travel-route-control,.proto-map-toolbar,.art-settings__cog')){
   const r=el.getBoundingClientRect();
   if(panel.left<r.right&&panel.right>r.left&&panel.top<r.bottom&&panel.bottom>r.top)issues.push('overlap '+el.className);
  }
  const path=document.querySelector('[data-route-line] .proto-route__shade');
  const length=path.getTotalLength(),matrix=path.getScreenCTM();
  for(let i=0;i<=length;i+=2){const p=path.getPointAtLength(i).matrixTransform(matrix);if(p.x>panel.left-4&&p.x<panel.right+4&&p.y>panel.top-4&&p.y<panel.bottom+4){issues.push('route covered');break;}}
  return issues;
 });assert.deepEqual(defects,[],'confirmation must leave route and all nodes clear');
}
async function drag(page,from,to,touch,steps=10){if(touch){const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=steps;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps});await page.mouse.up();}}
(async()=>{fs.mkdirSync('artifacts/travel-route',{recursive:true});const browser=await chromium.launch({headless:true});try{
for(const [width,height,touch] of [[1280,720,false],[390,844,true],[844,390,true]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5178/proto.html');await page.waitForTimeout(1200);
 if(height<500){await page.mouse.move(width-120,200);await page.mouse.down();await page.mouse.move(width-120,110,{steps:8});await page.mouse.up();}
 const a=await center(page.locator('[data-cell-grip="actor-hero"]'));await drag(page,a,{x:a.x+18,y:a.y},touch);await page.waitForTimeout(100);assert.equal(await page.getByRole('dialog',{name:'Confirm journey'}).count(),0,'same-square drop is a no-op');
 const berry=page.locator('[data-board-piece="tile"][data-biome-id="day-one-berries"]');let target=berry;if(!await berry.count())target=page.locator('[data-board-piece="tile"][data-tile-type="berry-patch"]');await drag(page,a,await center(target),touch);await page.getByRole('group',{name:'Travel destination',exact:true}).waitFor();
 await checkConfirmationSpace(page);
 assert.equal(await page.locator('[data-route-control]').count(),1,'new route starts with destination only');
 const routeCell=page.locator('[data-board-piece="tile"][data-grid-reference="table:0,1"]').first();
 if(touch)await routeCell.tap();else await routeCell.click();
 assert.equal(await page.locator('[data-route-control]').count(),2,'clicking a path cell adds a waypoint');
 const handle=page.locator('[data-route-control="0"]');await handle.waitFor();assert.equal(await handle.getAttribute('data-grid-reference'),'table:0,1');let h=await center(handle);const cell=48*1.7;
 await drag(page,h,{x:h.x+cell,y:h.y},touch);assert.equal(await handle.getAttribute('data-grid-reference'),'table:1,1','waypoint snaps to chosen grid');
 h=await center(handle);await drag(page,h,{x:h.x,y:h.y+cell},touch);assert.equal(await handle.getAttribute('data-grid-reference'),'table:1,1','mountain waypoint rejected');await page.getByText('That grid is blocked or unreachable. The last legal route is preserved.',{exact:true}).waitFor();
 await handle.focus();await page.keyboard.press('ArrowUp');assert.equal(await handle.getAttribute('data-grid-reference'),'table:1,0');assert.ok((await page.locator('[data-route-line]').getAttribute('data-route-points')).includes('48.0,0.0'),'route crosses the requested tree grid');
 assert.deepEqual(await findLayoutDefects(page,'.travel-target-actions',{parts:'span,button'}),[]);await page.screenshot({path:`artifacts/travel-route/edit-${width}-3x.png`});
 if(width===1280){await page.keyboard.press('Space');await page.waitForTimeout(700);const dirt=page.locator('[data-board-piece="tile"][data-grid-reference="table:0,1"]');await drag(page,await center(handle),await center(dirt),false);assert.equal(await handle.getAttribute('data-grid-reference'),'table:0,1','immersive drag snaps using the ground plane');await handle.focus();await page.keyboard.press('ArrowUp');assert.equal(await handle.getAttribute('data-grid-reference'),'table:0,0');await page.keyboard.press('ArrowRight');assert.equal(await handle.getAttribute('data-grid-reference'),'table:1,0');await checkConfirmationSpace(page);}
 if(width===1280){await page.keyboard.press('Space');await page.waitForTimeout(700);}
 const destination=page.locator('[data-route-destination="true"]');
 assert.equal(await destination.getAttribute('data-grid-reference'),'table:-1,1');
 let d=await center(destination);
 await drag(page,d,{x:d.x-cell,y:d.y},touch);
 assert.equal(await destination.getAttribute('data-grid-reference'),'table:-2,1','final node moves destination');
 assert.ok((await page.locator('[data-route-line]').getAttribute('data-route-points')).endsWith('-96.0,48.0'),'route ends at new destination');
 d=await center(destination);await drag(page,d,{x:d.x+3*cell,y:d.y+cell},touch,1);
 assert.equal(await destination.getAttribute('data-grid-reference'),'table:-2,1','blocked destination preserves last legal target');
 await destination.focus();await page.keyboard.press('ArrowUp');
 assert.equal(await destination.getAttribute('data-grid-reference'),'table:-2,0','keyboard updates destination');
 await checkConfirmationSpace(page);
 await page.screenshot({path:`artifacts/travel-route/destination-${width}-3x.png`});
 await page.getByRole('button',{name:'Cancel travel',exact:true}).click();assert.equal(await page.locator('[data-route-line]').count(),0);assert.deepEqual(errors,[]);console.log('PASS route editing',width,height,touch);await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
