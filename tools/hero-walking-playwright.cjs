const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
(async()=>{
  fs.mkdirSync('artifacts/hero-walking',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,touch]of [[1280,false],[1912,true]])for(const mode of ['tabletop','immersive']){
      const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'no-preference'});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(URL);await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
      const hero=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
      const box=await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
      const from={x:box.x+box.width/2,y:box.y+box.height/2},to={x:from.x,y:from.y-48*1.7*3};
      const cdp=touch?await context.newCDPSession(page):null;
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});else{await page.mouse.move(from.x,from.y);await page.mouse.down();}
      for(let i=1;i<=12;i++){
        const p={x:from.x,y:from.y+(to.y-from.y)*i/12};
        if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});else await page.mouse.move(p.x,p.y);
      }
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
      await cdp?.detach();
      await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"]')?.dataset.actorPose==='walking');
      if(mode==='immersive')await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"][data-board-piece="actor"] canvas')?.dataset.spritePose==='walking');
      // Travel currently has a three-second slow opening; sample after the
      // first paw step and observe in the page so screenshot latency loses no phases.
      await page.waitForFunction(()=>Number(document.querySelector('[data-actor-id="hero"][data-board-piece="actor"] canvas')?.dataset.animationFrame)>0);
      const monitor=page.evaluate(()=>new Promise(resolve=>{
        const frames=new Set(),start=performance.now();
        const sample=()=>{
          const actor=document.querySelector('[data-actor-id="hero"][data-board-piece="actor"]');
          if(actor?.dataset.actorPose==='walking')frames.add(actor.querySelector('canvas')?.dataset.animationFrame);
          if(actor?.dataset.actorPose!=='walking'||performance.now()-start>8000)resolve([...frames]);else requestAnimationFrame(sample);
        };sample();
      }));
      const r=await hero.boundingBox();
      await page.screenshot({path:`artifacts/hero-walking/${width}-${mode}-body-3x.png`,clip:{x:Math.max(0,r.x-25),y:Math.max(0,r.y-25),width:r.width+50,height:r.height+50}});
      await page.screenshot({path:`artifacts/hero-walking/${width}-${mode}-3x.png`});
      const frames=await monitor;
      assert.ok(frames.length>=3,`${mode}: gait failed to advance (${frames})`);
      assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
      await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"][data-board-piece="actor"]')?.dataset.actorPose==='sitting');
      if(mode==='immersive')await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"][data-board-piece="actor"] canvas')?.dataset.spritePose==='sitting');
      assert.deepEqual(errors,[]);console.log('PASS overworld walking, gait, arrival, layout',width,mode,touch?'touch':'mouse');
      await context.close();
    }
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(URL+'?combatdemo');
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').find(a=>a.id==='hero')?.pose==='sitting');
    await page.getByRole('button',{name:'Cinematic',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').find(a=>a.id==='hero')?.pose==='walking');
    const phases=new Set();
    for(let i=0;i<12;i++){
      const hero=await page.locator('.combat-demo__arena').evaluate(el=>JSON.parse(el.dataset.actors).find(a=>a.id==='hero'));
      if(hero.pose==='walking')phases.add(hero.animationFrame);
      await page.waitForTimeout(80);
    }
    assert.ok(phases.size>=2,'combat movement should cycle paws');
    await page.screenshot({path:'artifacts/hero-walking/combat-1280.png'});
    console.log('PASS combat shares walking rig and moving phases');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
