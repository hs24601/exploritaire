const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('../tools/lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out='artifacts/mochi-v2-review';fs.mkdirSync(out,{recursive:true});
 try{
  for(const width of [1280,1912]){
   const context=await browser.newContext({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto('http://localhost:5178/proto.html?combatdemo');assert.equal(response.status(),200);
   await page.waitForFunction(()=>document.querySelector('.combat-demo__arena')?.dataset.actors);
   await page.waitForFunction(()=>document.querySelector('.combat-demo__arena')?.dataset.cameraMoving==='false');
   for(const view of ['side','party','enemy','overview']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.waitForFunction(view=>{const a=document.querySelector('.combat-demo__arena');return a.dataset.cameraView===view&&a.dataset.cameraMoving==='false';},view);
    const actors=JSON.parse(await page.locator('.combat-demo__arena').getAttribute('data-actors'));
    assert.equal(actors[1].id,'mochi');assert.deepEqual(actors[1].parts.map(p=>p.id),['head','torso','hind']);
    await page.screenshot({path:`${out}/${view}-${width}.png`,scale:'css'});
    await page.locator('.combat-demo__arena').screenshot({path:`${out}/${view}-${width}-3x.png`});
   }
   const card=page.locator('img[src*="mochi-card-v4"]');assert.ok(await card.count());
   await card.first().screenshot({path:`${out}/card-${width}-3x.png`});
   // These controls deliberately float over the arena; compare their own
   // boxes rather than reporting the intended control/arena overlap.
   const defects=await findLayoutDefects(page,'.combat-demo',{parts:'.combat-demo__views, .combat-demo__camera-panel'});
   fs.writeFileSync(`${out}/layout-${width}.json`,JSON.stringify(defects,null,2));
   assert.deepEqual(defects,[]);
   assert.deepEqual(errors,[]);
   console.log(`${width}: all four presets rendered Mochi and v4 card; layout findings: ${JSON.stringify(defects)}`);
   console.log(await page.locator('.proto-build-label').innerText());await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto('http://localhost:5178/proto.html?combatdemo');await page.locator('[data-view="side"]').tap();
  await page.waitForFunction(()=>document.querySelector('.combat-demo__arena')?.dataset.cameraView==='side');
  const before=JSON.parse(await page.locator('.combat-demo__arena').getAttribute('data-actors'));
  await page.waitForTimeout(500);const after=JSON.parse(await page.locator('.combat-demo__arena').getAttribute('data-actors'));
  assert.deepEqual(before[1].parts,after[1].parts);await page.screenshot({path:`out/reduced.png`.replace('out/',out+'/')});
  console.log('Reduced-motion touch camera selection preserves neutral Mochi joints');await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
