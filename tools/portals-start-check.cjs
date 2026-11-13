const PORTALS_TEST_ORIGIN=process.env.PORTALS_TEST_ORIGIN||'http://127.0.0.1:5178';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('exploritaire.world1111.flurry',JSON.stringify({version:1,reward:'available'})));
  for(const [flag,location,spawn] of [['combat','woods',[0,0]],['tree','grounds',[4,74]],['valley','painted-valley',[0,0]]]){
   if(flag==='valley')await page.emulateMedia({reducedMotion:'no-preference'});
   const entryUrl=`${PORTALS_TEST_ORIGIN}/portals.html?${flag}&quality=medium&stats`;
   await page.goto(entryUrl,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__castle1111&&document.querySelector('.portals-pause-button'),null,{timeout:150000});
   const initial=await page.evaluate(()=>({location:__castle1111.meadowPortal.location,hero:__castle1111.hero,mode:__castle1111.mode}));
   assert.equal(initial.location,location);assert.equal(initial.mode,'play');
   assert(Math.abs(initial.hero.x-spawn[0])<.01&&Math.abs(initial.hero.z-spawn[1])<.01);
   assert.equal(page.url(),entryUrl,'entry URL stays unchanged');
   await page.waitForFunction(()=>/^\d+ FPS/.test(document.querySelector('#fps-readout')?.textContent),null,{timeout:20000});
   assert(await page.locator('#fps-readout').isVisible());
   assert.equal(await page.locator('.world-flurry-inventory').count(),0);
   if(flag==='valley'){
    assert.equal(await page.locator('.castle-meadow-credit').isVisible(),false);
    const cadence=await page.evaluate(async()=>{const samples=[];let last=performance.now();for(let i=0;i<75;i++){const now=await new Promise(requestAnimationFrame);samples.push(now-last);last=now;}return {fps:1000/(samples.reduce((a,b)=>a+b)/samples.length),counter:document.querySelector('#fps-readout').textContent};});
    results.push({flag,initial,cadence});
    await page.screenshot({path:'artifacts/painted-valley-performance.png',timeout:120000});
    await page.click('.portals-pause-button');
    await page.waitForFunction(()=>document.querySelector('#fps-readout')?.textContent==='Paused');
    await page.click('[data-settings]');
    const inspect=page.getByRole('button',{name:'❄ Flurry sticker',exact:true});
    assert(await inspect.isVisible());await inspect.click();
    await page.waitForFunction(()=>document.querySelector('.flurry-collection-dialog')?.open);
    await page.getByRole('button',{name:'Close sticker reward',exact:true}).click();
    await page.click('[data-back]');await page.click('[data-resume]');
    await page.evaluate(()=>__castle1111.replay());
    assert.equal(await page.evaluate(()=>__castle1111.meadowPortal.location),'painted-valley');
   }else results.push({flag,initial});
  }
  await page.goto(PORTALS_TEST_ORIGIN + '/portals.html?tree&quality=low',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__castle1111&&document.querySelector('.portals-pause-button'),null,{timeout:150000});
  assert.equal(await page.evaluate(()=>__castle1111.meadowPortal.location),'grounds');
  assert(await page.evaluate(()=>__castle1111.arrival.time>=1.2));
  await page.evaluate(()=>__castle1111.skip());
  await page.waitForFunction(()=>__castle1111.mode==='play',null,{timeout:30000});
  await page.evaluate(()=>__castle1111.replay(true));
  assert.equal(await page.evaluate(()=>__castle1111.meadowPortal.location),'grounds');
  assert.equal(await page.evaluate(()=>__castle1111.mode),'flight');
  results.push({flag:'tree',normalArrival:true,replay:true});
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/portals-start-check.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
