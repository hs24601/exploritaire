const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 fs.mkdirSync('artifacts/terrain-passage',{recursive:true});
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}]){
  const touch=viewport.width!==1280,context=await browser.newContext({viewport,hasTouch:touch});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/tools/terrain-passage-fixture.html');
  const status=page.locator('[data-passage-state]');await status.waitFor();
  const read=()=>status.evaluate(el=>JSON.parse(el.dataset.passageState));
  const before=await read();assert.equal(before.columns,1);assert(before.obstruction);
  await page.getByRole('img',{name:'Hastily Buried Trapdoor · #buried'}).waitFor();
  assert(await page.getByRole('button',{name:'Reset trail · 1 INSP'}).isDisabled());
  await page.screenshot({path:`artifacts/terrain-passage/${viewport.width}-blocked.png`});
  const button=page.getByRole('button',{name:'Dig trapdoor · 1 AP'});if(touch)await button.tap();else await button.click();
  const opened=await read();assert.equal(opened.columns,7);assert(!opened.obstruction);assert.equal(opened.ap,before.ap-1);assert.equal(opened.progress,before.progress);assert.equal(opened.rank,before.rank);assert.equal(opened.spent,0);
  await page.screenshot({path:`artifacts/terrain-passage/${viewport.width}-opened.png`});
  assert.deepEqual(errors,[]);console.log('PASS terrain passage UI',viewport.width);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
