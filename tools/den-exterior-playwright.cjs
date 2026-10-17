const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 fs.mkdirSync('artifacts/den-exterior-v3',{recursive:true});
 for(const width of [1280,1912]){
  const page=await browser.newPage({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/proto.html');await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  const flat=page.getByRole('button',{name:'Flat camera view',exact:true});if(await flat.count())await flat.click();
  assert.match(await page.locator('[data-den-overhead]').getAttribute('src'),/hero-den-overhead-v3.png$/);
  assert.match(await page.locator('[data-den-roof] image').getAttribute('href'),/hero-den-overhead-v3.png$/);
  await page.screenshot({path:`artifacts/den-exterior-v3/${width}-ott-3x.png`});
  const tile=await page.locator('[data-den-overhead]').boundingBox();
  await page.screenshot({path:`artifacts/den-exterior-v3/${width}-den-close.png`,clip:{x:Math.max(0,tile.x-35),y:Math.max(0,tile.y-35),width:tile.width+70,height:tile.height+70}});
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(700);
  await page.screenshot({path:`artifacts/den-exterior-v3/${width}-immersion-3x.png`});
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}: overhead/roof use exterior v3, OTT and immersion render without errors.`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
