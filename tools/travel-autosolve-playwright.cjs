const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
fs.mkdirSync('artifacts/event-cards',{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,touch] of [[1280,720,false],[390,844,true],[844,390,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/proto.html');
  await page.getByRole('checkbox',{name:'Follow traveling actor',exact:true}).uncheck();
  if(height<500){await page.mouse.move(width-120,200);await page.mouse.down();await page.mouse.move(width-120,110,{steps:8});await page.mouse.up();}
  const actor=await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
  const tile=await page.locator('[data-board-piece="tile"][data-biome-id="dirt-0-1"]').boundingBox();assert(actor&&tile);
  const from={x:actor.x+actor.width/2,y:actor.y+actor.height/2},to={x:tile.x+tile.width/2,y:tile.y+tile.height/2};
  if(touch){const c=await context.newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=10;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
  else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();}
  await page.getByRole('button',{name:'Confirm travel',exact:true}).click();
  if(touch)await page.getByRole('button',{name:'Tableau',exact:true}).click();
  const field=page.getByRole('region',{name:'Travel tableau'});await field.waitFor();
  await page.screenshot({path:`artifacts/event-cards/live-${width}-initial-3x.png`});
  assert(await field.locator('.proto-tableau-card-area').evaluate(el=>el.clientHeight>40),'the fitted play area remains usable');
  assert(await field.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),'tableau fits without scrolling');
  assert.match(await field.locator('strong').innerText(),/\/3 cards/,'authored easy terrain uses three cards');
  assert.equal(await field.locator('[data-event-card]').count(),0,'event cards are absent');assert.equal(await field.getByRole('combobox',{name:'Event utility actions'}).count(),0);assert.equal(await field.getByRole('button',{name:'Event discard pile'}).count(),0);
  assert.equal(await field.locator('.travel-card-grid button:enabled:not([data-event-card])').count(),1,'the event does not lock legal normal plays');
  const solve=field.getByRole('button',{name:'Auto-Solve',exact:true});
  assert(await solve.isEnabled(),'Auto-Solve is available before earning any terrain mastery');
  await field.getByRole('button',{name:'Pause journey',exact:true}).click();assert(await solve.isDisabled(),'paused travel cannot auto-solve');
  await field.getByRole('button',{name:'Resume journey',exact:true}).click();assert(await solve.isEnabled());
  if(touch)await solve.tap();else await solve.click();
  await field.waitFor({state:'hidden',timeout:10000});assert.deepEqual(errors,[]);console.log('PASS first-crossing Auto-Solve, pause/resume and arrival',width,height,touch);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});


