const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='artifacts/danger-particle-light';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const mode of ['fx=high','fx=low','atmosphere=canvas']){
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:5178/proto.html?${mode}`);await page.waitForSelector('.proto-game-root');
  assert.equal(await page.locator('[data-danger="true"]').count(),0,'concealed danger emits no warning');
  await page.evaluate(()=>{
   let fiber=document.querySelector('.proto-game-root');fiber=fiber[Object.keys(fiber).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='ProtoVariant')fiber=fiber.return;
   let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.biomeTiles)hook=hook.next;
   hook.queue.dispatch(state=>({...state,biomeTiles:state.biomeTiles.map(tile=>tile.id==='woods-danger'?{...tile,flags:tile.flags?.filter(f=>f!=='unexplored'),traversalProgress:1}:tile)}));
  });
  const tile=page.locator('[data-board-piece="tile"][data-biome-id="woods-danger"]');
  await page.waitForFunction(()=>Number(document.querySelector('[data-board-piece="tile"][data-biome-id="woods-danger"]')?.dataset.lightPercent)>35);
  const on=Number(await tile.getAttribute('data-light-percent'));assert(on>35,'danger embers contribute real local light across the tile footprint');
  await page.screenshot({path:`${out}/${mode.replace('=','-')}-ott-on.png`});
  await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByRole('checkbox',{name:'Table lights',exact:true}).uncheck();
  await page.waitForTimeout(200);const off=Number(await tile.getAttribute('data-light-percent'));assert(on>off+20,'Table lights removes the ember illumination');
  await page.getByRole('checkbox',{name:'Table lights',exact:true}).check();await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
  await page.locator('[data-danger="true"]').first().waitFor({state:'attached'});
  await page.locator('[data-halo-light="biome-light-danger-woods-danger"]').waitFor();
  await page.waitForTimeout(600);assert.equal(Number(await tile.getAttribute('data-light-percent')),on,'OTT and immersion share the same emission');
  await page.screenshot({path:`${out}/${mode.replace('=','-')}-immersive-on.png`});assert.deepEqual(errors,[]);
  console.log('PASS danger red light, visibility gate, toggle and both cameras',mode,`${on}% on / ${off}% off`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
