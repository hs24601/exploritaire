const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 fs.mkdirSync('artifacts/ability-spacing',{recursive:true});
 try {
  for(const [width,height] of [[1912,914],[1280,720],[987,720]]) {
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width===1280?3:1,reducedMotion:'reduce'});
   await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=005');
   await page.getByRole('button',{name:'Open Momentum abilities',exact:true}).click();
   for(const actor of [null,'Hero','Mochi']) {
    if(actor)await page.getByRole('button',{name:`Show ${actor} abilities`,exact:true}).click();
    const defects=await findLayoutDefects(page,'.ability-fan-overlay',{parts:'.ability-fan__card,.ability-fan__hint,.ability-fan__gauge,.ability-fan__close',minFontSize:10});
    assert.deepEqual(defects,[],`${width} ${actor}: ${defects.join('; ')}`);
    for(const card of await page.locator('.ability-fan__card').all()) {
     assert.deepEqual(await card.evaluate(el=>({clipped:el.scrollHeight>el.clientHeight+1,overflow:el.scrollWidth>el.clientWidth+1})),{clipped:false,overflow:false});
    }
    // Inspect local content rectangles without rotated AABBs creating false collisions.
    const unrotate=await page.addStyleTag({content:'.ability-fan .ability-fan__card {transform:none!important}'});
    for(const id of ['withdraw','bash','sticky-paws','pounce'])assert.deepEqual(await findLayoutDefects(page,`[data-skill="${id}"]`,{parts:'.ability-fan__name,.ability-fan__cost,.ability-fan__art,.ability-fan__actor,.ability-fan__effect,.ability-fan__availability'}),[]);
    await unrotate.evaluate(el=>el.remove());
   }
   await page.screenshot({path:`artifacts/ability-spacing/${width}.png`});
   if(width===1280) {
    const box=await page.locator('.ability-fan').boundingBox();
    await page.screenshot({path:'artifacts/ability-spacing/hand.png',clip:{x:box.x,y:Math.max(0,box.y-40),width:box.width,height:430}});
   }
   console.log(width,'full faces, actor focus, content and viewport bounds passed');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
