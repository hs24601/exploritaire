const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
async function drag(page,from,to,touch){
  const cdp=touch?await page.context().newCDPSession(page):null;
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  else{await page.mouse.move(from.x,from.y);await page.mouse.down();}
  for(let i=1;i<=12;i++){
    const p={x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12};
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});else await page.mouse.move(p.x,p.y);
    await page.waitForTimeout(15);
  }
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await cdp?.detach();
}
(async()=>{
  fs.mkdirSync('artifacts/hero-sitting',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height,touch] of [[1280,720,false],[1912,914,true],[390,844,true],[844,390,true]]){
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'reduce'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(URL);
      const hero=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
      await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"][data-board-piece="actor"] img')?.complete);
      assert.equal(await hero.getAttribute('data-actor-pose'),'sitting');
      assert.match(await hero.locator('img').getAttribute('src'),/hero-sitting-topdown/);
      const print=await hero.evaluate(el=>{
        const matrix=new DOMMatrix(getComputedStyle(el).transform),heading=Number(el.dataset.actorHeading);
        // The nose-up artwork vector (0,-1) must point along heading in table XY.
        return {nose:[-matrix.c,-matrix.d],expected:[Math.sin(heading),Math.cos(heading)]};
      });
      assert.ok(print.nose.every((v,i)=>Math.abs(v-print.expected[i])<1e-6),'overhead nose follows world heading');
      await page.keyboard.press('Space');
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"] canvas')?.dataset.spritePose==='sitting');
      assert.equal(Number(await hero.getAttribute('data-actor-heading')),Math.PI);
      await page.screenshot({path:`artifacts/hero-sitting/${width}-idle-3x.png`});
      await hero.screenshot({path:`artifacts/hero-sitting/${width}-body-3x.png`});
      for(let i=0;i<4;i++) await page.getByRole('button',{name:'Turn table right',exact:true}).click();
      await page.waitForTimeout(500);
      await hero.screenshot({path:`artifacts/hero-sitting/${width}-front-3x.png`});
      for(let i=0;i<4;i++) await page.getByRole('button',{name:'Turn table right',exact:true}).click();
      await page.waitForTimeout(500);
      assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
      // Start travel with the same mouse/touch inputs the player uses.
      await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('[data-biome-id="day-one-berries"]')),touch);
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"]')?.dataset.actorPose==='standing');
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"] canvas')?.dataset.spritePose==='standing');
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"]')?.dataset.actorPose==='sitting');
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"] canvas')?.dataset.spritePose==='sitting');
      assert.deepEqual(errors,[]);
      console.log('PASS sitting idle, standing travel, sitting arrival',width,touch?'touch':'mouse');
      await context.close();
    }
    // The battle consumer shares the same pose-switching instance library.
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(URL+'?combatdemo');
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').find(a=>a.id==='hero')?.pose==='sitting');
    await page.getByRole('button',{name:'Cinematic',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').find(a=>a.id==='hero')?.pose==='standing');
    console.log('PASS battle Hero sits at idle and stands for action');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
