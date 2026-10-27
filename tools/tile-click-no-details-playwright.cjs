const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,touch] of [[1280,720,false],[390,844,true],[844,390,true]])for(const tilt of [false,true]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/proto.html');await page.waitForSelector('[data-cell-grip="actor-hero"]');
  if(tilt){await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(250);}
  const dirt=page.locator('[data-board-piece="tile"][data-biome-id="dirt-0-1"]');
  if(!tilt){if(touch)await dirt.tap();else await dirt.click();assert.equal(await page.locator('[data-inspection-id]').count(),0,'tile click/tap opens no cards');}
  // Keyboard activation also covers tiles obscured by tall immersive scenery.
  await dirt.press('Enter');await page.waitForTimeout(100);assert.equal(await page.locator('[data-inspection-id]').count(),0,'tile activation never opens detail cards');
  const den=page.locator('[data-board-piece="tile"][data-biome-id="hero-den"]');
  await den.press('Enter');await page.waitForTimeout(100);assert.equal(await page.locator('[data-inspection-id]').count(),0,'an occupied tile does not inspect its actor');
  if(tilt)await page.evaluate(()=>{
   let fiber=document.querySelector('.proto-game-root');fiber=fiber[Object.keys(fiber).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='ProtoVariant')fiber=fiber.return;
   let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.worldActors)hook=hook.next;
   hook.queue.dispatch(state=>({...state,worldActors:state.worldActors.map(actor=>actor.id==='hero'?{...actor,position:{x:0,y:48},location:'table'}:actor)}));
  });
  const actor=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
  if(tilt)await actor.press('Enter');else if(touch)await actor.tap();else await actor.click();
  await page.locator('[data-inspection-id="hero"]').waitFor();assert.equal(await page.locator('[data-inspection-id]').count(),1,'actor click opens only the actor card');
  await page.getByRole('button',{name:/^Close (details|jumbo) card$/}).click();
  if(await page.locator('[data-inspection-id]').count())await page.keyboard.press('Escape');
  await page.locator('[data-inspection-id]').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);console.log('PASS tile activation silent, actor click inspects',width,height,touch,tilt?'immersive':'OTT');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
