const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const reports=[];
 try{for(const [width,height,touch,reduced]of [[1280,720,false,false],[1912,914,true,false],[390,844,true,true],[844,390,true,true]]){
  if(process.env.CHECK_WIDTH && width!==Number(process.env.CHECK_WIDTH))continue;
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,deviceScaleFactor:process.env.ZOOM_QA?3:1,reducedMotion:reduced?'reduce':'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html');
  const map=page.locator('.proto-map'),opening=page.locator('[data-callout-id="day01.opening"]');
  await opening.waitFor({timeout:10000}).catch(async error=>{
    await page.screenshot({path:`artifacts/opening-cards-blocked-${width}.png`});
    console.log(JSON.stringify(await page.evaluate(async()=>({actors:(await import('/src/proto/sceneProjection.ts')).sceneActorBoxes(),map:document.querySelector('.proto-map')?.getBoundingClientRect().toJSON(),hero:document.querySelector('[data-board-piece="actor"][data-actor-id="hero"]')?.getBoundingClientRect().toJSON(),callout:document.querySelector('.proto-callout')?.getBoundingClientRect().toJSON()}))));
    throw error;
  });
  assert.equal(await map.getAttribute('data-opening-cards'),'pending');
  assert.equal(await page.locator('[data-map-actor-card="hero"]').isVisible(),false);
  assert.equal(await page.locator('.day-objective__tracker').isVisible(),false);
  await page.screenshot({path:`artifacts/opening-cards-hidden-${width}.png`});
  const next=opening.locator('.proto-callout-next');
  const press=async()=>touch?next.tap():next.click();
  if(await opening.getAttribute('data-revealing')==='true')await press();
  await press();
  await page.waitForFunction(()=>document.querySelector('[data-callout-id="day01.opening"]')?.getAttribute('data-page')==='2');
  if(!reduced){
   assert.equal(await map.getAttribute('data-opening-cards'),'pending');
   await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='dealing');
   await page.waitForFunction(()=>document.querySelectorAll('.opening-card-deal__flight:not([hidden])').length>=3);
   await page.evaluate(async()=>{(await import('/src/gameTime.ts')).gameTime.setPaused(true);});
   assert.equal(await page.locator('.opening-card-deal__flight').count(),9);
   assert.equal(await page.locator('.opening-card-deal__flight [data-dealt-subtask]').count(),8);
   const visibleFlights=await page.locator('.opening-card-deal__flight:not([hidden])').count();
   assert(visibleFlights>1&&visibleFlights<9,'individual cards start in a rapid stagger');
   await page.screenshot({path:`artifacts/opening-cards-flying-${width}.png`});
   if(process.env.ZOOM_QA)await page.locator('.opening-card-deal__flight').first().screenshot({path:`artifacts/opening-card-flight-${width}-3x.png`});
   const before=await page.locator('.opening-card-deal').innerHTML();await page.waitForTimeout(250);
   assert.equal(await page.locator('.opening-card-deal').innerHTML(),before,'global pause freezes flights');
   await page.evaluate(async()=>{(await import('/src/gameTime.ts')).gameTime.setPaused(false);});
  }
  await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='complete');
  assert.equal(await opening.getAttribute('data-page'),'2','cards arrive while the second bubble remains visible');
  assert(await page.locator('[data-map-actor-card="hero"]').isVisible());
  assert(await page.locator('.day-objective__tracker').isVisible());
  assert.equal(await page.locator('.opening-card-deal__flight').count(),0);
  assert.deepEqual(errors,[]);
  const layout=await findLayoutDefects(page,'.proto-map',{parts:'.actor-map-card, .day-objective__tracker',minFontSize:16});
  // The previously approved compact Hero nameplate deliberately retains its size.
  assert.deepEqual(layout.filter(issue=>!/^H2 text "Hero" is /.test(issue)),[]);
  await page.screenshot({path:`artifacts/opening-cards-landed-${width}.png`});
  if(process.env.ZOOM_QA){
    await page.locator('[data-map-actor-card="hero"]').screenshot({path:`artifacts/opening-hero-card-${width}-3x.png`});
    await page.locator('.day-objective__tracker').screenshot({path:`artifacts/opening-quest-card-${width}-3x.png`});
  }
  if(width===1280){
    await page.locator('.proto-day-panel__toggle').click();
    await page.getByRole('button',{name:'Restart scenario',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='pending');
    assert.equal(await page.locator('[data-map-actor-card="hero"]').isVisible(),false);
  }
  reports.push({width,height,touch,reduced,layout,errors});console.log(JSON.stringify(reports.at(-1)));
  await page.close();
 }}finally{await browser.close();fs.writeFileSync('artifacts/opening-card-deal-check.json',JSON.stringify(reports,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
