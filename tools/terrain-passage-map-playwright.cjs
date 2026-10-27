const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const action of ['cancel','breach']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/tools/terrain-passage-map-fixture.html');
  await page.getByRole('checkbox',{name:'Follow traveling actor',exact:true}).uncheck();
  const a=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:from.x+96*1.7,y:from.y};
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:15});await page.mouse.up();
  await page.getByRole('button',{name:'Confirm travel',exact:true}).click();await page.getByRole('button',{name:'Dig trapdoor · 1 AP'}).waitFor();
  await page.screenshot({path:'artifacts/terrain-passage/map-blocked.png'});
  if(action==='cancel'){
   await page.getByRole('button',{name:'Choose another route'}).click();await page.getByRole('button',{name:'Cancel travel',exact:true}).click();
   const s=await page.locator('[data-passage-state]').evaluate(el=>JSON.parse(el.dataset.passageState));assert.deepEqual(s.position,{x:0,y:96});assert.equal(s.ap,2);assert(!s.open);
  }else{
   await page.getByRole('button',{name:'Dig trapdoor · 1 AP'}).click();
   await page.getByRole('button',{name:'Auto-Solve',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-passage-state]').dataset.passageState).position.x===96,null,{timeout:30000});
   const s=await page.locator('[data-passage-state]').evaluate(el=>JSON.parse(el.dataset.passageState));assert(s.open);assert.equal(s.ap,18);
   await page.screenshot({path:'artifacts/terrain-passage/map-arrived.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS integrated terrain passage map',action);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
