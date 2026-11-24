const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const out='artifacts/dynamic-berries';fs.mkdirSync(out,{recursive:true});
async function setFruit(page,empty){await page.evaluate(empty=>{
 let el=document.querySelector('.proto-game-root');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(f&&f.type?.name!=='ProtoVariant')f=f.return;
 let h=f.memoizedState;while(h&&!h.memoizedState?.biomeTiles)h=h.next;
 h.queue.dispatch(s=>({...s,biomeTiles:s.biomeTiles.map(t=>t.tileType==='berry-patch'?{...t,berryHarvested:empty&&t.berryPatchVariant==='sparse',tableau:empty?[]:t.tableau,stock:empty?[]:t.stock,traversalProgress:1,flags:[]}:t)}));
},empty);await page.waitForTimeout(400)}
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const width of [1280,1912]){
 const page=await browser.newPage({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('exploritaire.artStyle','paint'));
 await page.goto('http://127.0.0.1:5178/proto.html');await page.waitForSelector('.proto-game-root');
 await setFruit(page,false);
 // Camera starts immersed in the scripted opening; use O to inspect overhead too.
 await page.evaluate(()=>{let el=document.querySelector('.proto-game-root');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(f&&f.type?.name!=='ProtoVariant')f=f.return;let h=f.memoizedState;while(h&&!h.memoizedState?.biomeTiles)h=h.next;h.queue.dispatch(s=>({...s,dayScenario:undefined}));});
 for(const mode of ['opening','other-view']){
  if(mode==='other-view'){await page.keyboard.press('o');await page.waitForTimeout(700)}
  assert(await page.locator('[data-bush-berry]').count()>0,'ripe bushes have independent fruit');
  assert.equal(await page.locator('img[data-sparse-bush]').evaluateAll(es=>es.every(e=>e.src.includes('empty'))),true);
  await page.screenshot({path:`${out}/${width}-${mode}-ripe-3x.png`});
 }
 await setFruit(page,true);assert.equal(await page.locator('[data-bush-berry]').count(),0,'all fruit disappears on depletion');assert.equal(await page.locator('[data-manaberry-glow]').count(),0);
 await page.screenshot({path:`${out}/${width}-empty-3x.png`});
 await page.keyboard.press('o');await page.waitForTimeout(700);assert.equal(await page.locator('[data-bush-berry]').count(),0);
 assert.deepEqual(await findLayoutDefects(page,'.proto-game-root',{parts:'.proto-tableau-field',minFontSize:0}),[]);
 assert.deepEqual(errors,[]);console.log('PASS',width,'ripe/empty OTT and immersion; independent fruit; no runtime errors');await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
